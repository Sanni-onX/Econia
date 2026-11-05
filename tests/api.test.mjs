import test from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../apps/api/server.mjs";
test("API owner controls, invalid inputs, admin authorization, sponsorship and persisted sale", async () => {
  let saved;
  const repo = {
    kind: "memory-test",
    async load() {
      return null;
    },
    async save(w) {
      saved = structuredClone(w);
    },
    async history() {
      return [];
    },
    async close() {},
  };
  const app = await createApplication({
    repository: repo,
    autoTick: false,
    quiet: true,
    adminToken: "test-secret",
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const send = (path, data, headers = {}) =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(data),
    });
  try {
    assert.equal((await fetch(base + "/api/health")).status, 200);
    assert.equal((await send("/api/admin/tick", { count: 1 })).status, 403);
    assert.equal(
      (
        await send(
          "/api/admin/tick",
          { count: 1 },
          { Authorization: "Bearer test-secret" },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await send(
          "/api/entities/person_199/sponsor",
          { amount: -5 },
          { "Idempotency-Key": "invalid-amount" },
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await send(
          "/api/entities/person_199/sponsor",
          { amount: 100000 },
          { "Idempotency-Key": "api-sponsor-1" },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await send(
          "/api/entities/person_199/sponsor",
          { amount: 100000 },
          { "Idempotency-Key": "api-sponsor-1" },
        )
      ).status,
      200,
    );
    assert.equal(app.world.entities.person_199.sponsorship, 100000);
    assert.equal(
      (
        await send(
          "/api/entities/person_104/sponsor",
          { amount: 1000 },
          { "Idempotency-Key": "wrong-owner-1" },
        )
      ).status,
      400,
    );
    const l = app.world.listings[0];
    assert.equal(
      (
        await send(
          "/api/marketplace",
          { action: "BUY", listingId: l.id },
          { "Idempotency-Key": "api-purchase-1" },
        )
      ).status,
      200,
    );
    assert.equal(saved.entities[l.entity].owner, "demo.local");
    assert.equal(
      (
        await send(
          "/api/admin/event",
          { type: "DROUGHT" },
          {
            Authorization: "Bearer test-secret",
            Origin: "https://malicious.example",
          },
        )
      ).status,
      403,
    );
  } finally {
    await app.close();
  }
});
