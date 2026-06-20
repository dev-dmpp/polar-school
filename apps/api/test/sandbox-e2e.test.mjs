// Test e2e que simula el flujo completo del SandboxTerminal en el browser.
// Cubre: register, login, sandbox start, WS connect, múltiples comandos, stop.
//
// Uso: node /tmp/sandbox-e2e.mjs

import WebSocket from "ws";
import { setTimeout as sleep } from "node:timers/promises";

const WEB = process.env.WEB_URL ?? "http://127.0.0.1:3000";
const API = process.env.API_URL ?? "http://127.0.0.1:3007";

function randHex(n) {
  return [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
}

let ok = 0;
let fail = 0;

function expect(cond, msg) {
  if (cond) {
    ok++;
    console.log(`✓ ${msg}`);
  } else {
    fail++;
    console.error(`❌ ${msg}`);
  }
}

async function main() {
  console.log(`\n🐻 Test e2e integrado SandboxTerminal (browser flow)`);
  console.log(`   WEB=${WEB}`);
  console.log(`   API=${API}\n`);

  // 1) Cargar la página HTML
  const pageRes = await fetch(`${WEB}/cursos/linux-basico/01-pwd/`);
  expect(pageRes.status === 200, `GET ${WEB}/cursos/linux-basico/01-pwd/ → ${pageRes.status}`);
  const html = await pageRes.text();

  // 2) Verificar que la página tiene los hooks esperados
  expect(html.includes("🐳 Sandbox real (opcional)"), "página contiene 'Sandbox real (opcional)'");
  expect(html.includes("sandbox-block"), "página contiene clase CSS 'sandbox-block'");
  expect(html.includes("SandboxTerminal"), "página referencia SandboxTerminal");

  // 3) Verificar que PUBLIC_API_URL está embebido apuntando al API correcto
  expect(html.includes("127.0.0.1:3007"), "PUBLIC_API_URL apunta a :3007 en el HTML");

  // 4) Verificar que el bundle de UI incluye el módulo de SandboxTerminal
  const bundleMatch = html.match(/component-export="(SandboxTerminal|TryIt|AuthButton|MarkComplete)"/g);
  expect(bundleMatch !== null, `la página tiene astro-islands de UI (${bundleMatch?.length ?? 0} encontrados)`);

  // 5) Simular register desde browser (igual a lo que haría AuthButton)
  const email = `polar-e2e-${randHex(6)}@test.local`;
  const password = "password-seguro-123";

  const regRes = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(regRes.status === 200, `register desde browser → ${regRes.status}`);
  const cookieHeader = regRes.headers.get("set-cookie");
  expect(cookieHeader?.includes("auth_session=") === true, "register devuelve cookie auth_session");

  // Cookie tiene restricciones de SameSite=Lax que permiten cross-port GET
  // (mismo host, distintos puertos). El browser lo permite.
  const sessionCookie = cookieHeader.match(/(auth_session=[^;]+)/)[1];

  // 6) SandboxTerminal haría POST /sandbox/start
  const startRes = await fetch(`${API}/sandbox/start`, {
    method: "POST",
    headers: { cookie: sessionCookie },
  });
  expect(startRes.status === 201 || startRes.status === 200, `start → ${startRes.status}`);
  const startBody = await startRes.json();
  expect(startBody.ok === true, "start.ok === true");
  expect(typeof startBody.sessionToken === "string", "sessionToken presente");
  expect(typeof startBody.containerId === "string", "containerId presente");

  // 7) Conexión WebSocket (como haría SandboxTerminal.connectWs)
  const wsUrl = API.replace(/^http/, "ws") + startBody.wsPath + "?token=" + encodeURIComponent(startBody.sessionToken);
  console.log(`   WS → ${wsUrl.replace(/(token=)[^&]+/, "$1***")}`);

  const ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  let ready = false;
  const received = [];
  let exitMsg = null;

  ws.on("message", (data, isBinary) => {
    // Nota: la lib `ws` de Node reporta TODOS los mensajes como "binary"
    // (incluso los text frames), porque es un detalle de implementación de la lib.
    // El navegador, en cambio, respeta la spec: text frames llegan como string,
    // binary frames como Blob/ArrayBuffer. Por eso aquí usamos una heurística
    // basada en el contenido (¿empieza con `{`?) en lugar del flag isBinary.
    let asString;
    if (Buffer.isBuffer(data)) {
      asString = data.toString("utf8");
    } else if (data instanceof ArrayBuffer) {
      asString = Buffer.from(data).toString("utf8");
    } else if (typeof data === "string") {
      asString = data;
    } else {
      return;
    }

    // ¿Es un mensaje de control JSON?
    if (asString.startsWith("{")) {
      try {
        const m = JSON.parse(asString);
        if (m.type === "ready") ready = true;
        if (m.type === "exit") exitMsg = m;
        return;
      } catch {
        // No era JSON válido → es output crudo que comienza con {
      }
    }
    received.push(Buffer.from(asString, "utf8"));
  });

  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  // 8) Esperar ready
  const start = Date.now();
  while (!ready && Date.now() - start < 10000) await sleep(50);
  expect(ready, "WS recibió {type:'ready'}");

  // 9) Ejecutar secuencia completa (lo que un alumno haría en lección 1: pwd)
  received.length = 0;
  ws.send("pwd\n");
  await sleep(800);
  const out1 = Buffer.concat(received).toString("utf8");
  expect(out1.includes("/"), `pwd devolvió un path (${JSON.stringify(out1.slice(0, 80))})`);

  // 10) Lección 1 secuencia: cd + pwd
  received.length = 0;
  ws.send("mkdir -p sandbox-test && cd sandbox-test && pwd\n");
  await sleep(1500);
  const out2 = Buffer.concat(received).toString("utf8");
  expect(out2.includes("sandbox-test"), `cd+pwd funcionó (${JSON.stringify(out2.slice(0, 100))})`);

  // 11) Lección 3 secuencia: cd .. + pwd
  received.length = 0;
  ws.send("cd .. && pwd\n");
  await sleep(1500);
  const out3 = Buffer.concat(received).toString("utf8");
  expect(out3.length > 0, `cd .. + pwd devolvió output`);

  // 12) Resize (como haría SandboxTerminal con ResizeObserver)
  ws.send(JSON.stringify({ type: "resize", cols: 100, rows: 30 }));
  await sleep(300);

  // 13) Cleanup: parar sandbox
  ws.close();
  await sleep(300);
  const stopRes = await fetch(`${API}/sandbox/stop`, {
    method: "POST",
    headers: { cookie: sessionCookie },
  });
  expect(stopRes.status === 200, `stop → ${stopRes.status}`);

  // 14) Status final
  const statusRes = await fetch(`${API}/sandbox/status`, {
    headers: { cookie: sessionCookie },
  });
  const statusBody = await statusRes.json();
  expect(statusBody.active === false, "después de stop, active=false");

  console.log(`\n📊 Resumen:`);
  console.log(`   Tests OK: ${ok}`);
  console.log(`   Tests fallidos: ${fail}`);
  console.log(`   Exit msg del WS: ${exitMsg ? JSON.stringify(exitMsg) : "(nunca llegó)"}\n`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ Test crasheó:", err);
  process.exit(1);
});
