import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Account, KeyPair, actions, baseEncode } from "near-api-js";
import { openAgentStore } from "../packages/agent-runtime/store.mjs";
import { createDurableOperator } from "../packages/near/durable-operator.mjs";
test("An uncertain operator broadcast resumes the exact signed bytes and never signs another nonce", async () => {
  const store = openAgentStore({ path: ":memory:" });
  let signs = 0,
    broadcasts = 0,
    available = false,
    stored;
  const provider = {
    viewAccessKey: async () => ({ nonce: 1n }),
    viewBlock: async () => ({
      header: { hash: baseEncode(new Uint8Array(32)) },
    }),
    viewTransactionStatus: async () => {
      if (!available) throw Error("fixture unknown");
      return stored;
    },
    sendTransactionUntil: async (tx) => {
      broadcasts++;
      const row = store.db.prepare("SELECT * FROM chain_operations").get();
      assert.deepEqual(Buffer.from(tx.encode()), Buffer.from(row.signed_tx));
      stored = {
        transaction: {
          hash: baseEncode(
            createHash("sha256").update(tx.transaction.encode()).digest(),
          ),
          receiver_id: "operator.testnet",
        },
        status: { SuccessValue: "" },
        receipts_outcome: [],
      };
      if (broadcasts === 1) {
        available = false;
        throw Error("fixture timeout after chain accepted");
      }
      return stored;
    },
  };
  const account = new Account(
    "operator.testnet",
    provider,
    KeyPair.fromRandom("ed25519").toString(),
  );
  const create = account.createSignedTransaction.bind(account);
  account.createSignedTransaction = async (args) => {
    signs++;
    return create(args);
  };
  const args = { job_id: 7, evidence: ["a".repeat(64)] },
    op = {
      id: "deliver:7",
      method: "deliver_service_job",
      args,
      actions: [
        actions.functionCall("deliver_service_job", args, 80000000000000n, 0n),
      ],
    };
  try {
    let journal = createDurableOperator({
      store,
      provider,
      account: async () => account,
      receiver: "operator.testnet",
    });
    await assert.rejects(() => journal.send(op), /persisted hash/);
    assert.equal(signs, 1);
    journal = createDurableOperator({
      store,
      provider,
      account: async () => account,
      receiver: "operator.testnet",
    });
    await journal.send(op);
    assert.equal(signs, 1);
    assert.equal(broadcasts, 2);
    assert.equal(
      store.db.prepare("SELECT status FROM chain_operations").get().status,
      "FINAL",
    );
    await assert.rejects(
      () => journal.send({ ...op, args: { job_id: 8 } }),
      /changed after signing/,
    );
  } finally {
    store.close();
  }
});
