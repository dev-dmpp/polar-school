import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, WebSocket as NodeWebSocket } from "ws";
import type { Duplex } from "node:stream";
import { docker, touchActivity } from "./manager.js";
import { verifySandboxSessionToken } from "./session-token.js";

/**
 * Bridge bidireccional entre WebSocket del cliente y docker attach del contenedor.
 *
 * Protocolo:
 *   cliente → servidor:
 *     - texto/binario: input crudo para bash (incluyendo \r de Enter)
 *     - JSON {"type":"resize","cols":N,"rows":N}: redimensionar PTY
 *     - JSON {"type":"signal","signal":"SIGINT"}: enviar Ctrl+C (futuro)
 *   servidor → cliente:
 *     - binario: bytes crudos del PTY (banner, prompt, echo, output)
 *     - texto JSON: {"type":"ready"} (handshake OK), {"type":"exit","code":..,"reason":".."},
 *                   {"type":"error","message":".."}
 *
 * Decisiones:
 *   - docker attach (no exec): el contenedor ya corre bash como PID 1
 *   - Marker de handshake: escribimos `printf '__POLAR_READY__\n'; clear` y esperamos el eco
 *   - Token en query string: el navegador no puede setear headers en WS; el token
 *     viene del response de POST /sandbox/start
 *   - Sin reconexión persistente: si el cliente se desconecta, el container queda vivo
 *     (lo mata el cleanup cron o un nuevo start)
 */

const READY_MARKER = "__POLAR_READY__";

interface AttachHandle {
  stream: Duplex;
  write: (buf: Buffer) => boolean;
  destroy: () => void;
}

/**
 * Adjunta al proceso principal (PID 1) del contenedor.
 * Retorna un handle que wrappea el stream duplex de dockerode en algo más
 * predecible: emitimos 'data' como Buffers, y write() devuelve boolean.
 */
async function attachContainer(containerId: string): Promise<AttachHandle> {
  const container = docker.getContainer(containerId);
  const stream = (await container.attach({
    stream: true,
    stdin: true,
    stdout: true,
    stderr: true,
  })) as Duplex;

  return {
    stream,
    write: (buf) => stream.write(buf),
    destroy: () => {
      if (!stream.destroyed) stream.destroy();
    },
  };
}

/** Maneja una conexión WS: valida token, hace attach, hace bridge. */
async function handleConnection(ws: NodeWebSocket, req: IncomingMessage): Promise<void> {
  // 1) Parsear token del query string
  const url = new URL(req.url ?? "/", "http://localhost");
  const token = url.searchParams.get("token");
  if (!token) {
    ws.send(JSON.stringify({ type: "error", message: "Falta token en query string" }), { binary: false });
    ws.close(4001, "missing-token");
    return;
  }

  const payload = verifySandboxSessionToken(token);
  if (!payload) {
    ws.send(JSON.stringify({ type: "error", message: "Token inválido o expirado" }), { binary: false });
    ws.close(4003, "invalid-token");
    return;
  }

  // 2) Buscar container activo del usuario
  const { getActiveForUser } = await import("./manager.js");
  const active = getActiveForUser(payload.userId);
  if (!active) {
    ws.send(JSON.stringify({ type: "error", message: "No hay sandbox activo. Llamá a POST /sandbox/start" }), { binary: false });
    ws.close(4004, "no-active-sandbox");
    return;
  }

  const userId = payload.userId;
  const containerId = active.containerId;

  // 3) Attach al container
  let handle: AttachHandle;
  try {
    handle = await attachContainer(containerId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ws.send(JSON.stringify({ type: "error", message: `No pude conectar al container: ${message}` }), { binary: false });
    ws.close(4010, "attach-failed");
    return;
  }

  let closed = false;
  let ready = false;

  const cleanup = (code: number, reason: string) => {
    if (closed) return;
    closed = true;

    try {
      handle.destroy();
    } catch {
      /* ignore */
    }

    if (ws.readyState === NodeWebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "exit", code, reason }), { binary: false });
      } catch {
        /* ignore */
      }
      ws.close(1000, reason);
    }

    console.log(`[sandbox-ws] ${reason} (user=${userId.slice(0, 8)}…)`);
  };

  // 4) Stream container → cliente
  // Buffer con chunks pendientes; flush en nextTick para evitar message spam.
  let pendingChunks: Buffer[] = [];
  let flushing = false;

  const flushPending = () => {
    if (flushing || pendingChunks.length === 0) return;
    flushing = true;
    const merged = Buffer.concat(pendingChunks);
    pendingChunks = [];
    flushing = false;

    if (!ready && merged.includes(Buffer.from(READY_MARKER))) {
      ready = true;
      try {
        // Importante: especificar { binary: false } para que llegue como string al cliente,
        // no como Blob/ArrayBuffer (que el browser mandaría a la rama de output crudo).
        ws.send(JSON.stringify({ type: "ready" }), { binary: false });
      } catch {
        /* ignore */
      }
    }

    if (ws.readyState === NodeWebSocket.OPEN) {
      try {
        ws.send(merged);
      } catch (err) {
        console.warn("[sandbox-ws] write to ws falló:", err);
      }
    }
  };

  handle.stream.on("data", (chunk: Buffer) => {
    pendingChunks.push(chunk);
    process.nextTick(flushPending);
  });

  handle.stream.on("end", () => cleanup(0, "container-end"));
  handle.stream.on("close", () => cleanup(0, "container-close"));
  handle.stream.on("error", (err: Error) => {
    console.error("[sandbox-ws] stream error:", err.message);
    cleanup(1011, "stream-error");
  });

  // 5) Handshake: forzar al bash a hacer echo del marker para confirmar que el stream está vivo
  const markerCmd = Buffer.from(`printf '${READY_MARKER}\\n'; clear\n`, "utf8");
  try {
    handle.write(markerCmd);
  } catch (err) {
    cleanup(1011, "handshake-write-failed");
    return;
  }

  // Si en 5s no llega el marker, asumimos que algo está mal
  const handshakeTimer = setTimeout(() => {
    if (!ready && !closed) {
      console.warn(`[sandbox-ws] handshake timeout (user=${userId.slice(0, 8)}…)`);
      cleanup(1011, "handshake-timeout");
    }
  }, 5000);

  // 6) Stream cliente → container
  ws.on("message", (data, isBinary) => {
    if (closed) return;
    touchActivity(userId);

    let buf: Buffer;
    if (Buffer.isBuffer(data)) {
      buf = data;
    } else if (data instanceof ArrayBuffer) {
      buf = Buffer.from(data);
    } else if (Array.isArray(data)) {
      buf = Buffer.concat(data as Buffer[]);
    } else if (typeof data === "string") {
      buf = Buffer.from(data, "utf8");
    } else {
      return;
    }

    // Mensajes de control en JSON
    if (!isBinary && buf.length > 0 && buf[0] === 0x7b /* '{' */) {
      try {
        const msg = JSON.parse(buf.toString("utf8"));
        if (
          msg &&
          msg.type === "resize" &&
          typeof msg.cols === "number" &&
          typeof msg.rows === "number" &&
          msg.cols > 0 &&
          msg.rows > 0 &&
          msg.cols <= 500 &&
          msg.rows <= 500
        ) {
          docker
            .getContainer(containerId)
            .resize({ h: msg.rows, w: msg.cols })
            .catch((err: Error) => console.warn("[sandbox-ws] resize falló:", err.message));
          return;
        }
        if (msg && msg.type === "signal" && msg.signal === "SIGINT") {
          try {
            handle.write(Buffer.from([0x03]));
          } catch {
            /* ignore */
          }
          return;
        }
      } catch {
        // No es JSON → input crudo, lo procesamos abajo
      }
    }

    try {
      handle.write(buf);
    } catch (err) {
      console.warn("[sandbox-ws] write to container falló:", err);
      cleanup(1011, "container-write-failed");
      return;
    }

    if (ready) clearTimeout(handshakeTimer);
  });

  ws.on("close", () => {
    clearTimeout(handshakeTimer);
    cleanup(1000, "client-disconnected");
  });

  ws.on("error", (err) => {
    clearTimeout(handshakeTimer);
    console.warn(`[sandbox-ws] ws error (user=${userId.slice(0, 8)}…): ${err.message}`);
    cleanup(1011, "ws-error");
  });
}

/** Crea un WebSocketServer montado en /sandbox/ws del HTTP server de Hono. */
export function attachSandboxWs(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/sandbox/ws") {
      // No nos interesa; dejamos que otros lo manejen (o cierre)
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      handleConnection(ws as NodeWebSocket, req).catch((err) => {
        console.error("[sandbox-ws] handleConnection crasheó:", err);
        try {
          (ws as NodeWebSocket).close(1011, "internal-error");
        } catch {
          /* ignore */
        }
      });
    });
  });

  console.log("[sandbox-ws] WebSocketServer montado en /sandbox/ws");
  return wss;
}
