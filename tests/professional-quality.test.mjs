import test from "node:test";
import assert from "node:assert/strict";
import { openAgentStore } from "../packages/agent-runtime/store.mjs";
import { createProfessionalRuntime } from "../packages/agent-runtime/runtime.mjs";
import {
  contrastRatio,
  verifyAndRender,
} from "../packages/agent-runtime/tools.mjs";
test("Failed specialist work requires an explicit scoped revision without another payment or automatic inference retry", async () => {
  const store = openAgentStore({ path: ":memory:" });
  let calls = 0;
  const runtime = createProfessionalRuntime({
    store,
    settlement: {
      ready: true,
      verifyFunding: async ({ proposal: p, customer, transactionHash }) => ({
        network: "testnet",
        signer: customer,
        proposalId: p.id,
        agentId: p.provider_id,
        amount: p.total_price,
        jobId: "8",
        hash: transactionHash,
        contract: "fixture.testnet",
        blockHeight: 1,
      }),
    },
    inference: {
      ready: true,
      name: "explicit-quality-fixture",
      infer: async ({ context }) => {
        calls++;
        if (calls === 2) assert.match(context.revisionFeedback, /hex/);
        return {
          value: {
            title: "Practice style board",
            palette:
              calls === 1
                ? ["oat", "green", "charcoal"]
                : ["#304B3B", "#FAF7EF", "#2B2B28"],
            principles: ["Keep clear hierarchy.", "Use readable text."],
            typography: "Georgia headings and a system sans-serif body.",
          },
        };
      },
    },
  });
  try {
    const p = runtime.contracts.propose({
      customerId: "client.testnet",
      providerId: "person_010",
      serviceId: "design-spec",
      scope:
        "Create a coherent style board for the supplied business practice.",
      input:
        "A proposed neighborhood catering practice needs a warm readable visual identity. No photography or new business claims are requested.",
      price: "1",
    });
    const c = await runtime.contracts.confirmFunding(
      p.id,
      "client.testnet",
      "fixture-fund",
    );
    await runtime.settle();
    assert.equal(runtime.jobs()[0].state, "INTERRUPTED");
    assert.equal(calls, 1);
    await runtime.settle();
    assert.equal(calls, 1);
    await assert.rejects(
      () =>
        runtime.contracts.requestRevision(
          c.id,
          "stranger.testnet",
          "Use actual hex colors in the revised palette.",
        ),
      /not found/,
    );
    await runtime.contracts.requestRevision(
      c.id,
      "client.testnet",
      "Use actual hex colors in the revised palette.",
    );
    await assert.rejects(
      () =>
        runtime.contracts.requestRevision(
          c.id,
          "client.testnet",
          "Use actual hex colors in the revised palette.",
        ),
      /interrupted execution/,
    );
    await runtime.settle();
    assert.equal(calls, 2);
    assert.equal(
      runtime.contracts.requireContract(c.id, "client.testnet").state,
      "REVIEW_READY",
    );
    assert.equal(runtime.contracts.artifacts(c.id, "client.testnet").length, 2);
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM ledger_transfers").get().n,
      1,
    );
  } finally {
    await runtime.close();
    store.close();
  }
});
test("Website checks measure contrast and reject source-code reports in place of visitor-facing copy", () => {
  assert.equal(contrastRatio("#000000", "#FFFFFF"), 21);
  const input =
      "A neighborhood practice needs a self-contained website with supplied facts only.",
    value = {
      title: "Practice",
      subtitle: "Digital planning for neighborhood events.",
      color: "#ffffff",
      sections: [
        { heading: "About", body: "Proposed neighborhood practice." },
        { heading: "Services", body: "Digital planning only." },
        { heading: "Process", body: "Share the event brief." },
      ],
      callToAction: "Plan your event",
    };
  assert.throws(
    () => verifyAndRender("website-build", input, value),
    /contrast/,
  );
  assert.throws(
    () =>
      verifyAndRender("website-build", input, {
        ...value,
        color: "#304B3B",
        sections: [
          ...value.sections.slice(0, 2),
          {
            heading: "Deliverable",
            body: "<!doctype html><html>Save this code as index.html.</html>",
          },
        ],
      }),
    /visitor-facing copy/,
  );
});
