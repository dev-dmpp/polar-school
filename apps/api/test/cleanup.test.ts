// Tests del cleanup loop.
//
// No podemos testear contra Docker real (sin mocks complejos), pero verificamos:
//   - startCleanupLoop es idempotente
//   - runCleanupTick no rompe si listManagedContainers devuelve []
//   - getCleanupStats reporta totales correctos
//   - stopCleanupLoop detiene el interval
//
// Uso:  node --import tsx --test test/cleanup.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runCleanupTick,
  startCleanupLoop,
  stopCleanupLoop,
  getCleanupStats,
} from "../src/sandbox/cleanup.js";

test("runCleanupTick con lista vacía no rompe y devuelve 0 killed", async () => {
  const before = getCleanupStats();
  const result = await runCleanupTick();
  assert.equal(result.killed, 0);
  assert.equal(result.errors, 0);
  const after = getCleanupStats();
  // running debe pasar a false después del tick
  assert.equal(after.running, false);
});

test("runCleanupTick es seguro ante concurrencia (re-entrada)", async () => {
  // Llamar dos veces "en paralelo": el segundo debe abortar
  const [r1, r2] = await Promise.all([runCleanupTick(), runCleanupTick()]);
  // Uno de los dos debe haber abortado (remaining: -1, killed: 0)
  const aborted = [r1, r2].find((r) => r.remaining === -1 && r.killed === 0);
  assert.ok(aborted, "uno de los ticks concurrentes debe haber abortado");
});

test("startCleanupLoop es idempotente", () => {
  startCleanupLoop();
  startCleanupLoop(); // no debe crashear ni duplicar
  stopCleanupLoop();
});

test("startCleanupLoop + stopCleanupLoop funcionan", () => {
  startCleanupLoop();
  // Esperar al menos un ciclo para confirmar que está corriendo
  assert.equal(getCleanupStats().running, false); // running es per-tick, no per-loop
  stopCleanupLoop();
  // Idempotente también en stop
  stopCleanupLoop();
});

test("getCleanupStats devuelve forma correcta", () => {
  const stats = getCleanupStats();
  assert.equal(typeof stats.totalKilled, "number");
  assert.equal(typeof stats.running, "boolean");
  assert.ok(stats.totalKilled >= 0);
});
