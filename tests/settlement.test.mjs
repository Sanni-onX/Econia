import test from "node:test";
import assert from "node:assert/strict";
import { genesis, tick } from "../packages/simulation-core/index.mjs";
import { commitPreparedCycle } from "../packages/shared/settlement.mjs";
test("crash after onchain acknowledgement recovers staged batches without double payment", async () => {
  const before = genesis(),
    candidate = structuredClone(before);
  candidate.mode = "testnet";
  candidate.chain = { lastBatch: 0 };
  tick(candidate);
  const batches = [];
  for (let i = 0; i < candidate.ledger.length; i += 50)
    batches.push({
      id: batches.length + 1,
      transfers: candidate.ledger.slice(i, i + 50),
    });
  assert.ok(batches.length > 1);
  const initialStage = { candidate, batches, newEntities: [], completed: 0 };
  let durable = structuredClone(initialStage),
    saved,
    fail = true,
    last = 0,
    applied = 0;
  const actual = Object.fromEntries(
    Object.values(before.entities).map((e) => [e.id, e.cash]),
  );
  const adapter = {
    async settle(batch) {
      if (batch.id === last) return { hash: null, reconciled: true };
      assert.equal(batch.id, last + 1);
      for (const t of batch.transfers) {
        actual[t.debit] -= t.amount;
        actual[t.credit] += t.amount;
        applied++;
      }
      last = batch.id;
      return { hash: "final-" + batch.id };
    },
  };
  const repo = {
    async saveStage(stage) {
      if (fail) {
        fail = false;
        throw new Error("Simulated disk restart after chain acknowledgement");
      }
      durable = structuredClone(stage);
    },
    async save(world) {
      saved = structuredClone(world);
    },
    async clearStage() {
      durable = null;
    },
  };
  await assert.rejects(
    commitPreparedCycle(structuredClone(initialStage), { adapter, repo }),
    /disk restart/,
  );
  assert.equal(last, 1);
  assert.equal(durable.completed, 0);
  await commitPreparedCycle(structuredClone(durable), { adapter, repo });
  assert.equal(applied, candidate.ledger.length);
  assert.equal(durable, null);
  for (const e of Object.values(saved.entities))
    assert.equal(actual[e.id], e.cash);
  assert.equal(saved.chain.lastBatch, batches.length);
});
