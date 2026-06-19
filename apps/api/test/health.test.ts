import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";

test("GET /health responde 200 con { ok: true }", async () => {
  const res = await app.request("/health");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, "polar-school-api");
  assert.match(body.time, /^\d{4}-\d{2}-\d{2}T/);
});

test("GET /404 inexistente responde 404", async () => {
  const res = await app.request("/this-route-does-not-exist");
  assert.equal(res.status, 404);
});

test("GET /auth/me sin cookie devuelve user: null", async () => {
  const res = await app.request("/auth/me");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user, null);
});
