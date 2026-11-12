import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openAgentStore } from "../packages/agent-runtime/store.mjs";
import {
  GENESIS_AGENTS,
  validateGenesis,
} from "../packages/agent-runtime/genesis.mjs";
import { createProfessionalRuntime } from "../packages/agent-runtime/runtime.mjs";
import { verifyAndRender } from "../packages/agent-runtime/tools.mjs";
import { createServiceAuth } from "../packages/agent-sdk/service-auth.mjs";
const input =
  "Please compare supplied supplier records for our neighborhood catering operation. Supplier A quotes 20 units and can deliver on Monday. Supplier B quotes 18 units but has no confirmed delivery date.";
const reply = {
  action: "REPLY",
  message:
    "Please share your requirements and I can evaluate them within my hospitality profession.",
  serviceId: "",
  scope: "",
  input: "",
  priceYocto: "",
  collaborators: [],
};
const proposal = {
  action: "PROPOSE",
  message: "I propose a supplier comparison grounded in your records.",
  serviceId: "procurement-plan",
  scope:
    "Compare the supplied suppliers and identify missing evidence before committing.",
  input,
  priceYocto: "10000000000000000000000",
  collaborators: [],
};
const inference = (fn) => ({
  ready: true,
  name: "explicit-test-provider",
  infer: async (ctx) => ({
    value: await fn(ctx),
    model: "fixture",
    tokens: 20,
  }),
});
const owner = (id) =>
  Promise.resolve({
    ownerId: "owner.testnet",
    reference: "finalized-fixture:" + id,
    network: "testnet",
  });
async function runAll(r) {
  for (let i = 0; i < 8; i++) {
    await r.settle();
    if (!r.jobs().some((j) => j.state === "QUEUED" || j.state === "RUNNING"))
      return;
  }
  throw Error("Queue did not drain");
}

test("Professional Genesis has 24 distinct fixed identities and actual tool mappings", () => {
  assert.equal(GENESIS_AGENTS.length, 24);
  assert.equal(new Set(GENESIS_AGENTS.map((a) => a.biography)).size, 24);
  assert.equal(
    GENESIS_AGENTS.find((a) => a.id === "person_199").profession,
    "hospitality",
  );
  assert.equal(
    GENESIS_AGENTS.find((a) => a.id === "person_042").profession,
    "engineering",
  );
  assert.equal(validateGenesis(), true);
  assert.throws(() =>
    validateGenesis([{ ...GENESIS_AGENTS[0], services: ["website-build"] }]),
  );
});
test("Conversations are durable, independently scoped, idempotent and survive restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "econia-pro-"));
  const path = join(dir, "world.sqlite");
  let calls = 0;
  let s = openAgentStore({ path }),
    r = createProfessionalRuntime({
      store: s,
      inference: inference((ctx) => {
        calls++;
        assert.match(ctx.system, /Mira/);
        return reply;
      }),
      resolveOwnership: owner,
    });
  try {
    const c = await r.conversations.open("person_199", "client.testnet");
    const msg = await r.conversations.send(c.id, "client.testnet", {
      content: input,
      requestId: "durable-message-001",
    });
    assert.equal(
      (
        await r.conversations.send(c.id, "client.testnet", {
          content: input,
          requestId: "durable-message-001",
        })
      ).id,
      msg.id,
    );
    await runAll(r);
    assert.equal(calls, 1);
    assert.equal(
      (await r.conversations.messages(c.id, "client.testnet")).length,
      2,
    );
    await assert.rejects(
      () => r.conversations.messages(c.id, "other.testnet"),
      /not found/,
    );
    await r.close();
    s.close();
    s = openAgentStore({ path });
    r = createProfessionalRuntime({
      store: s,
      inference: inference(() => {
        calls++;
        return reply;
      }),
      resolveOwnership: owner,
    });
    await runAll(r);
    assert.equal(calls, 1);
    assert.equal(
      (await r.conversations.messages(c.id, "client.testnet")).length,
      2,
    );
    assert.throws(
      () =>
        openAgentStore({
          path,
          agents: GENESIS_AGENTS.map((a) =>
            a.id === "person_199"
              ? { ...a, profession: "research", services: ["evidence-brief"] }
              : a,
          ),
        }),
      /Immutable profession/,
    );
  } finally {
    await r.close();
    s.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("NFT transfer revokes prior owner access without giving private conversation or memory to the new owner", async () => {
  const s = openAgentStore({ path: ":memory:" });
  let current = "owner.testnet";
  const r = createProfessionalRuntime({
    store: s,
    inference: inference(() => reply),
    resolveOwnership: async () => ({
      ownerId: current,
      reference: "fixture:" + current,
      network: "testnet",
    }),
  });
  try {
    const c = await r.conversations.open("person_199", current, "OWNER");
    await r.conversations.send(c.id, current, {
      content: "Private owner strategy: secret supplier contract details.",
      requestId: "owner-private-001",
    });
    await runAll(r);
    current = "next.testnet";
    await assert.rejects(
      () => r.conversations.messages(c.id, "owner.testnet"),
      /owner only/,
    );
    const next = await r.conversations.open("person_199", current, "OWNER");
    assert.notEqual(next.id, c.id);
    assert.equal(
      r.memory.retrieve("person_199", { principal: current, owner: true })
        .length,
      0,
    );
    assert.equal(s.professional("person_199").profession, "hospitality");
  } finally {
    await r.close();
    s.close();
  }
});
test("A professional cannot impersonate another profession or start unfunded work", async () => {
  const s = openAgentStore({ path: ":memory:" });
  let calls = 0;
  const r = createProfessionalRuntime({
    store: s,
    inference: inference(() => {
      calls++;
      return { ...proposal, serviceId: "website-build" };
    }),
  });
  try {
    const c = await r.conversations.open("person_199", "client.testnet");
    await r.conversations.send(c.id, "client.testnet", {
      content: input,
      requestId: "unsupported-job-01",
    });
    await runAll(r);
    assert.equal(calls, 1);
    assert.equal(r.jobs()[0].state, "INTERRUPTED");
    assert.equal(r.contracts.list("client.testnet").length, 0);
    await runAll(r);
    assert.equal(calls, 1);
  } finally {
    await r.close();
    s.close();
  }
});
test("Qualified agents independently quote real RFPs without authorizing spending", async () => {
  const s = openAgentStore({ path: ":memory:" });
  const systems = [];
  const r = createProfessionalRuntime({
    store: s,
    inference: inference((ctx) => {
      systems.push(ctx.system);
      return ctx.context?.maxPrice ? {} : reply;
    }),
  });
  await r.close();
  s.close();
  // Explicit separate provider replies demonstrate that the peer actually reasons.
  const t = openAgentStore({ path: ":memory:" });
  let calls = 0;
  const runtime = createProfessionalRuntime({
    store: t,
    inference: inference((ctx) => {
      calls++;
      systems.push(ctx.system);
      if (ctx.context.maxPrice)
        return {
          decision: "QUOTE",
          message:
            "I can build the static storefront, subject to separate approval and testnet funding.",
          scope:
            "Build a self-contained accessible restaurant website from the supplied brief.",
          priceYocto: "30000000000000000000000",
        };
      return {
        ...proposal,
        collaborators: [
          {
            agentId: "person_042",
            serviceId: "website-build",
            reason:
              "Quote a static website for this catering business, with scope and funding separate from this conversation.",
          },
        ],
      };
    }),
  });
  try {
    const c = await runtime.conversations.open("person_199", "client.testnet");
    await runtime.conversations.send(c.id, "client.testnet", {
      content: input,
      requestId: "rfp-qualified-001",
    });
    await runAll(runtime);
    assert.equal(calls, 2);
    assert.ok(systems.some((x) => x.includes("You are Dev")));
    assert.equal(
      t.db.prepare("SELECT state FROM agent_threads").get().state,
      "QUOTED",
    );
    assert.equal(
      t.db.prepare("SELECT count(*) AS n FROM agent_messages").get().n,
      2,
    );
    assert.throws(
      () =>
        runtime.contracts.fundingRequest(
          runtime.contracts.list("client.testnet")[0].id,
          "client.testnet",
        ),
      /subcontract/,
    );
  } finally {
    await runtime.close();
    t.close();
  }
});
test("Feedback produces a private strategy revision retrieved in a subsequent real decision context", async () => {
  const s = openAgentStore({ path: ":memory:" });
  let contextAfterFeedback;
  const r = createProfessionalRuntime({
    store: s,
    inference: inference((ctx) => {
      if (ctx.context.rating)
        return {
          guidance:
            "For this client, verify delivery reliability before recommending the lowest-cost supplier; explicitly request missing schedule evidence.",
          evidenceSummary:
            "The checked comparison missed an important delivery reliability criterion.",
        };
      contextAfterFeedback = ctx.context;
      return reply;
    }),
  });
  try {
    const p = r.contracts.propose({
      customerId: "client.testnet",
      providerId: "person_199",
      serviceId: "procurement-plan",
      scope: proposal.scope,
      input,
      price: proposal.priceYocto,
    });
    s.db
      .prepare(
        "INSERT INTO contracts VALUES('c1',?,'REVIEW_READY',NULL,NULL,'verified-fixture-hash',NULL,?)",
      )
      .run(p.id, s.now());
    const e = r.contracts.evaluate("c1", "client.testnet", {
      rating: 2,
      feedback:
        "The lowest-cost supplier has no confirmed delivery date. Prioritize delivery reliability in the next comparison.",
    });
    await runAll(r);
    assert.equal(r.memory.strategy("person_199", "client.testnet").version, 1);
    assert.match(
      r.memory.strategy("person_199", "client.testnet").guidance,
      /reliability/,
    );
    assert.equal(r.memory.strategy("person_199", "other.testnet").version, 0);
    const c = await r.conversations.open("person_199", "client.testnet");
    await r.conversations.send(c.id, "client.testnet", {
      content: input,
      requestId: "after-feedback-001",
    });
    await runAll(r);
    assert.equal(contextAfterFeedback.strategy.version, 1);
    assert.equal(contextAfterFeedback.strategy.evidence_id, e.id);
    assert.throws(
      () =>
        r.memory.revise("person_042", {
          guidance: "Change based on another agent’s private evaluation.",
          evaluationId: e.id,
        }),
      /verified evaluation/,
    );
  } finally {
    await r.close();
    s.close();
  }
});
test("Generated websites and style boards cannot execute model markup or external code", () => {
  const result = verifyAndRender("website-build", input, {
    title: "<script>alert(1)</script>",
    subtitle: "A useful business website",
    color: "#345678",
    callToAction: "Review details",
    sections: [
      { heading: "About", body: "<img src=x onerror=alert(1)>" },
      { heading: "Services", body: "Planning and catering services" },
      { heading: "Process", body: "Contact details need verification" },
    ],
  });
  assert.ok(!result.files[0].content.includes("<script>"));
  assert.match(result.files[0].content, /&lt;script&gt;/);
  assert.match(result.files[0].content, /default-src 'none'/);
  assert.throws(() =>
    verifyAndRender("design-spec", input, {
      title: "Board",
      palette: ["red", "url(evil)", "blue"],
      principles: ["one", "two"],
      typography: "Readable",
    }),
  );
});
test("Testnet wallet authentication cannot reuse mainnet account namespace or recipient", () => {
  const auth = createServiceAuth({ network: "testnet", provider: {} });
  const c = auth.challenge("user.testnet");
  assert.equal(c.recipient, "econia.services.testnet");
  assert.throws(() => auth.challenge("user.near"), /testnet/);
});
