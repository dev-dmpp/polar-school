// Magic link auth. Genera tokens, hashea en DB, envía por Resend (en prod)
// o loguea en consola (en dev).
import { randomBytes, createHash } from "node:crypto";
import { Resend } from "resend";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@polar-school/db";
import { magicLinkTokens } from "@polar-school/db";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MIN = 15;

/**
 * Cache módulo-level del último link emitido. Sólo se usa en dev (sin SMTP
 * configurado) para devolverlo en la respuesta HTTP y que la UI lo muestre.
 * En prod con Resend, queda stale pero irrelevante: la ruta lo lee sólo
 * cuando no hay RESEND_API_KEY.
 *
 * Exportado como getter para que los imports vean la mutación (los bindings
 * de export `let` en ESM son read-only para el importador).
 */
let _lastIssuedLink: string | null = null;
export function getLastIssuedLink(): string | null {
  return _lastIssuedLink;
}

export interface IssueMagicLinkInput {
  userId: string;
  email: string;
}

export interface IssuedMagicLink {
  token: string; // plain token (sólo se retorna en dev)
  url: string;
  expiresAt: Date;
}

export async function issueMagicLink(
  input: IssueMagicLinkInput,
): Promise<IssuedMagicLink> {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);

  await db.insert(magicLinkTokens).values({
    id: randomBytes(16).toString("hex"),
    userId: input.userId,
    tokenHash,
    expiresAt,
  });

  const baseUrl =
    process.env.MAGIC_LINK_BASE_URL ?? "http://127.0.0.1:3000";
  const url = `${baseUrl}/auth/callback?token=${token}`;

  // Enviar por Resend si hay API key; si no, log a consola.
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from =
      process.env.MAGIC_LINK_FROM ?? "Polar School <hola@polar.school>";
    await resend.emails.send({
      from,
      to: input.email,
      subject: "Tu enlace de acceso a Polar School",
      html: magicLinkEmailHtml(url),
      text: magicLinkEmailText(url),
    });
  } else {
    console.log(
      `\n📧 [DEV] Magic link para ${input.email}:\n   ${url}\n   (expira en ${TOKEN_TTL_MIN} min)\n`,
    );
  }

  _lastIssuedLink = url;
  return { token, url, expiresAt };
}

export async function consumeMagicLink(token: string): Promise<string | null> {
  if (!token || token.length !== TOKEN_BYTES * 2) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rows = await db
    .select()
    .from(magicLinkTokens)
    .where(
      and(
        eq(magicLinkTokens.tokenHash, tokenHash),
        isNull(magicLinkTokens.consumedAt),
        gt(magicLinkTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  await db
    .update(magicLinkTokens)
    .set({ consumedAt: new Date() })
    .where(eq(magicLinkTokens.id, row.id));
  return row.userId;
}

function magicLinkEmailText(url: string): string {
  return [
    "Hola,",
    "",
    "Recibimos una solicitud de acceso a tu cuenta en Polar School.",
    "Para iniciar sesión, abre este enlace (válido por 15 minutos):",
    "",
    url,
    "",
    "Si no solicitaste este enlace, puedes ignorar este mensaje.",
    "",
    "— El equipo de Polar School",
  ].join("\n");
}

function magicLinkEmailHtml(url: string): string {
  const safeUrl = encodeURI(url);
  return `<!doctype html>
<html lang="es">
  <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Tu enlace de acceso</h1>
    <p>Recibimos una solicitud para iniciar sesión en Polar School con tu correo.</p>
    <p style="margin: 24px 0;">
      <a href="${safeUrl}" style="background: #0f172a; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Iniciar sesión</a>
    </p>
    <p style="font-size: 13px; color: #64748b;">El enlace vence en 15 minutos. Si no solicitaste este acceso, puedes ignorar este mensaje.</p>
  </body>
</html>`;
}
