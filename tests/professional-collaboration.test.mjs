import test from "node:test";
import assert from "node:assert/strict";
import { openAgentStore } from "../packages/agent-runtime/store.mjs";
import { createProfessionalRuntime } from "../packages/agent-runtime/runtime.mjs";
test("Nested accepted quotations fund one manifest, run dependencies first and settle exact provider totals", async () => {
  const s = openAgentStore({ path: ":memory:" });
  const chain = {
    ready: true,
    prepareFunding: (p) => p,
    verifyFunding: async ({ proposal: p, transactionHash, customer }) => ({
      network: "testnet",
      signer: customer,
      proposalId: p.id,
      agentId: p.provider_id,
      amount: p.total_price,
      jobId: "1",
      hash: transactionHash,
      contract: "fixture.testnet",
      blockHeight: 1,
    }),
    verifyAcceptance: async ({ contract: c, customer, transactionHash }) => {
      assert.equal(c.evidence.length, 3);
      assert.ok(c.evidence.every((h) => /^[a-f0-9]{64}$/.test(h)));
      return {
        network: "testnet",
        signer: customer,
        jobId: c.chain_job_id,
        hash: transactionHash,
        contract: "fixture.testnet",
        blockHeight: 2,
      };
    },
  };
  const r = createProfessionalRuntime({
    store: s,
    settlement: chain,
    inference: {
      ready: true,
      name: "explicit-review-fixture",
      infer: async () => ({
        value: {
          decision: "ACCEPT",
          reason:
            "All three independently quoted CSV reviews have distinct assigned review scopes.",
        },
      }),
    },
  });
  try {
    const input = "product,amount\nNotebook,0.10\nPen,0.20\nFolder,0.30";
    const p = r.contracts.propose({
      customerId: "client.testnet",
      providerId: "person_017",
      serviceId: "csv-audit",
      scope:
        "Audit all supplied decimal quantities and produce an exact overview.",
      input,
      price: "5",
    });
    const first = r.collaboration.request({
      proposalId: p.id,
      buyer: "person_017",
      provider: "person_018",
      service: "csv-audit",
      reason: "Independently inspect the supplied numeric columns for errors.",
    });
    r.collaboration.recordQuotation(
      first,
      {
        decision: "QUOTE",
        message: "I can independently inspect numeric columns.",
        scope: "Inspect numeric columns and produce an exact decimal review.",
        priceYocto: "3",
      },
      [
        {
          agentId: "person_019",
          serviceId: "csv-audit",
          reason:
            "Inspect supplied rows for missing values and give exact statistics.",
        },
      ],
    );
    const child = r.collaboration
      .quotes(p.id)
      .find((q) => q.parent_thread === first);
    r.collaboration.recordQuotation(child.id, {
      decision: "QUOTE",
      message: "I can inspect the supplied rows.",
      scope:
        "Inspect rows for missing data and provide exact decimal statistics.",
      priceYocto: "2",
    });
    // Quotations above explicitly model completed provider turns, not live inference.
    s.db
      .prepare(
        "UPDATE runtime_jobs SET state='COMPLETED' WHERE kind='NEGOTIATE'",
      )
      .run();
    await r.settle();
    assert.equal(
      r.contracts.fundingRequest(p.id, "client.testnet").total_price,
      "10",
    );
    const c = await r.contracts.confirmFunding(
      p.id,
      "client.testnet",
      "fixture-fund",
    );
    const graph = s.db
      .prepare("SELECT * FROM contract_allocations ORDER BY allocation_index")
      .all();
    assert.equal(graph.length, 3);
    assert.equal(
      r.jobs().filter((j) => j.kind === "EXECUTE" && j.state === "QUEUED")
        .length,
      1,
    );
    for (let i = 0; i < 3; i++) await r.settle();
    assert.equal(
      r.contracts.requireContract(c.id, "client.testnet").state,
      "REVIEW_READY",
    );
    const completed = r.jobs().filter((j) => j.kind === "EXECUTE");
    assert.equal(completed.length, 3);
    assert.ok(completed.every((j) => j.state === "COMPLETED"));
    assert.equal(r.contracts.artifacts(c.id, "client.testnet").length, 6);
    await assert.rejects(
      () =>
        r.contracts.confirmAcceptance(
          graph[1].contract_id,
          "client.testnet",
          "invalid-child-accept",
        ),
      /Checked delivery/,
    );
    await r.contracts.confirmAcceptance(
      c.id,
      "client.testnet",
      "fixture-accept",
    );
    const rows = s.db
      .prepare("SELECT * FROM ledger_transfers ORDER BY rowid")
      .all();
    assert.deepEqual(
      rows.map((t) => t.amount),
      ["10", "5", "3", "2"],
    );
    assert.ok(
      s.db
        .prepare("SELECT state FROM contracts")
        .all()
        .every((c) => c.state === "SETTLED"),
    );
    await r.contracts.confirmAcceptance(
      c.id,
      "client.testnet",
      "fixture-accept",
    );
    assert.equal(
      s.db.prepare("SELECT count(*) n FROM ledger_transfers").get().n,
      4,
    );
  } finally {
    await r.close();
    s.close();
  }
});
