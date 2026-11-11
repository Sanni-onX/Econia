import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServiceWorkforce } from "../packages/agent-sdk/service-workforce.mjs";
import { MAINNET_CONTRACT } from "../packages/shared/native-state.mjs";
import {
  missionSources,
  validateMissionPlan,
} from "../packages/agent-sdk/mission-planner.mjs";
const source =
  "Customer work starts with a specific goal. Specialists share the workload and verify evidence before releasing a deliverable. ".repeat(
    60,
  );
const csv = "product,amount\nNotebook,0.10\nPen,0.20\nFolder,0.30";
const resolveAgent = async () => ({ ownerId: MAINNET_CONTRACT, paused: false });
function planner({ refs }) {
  return {
    summary:
      "Commission the specialists, verify each output, then assemble their results.",
    steps: Object.entries(refs).map(([ref, r], i) => ({
      key: "s" + (i + 1),
      service: r.services[0],
      sourceRef: ref,
      reason: "Cover this supplied input without redundant work.",
    })),
  };
}
const mockInference = async (_url, request) => {
  const body = JSON.parse(request.body),
    context = JSON.parse(body.messages[1].content);
  return {
    ok: true,
    text: async () =>
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                findings: [
                  {
                    heading: "Supported finding",
                    sourceId: context.sources[0].id,
                    quote: context.sources[0].text.slice(0, 150),
                  },
                ],
              }),
            },
          },
        ],
        usage: { total_tokens: 100 },
      }),
  };
};
async function drain(w, id) {
  for (let n = 0; n < 12; n++) {
    await w.missions.settle();
    await Promise.all(
      w
        .list("customer.near")
        .filter((t) => t.status === "QUEUED")
        .map((t) => w.execute(t.id)),
    );
    await w.missions.settle();
    const m = w.missions.get("customer.near", id);
    if (["REVIEW_READY", "NEEDS_ATTENTION", "INTERRUPTED"].includes(m.status))
      return m;
  }
  throw Error("Mission did not settle");
}
test("Large documents split into bounded work and require complete budgeted source coverage", () => {
  const refs = missionSources({ source });
  assert.ok(Object.keys(refs).length > 1);
  assert.ok(Object.values(refs).every((r) => r.input.length <= 4000));
  assert.throws(
    () =>
      validateMissionPlan(
        {
          summary: "Partial",
          steps: [
            {
              key: "s1",
              service: "source-brief",
              sourceRef: Object.keys(refs)[0],
              reason: "Only first",
            },
          ],
        },
        refs,
        6,
      ),
    /omitted/,
  );
  assert.throws(
    () => validateMissionPlan(planner({ refs }), refs, 1),
    /budget/,
  );
});
test("An AI-planned goal delegates across replicas, reserves once and delivers a hashed team report", async () => {
  let plans = 0,
    calls = 0;
  const w = createServiceWorkforce({
    path: ":memory:",
    resolveAgent,
    apiKey: "test",
    model: "test",
    missionPlanProvider: (ctx) => {
      plans++;
      return planner(ctx);
    },
    fetchImpl: async (...a) => {
      calls++;
      return mockInference(...a);
    },
  });
  try {
    const body = {
      goal: "Create a complete evidence brief of this document by sharing its sections between specialists.",
      inputs: { source },
      requestId: "team-document-001",
      maxAiCalls: 4,
    };
    const m = await w.missions.submit("customer.near", body);
    assert.equal((await w.missions.submit("customer.near", body)).id, m.id);
    const done = await drain(w, m.id);
    assert.equal(done.status, "REVIEW_READY", done.error);
    assert.equal(plans, 1);
    assert.equal(calls, Object.keys(m.refs).length);
    assert.equal(w.status().aiCallsReserved, 4);
    assert.equal(w.status().tasksReserved, 8);
    const kids = w.missions.children("customer.near", m.id);
    assert.ok(new Set(kids.map((t) => t.agentId)).size > 1);
    assert.ok(
      kids.every(
        (t) => t.requestedByAgent === "person_107" && t.parentId === m.id,
      ),
    );
    assert.match(done.output.artifact, /Artifact SHA-256/);
    assert.equal(done.assembler, "person_115");
    assert.equal(
      w.missions.accept("customer.near", m.id).status,
      "ACCEPTED_TRIAL",
    );
    assert.throws(() => w.missions.get("stranger.near", m.id), /not found/);
    assert.ok(!JSON.stringify(w.status().activity).includes("customer.near"));
  } finally {
    await w.close();
  }
});
test("A worker cannot execute concurrent jobs and paid inference is not duplicated", async () => {
  let release, started;
  const gate = new Promise((r) => (release = r)),
    start = new Promise((r) => (started = r));
  let calls = 0;
  const w = createServiceWorkforce({
    path: ":memory:",
    resolveAgent,
    apiKey: "test",
    model: "test",
    fetchImpl: async (...args) => {
      calls++;
      started();
      await gate;
      return mockInference(...args);
    },
  });
  try {
    const a = await w.submit("customer.near", {
        agentId: "person_199",
        input: source.slice(0, 500),
        requestId: "single-worker-001",
      }),
      b = await w.submit("customer.near", {
        agentId: "person_199",
        input: source.slice(0, 500),
        requestId: "single-worker-002",
      });
    const running = w.execute(a.id);
    await start;
    await w.execute(b.id);
    assert.equal(w.task("customer.near", b.id).status, "QUEUED");
    assert.equal(calls, 1);
    release();
    await running;
    await w.execute(b.id);
    assert.equal(calls, 2);
  } finally {
    release();
    await w.close();
  }
});
test("An invalid coordinator proposal is held without creating specialist tasks or retrying inference", async () => {
  let plans = 0;
  const w = createServiceWorkforce({
    path: ":memory:",
    resolveAgent,
    apiKey: "test",
    model: "test",
    missionPlanProvider: () => {
      plans++;
      return {
        summary: "Unsupported",
        steps: [
          {
            key: "s1",
            service: "shell-execution",
            sourceRef: "csv",
            reason: "No",
          },
        ],
      };
    },
  });
  try {
    const m = await w.missions.submit("customer.near", {
      goal: "Analyse the supplied CSV and produce a checked report.",
      inputs: { csv },
      requestId: "invalid-team-001",
      maxAiCalls: 1,
    });
    await w.missions.settle();
    await w.missions.settle();
    assert.equal(w.missions.get("customer.near", m.id).status, "INTERRUPTED");
    assert.equal(plans, 1);
    assert.equal(w.list("customer.near").length, 0);
  } finally {
    await w.close();
  }
});
test("Checked missions and reservations survive restart without more planning or inference", async () => {
  const dir = await mkdtemp(join(tmpdir(), "econia-team-"));
  let plans = 0;
  const opts = {
    path: join(dir, "team.sqlite"),
    resolveAgent,
    apiKey: "test",
    model: "test",
    missionPlanProvider: (ctx) => {
      plans++;
      return planner(ctx);
    },
  };
  let w = createServiceWorkforce(opts);
  try {
    const m = await w.missions.submit("customer.near", {
      goal: "Analyse the supplied data and deliver a checked customer report.",
      inputs: { csv },
      requestId: "restart-team-001",
      maxAiCalls: 1,
    });
    assert.equal((await drain(w, m.id)).status, "REVIEW_READY");
    await w.close();
    w = createServiceWorkforce(opts);
    await w.missions.settle();
    assert.equal(plans, 1);
    assert.equal(w.missions.get("customer.near", m.id).status, "REVIEW_READY");
    assert.equal(w.status().aiCallsReserved, 1);
  } finally {
    await w.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("Approved autonomy only commissions a follow-up on account changes within its budget", async () => {
  let clock = Date.UTC(2026, 10, 11),
    amount = "2000000000000000000000000",
    plans = 0;
  const rpc = async (method, p) => {
    if (method === "block")
      return { header: { hash: "watch-block", height: 99 } };
    if (method === "EXPERIMENTAL_protocol_config")
      return {
        runtime_config: { storage_amount_per_byte: "10000000000000000000" },
      };
    const block = { block_hash: "watch-block", block_height: 99 };
    return p.request_type === "view_account"
      ? {
          ...block,
          amount,
          locked: "0",
          storage_usage: 100,
          code_hash: "11111111111111111111111111111111",
        }
      : { ...block, keys: [] };
  };
  const w = createServiceWorkforce({
    path: ":memory:",
    resolveAgent,
    apiKey: "test",
    model: "test",
    web3Rpc: rpc,
    now: () => clock,
    missionPlanProvider: (ctx) => {
      plans++;
      return planner(ctx);
    },
  });
  try {
    const m = await w.missions.submit("customer.near", {
      goal: "Monitor this account and create a new checked account report when it changes.",
      inputs: { accounts: ["account.near"] },
      requestId: "watch-team-001",
      maxAiCalls: 1,
      autonomy: true,
    });
    assert.equal((await drain(w, m.id)).status, "REVIEW_READY");
    clock += 1800000;
    await w.missions.settle();
    assert.equal(plans, 1);
    assert.equal(w.missions.list("customer.near").length, 1);
    amount = "3000000000000000000000000";
    clock += 1800000;
    await w.missions.settle();
    assert.equal(w.missions.list("customer.near").length, 2);
    await w.missions.settle();
    assert.equal(plans, 2);
    w.missions.stopWatch("customer.near", m.id);
    assert.equal(w.missions.get("customer.near", m.id).watch.enabled, false);
  } finally {
    await w.close();
  }
});
