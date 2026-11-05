import test from "node:test";
import assert from "node:assert/strict";
import { NearTestnetEcoAdapter } from "../packages/shared/near.mjs";
const adapter = () =>
  new NearTestnetEcoAdapter({
    ecoContract: "eco.econia.testnet",
    worldContract: "world.econia.testnet",
  });
test("payment adapter requires explicit testnet contracts and a signer for settlement", async () => {
  assert.throws(
    () =>
      new NearTestnetEcoAdapter({
        ecoContract: "eco.near",
        worldContract: "world.near",
      }),
  );
  assert.throws(
    () =>
      new NearTestnetEcoAdapter({
        ecoContract: "e.testnet",
        worldContract: "w.testnet",
        rpcUrl: "https://malicious.example",
      }),
  );
  await assert.rejects(adapter().settle({ id: 1, transfers: [] }), /signer/);
  const tx = adapter().sponsorshipTransaction("person_199", 100000);
  assert.equal(tx.actions[0].params.args.amount, "100000");
  assert.equal(tx.actions[0].params.deposit, "1");
  assert.throws(() => adapter().sponsorshipTransaction("person_199", 1.5));
});
test("reconciliation detects unmatched custody balance and projection differences", async () => {
  const a = adapter();
  a.entity = async () => ({ treasury: "100" });
  a.view = async (_, method) =>
    method === "ft_balance_of" ? "200" : { escrow_total: "100" };
  const r = await a.reconcile([{ id: "person_199", cash: 100 }]);
  assert.equal(r.balanced, false);
  a.entity = async () => ({ treasury: "90" });
  assert.equal(
    (await a.reconcile([{ id: "person_199", cash: 100 }])).differences.length,
    1,
  );
});
test("sponsorship verifier ignores forged receiver logs and only accepts successful matching receipt", async () => {
  const a = adapter(),
    log =
      "EVENT_JSON:" +
      JSON.stringify({
        standard: "econia",
        event: "sponsorship",
        data: [
          {
            sequence: 1,
            value: {
              entity_id: "person_199",
              sender: "alice.testnet",
              amount: "100000",
              treasury: "100000",
            },
          },
        ],
      });
  const tx = {
    transaction: { signer_id: "alice.testnet", receiver_id: a.ecoContract },
    receipts_outcome: [
      {
        block_hash: "b",
        outcome: {
          executor_id: "forged.testnet",
          status: { SuccessValue: "" },
          logs: [log],
        },
      },
    ],
  };
  a.receipt = async () => tx;
  await assert.rejects(
    a.sponsorshipReceipt("hash", "alice.testnet", "person_199"),
  );
  tx.receipts_outcome[0].outcome.executor_id = a.worldContract;
  assert.equal(
    (await a.sponsorshipReceipt("hash", "alice.testnet", "person_199")).amount,
    "100000",
  );
  tx.receipts_outcome[0].outcome.status = { Failure: "bad" };
  await assert.rejects(
    a.sponsorshipReceipt("hash", "alice.testnet", "person_199"),
  );
});
