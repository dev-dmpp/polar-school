// Test e2e del WebSocket bridge.
// Hace register → login → start → ws connect → envía `echo hola` → lee output → stop.
//
// Uso:  node --import tsx/esm test/ws-bridge.test.ts
//
// Variables de entorno:
//   API_URL  (default http://127.0.0.1:3001)

import { setTimeout as sleep } from "node:timers/promises";
import WebSocket from "ws";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

function randHex(n: number): string {
  return [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
}

async function api(method: string, path: string, opts: { cookie?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers["cookie"] = opts.cookie;
  if (opts.body) headers["content-type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, json, setCookie };
}

function expect(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

function extractSessionCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  // "auth_session=xxx; Path=/; ..." → "auth_session=xxx"
  const m = setCookie.match(/(auth_session=[^;]+)/);
  return m ? m[1] : null;
}

async function main() {
  console.log(`\n🐻 Test e2e del WebSocket bridge contra ${API}\n`);

  // 1) Register
  const email = `polar-ws-${randHex(6)}@test.local`;
  const password = "password-seguro-123";

  const reg = await api("POST", "/auth/register", { body: { email, password } });
  expect(reg.status === 200 || reg.status === 201, `register status ${reg.status}`);
  const cookie = extractSessionCookie(reg.setCookie);
  expect(!!cookie, "register devuelve cookie de sesión");

  // 2) Start sandbox
  const start = await api("POST", "/sandbox/start", { cookie: cookie! });
  expect(start.status === 200 || start.status === 201, `start status ${start.status}`);

  const startBody = start.json as {
    ok: boolean;
    containerId: string;
    sessionToken: string;
    wsPath: string;
  } | null;
  expect(!!startBody && startBody.ok === true, "start.ok === true");
  expect(typeof startBody!.sessionToken === "string", "start.sessionToken es string");
  expect(startBody!.sessionToken.length > 20, `sessionToken tiene longitud razonable (${startBody!.sessionToken.length})`);

  const containerId = startBody!.containerId;
  console.log(`   containerId = ${containerId.slice(0, 12)}…`);

  // 3) Conectar WebSocket
  const wsUrl = API.replace(/^http/, "ws") + startBody!.wsPath + "?token=" + encodeURIComponent(startBody!.sessionToken);
  console.log(`   WS → ${wsUrl.replace(/(token=)[^&]+/, "$1***")}`);

  const ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  const receivedBinary: Buffer[] = [];
  const controlMessages: unknown[] = [];
  let exitMessage: { code: number; reason: string } | null = null;

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      receivedBinary.push(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
    } else {
      try {
        const msg = JSON.parse(data.toString());
        controlMessages.push(msg);
        const m = msg as { type?: string; reason?: string; code?: number };
        if (m.type === "exit") exitMessage = { code: m.code ?? -1, reason: m.reason ?? "" };
      } catch {
        /* ignore */
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  console.log("✓ WS conectado");

  // 4) Esperar ready
  const readyStart = Date.now();
  while (Date.now() - readyStart < 8000) {
    if (controlMessages.some((m) => (m as { type?: string }).type === "ready")) break;
    await sleep(100);
  }
  expect(
    controlMessages.some((m) => (m as { type?: string }).type === "ready"),
    "WS recibió mensaje 'ready' del handshake",
  );

  // Limpiar output recibido durante el handshake (banner + marker + clear)
  receivedBinary.length = 0;

  // 5) Enviar `echo WSBRIDGE_OK` y leer respuesta
  const marker = `WSBRIDGE_${randHex(4)}`;
  ws.send(`echo ${marker}\n`);

  const echoStart = Date.now();
  let echoFound = false;
  while (Date.now() - echoStart < 5000) {
    if (receivedBinary.some((b) => b.toString("utf8").includes(marker))) {
      echoFound = true;
      break;
    }
    await sleep(100);
  }

  const allOutput = Buffer.concat(receivedBinary).toString("utf8");
  expect(echoFound, `echo devolvió el marker ${marker}`);
  console.log(`   output capturado: ${JSON.stringify(allOutput.slice(0, 200))}`);

  // 6) Probar resize (no debe tirar error)
  ws.send(JSON.stringify({ type: "resize", cols: 120, rows: 30 }));
  await sleep(300);

  // 7) Probar SIGINT
  ws.send(`sleep 30 &\n`);
  await sleep(500);
  ws.send(JSON.stringify({ type: "signal", signal: "SIGINT" }));
  await sleep(300);

  // 8) Cerrar WS
  ws.close();
  await sleep(500);

  // 9) Stop sandbox
  const stop = await api("POST", "/sandbox/stop", { cookie: cookie! });
  expect(stop.status === 200, `stop status ${stop.status}`);

  // 10) Resumen
  console.log(`\n📊 Resumen:`);
  console.log(`   Mensajes de control: ${controlMessages.length} (${controlMessages.map((m) => (m as { type?: string }).type).join(", ")})`);
  console.log(`   Bytes binarios recibidos: ${Buffer.concat(receivedBinary).length}`);
  console.log(`   Exit: ${exitMessage ? JSON.stringify(exitMessage) : "(no exit)"}`);

  console.log(`\n✅ Todos los checks pasaron\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Test crasheó:", err);
  process.exit(1);
});
