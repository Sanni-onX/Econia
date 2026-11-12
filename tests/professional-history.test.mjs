import test from "node:test";
import assert from "node:assert/strict";
import { openAgentStore } from "../packages/agent-runtime/store.mjs";
import { createProfessionalApplication } from "../apps/api/professional-server.mjs";
test("Finalized public work observations survive restart without inventing private contracts, receipts or payments", async () => {
  const store = openAgentStore({ path: ":memory:" }),
    chain = {
      contract: "fixture.testnet",
      ready: false,
      readJobPage: async (from) =>
        from === 0
          ? [
              {
                id: 0,
                blockHash: "explicit-finalized-fixture",
                job: {
                  state: "SETTLED",
                  buyer_agent: "person_199",
                  allocations: [
                    {
                      agent_id: "person_042",
                      service_id: "website-build",
                      evidence: "a".repeat(64),
                    },
                  ],
                },
              },
            ]
          : [],
    };
  let app = await createProfessionalApplication({
    store,
    settlement: chain,
    inference: { ready: false },
  });
  try {
    let world = app.publicWorld();
    assert.equal(world.events.length, 2);
    assert.ok(
      world.agents
        .find((a) => a.id === "person_042")
        .publicHistory.some((h) => h.type === "ONCHAIN_WORK_COMPLETED"),
    );
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM ledger_transfers").get().n,
      0,
    );
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM receipts").get().n,
      0,
    );
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM contracts").get().n,
      0,
    );
    await app.close();
    app = await createProfessionalApplication({
      store,
      settlement: chain,
      inference: { ready: false },
    });
    world = app.publicWorld();
    assert.equal(world.events.length, 2);
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM chain_job_observations").get().n,
      1,
    );
    assert.ok(!JSON.stringify(world).includes("response_json"));
  } finally {
    await app.close();
    store.close();
  }
});
