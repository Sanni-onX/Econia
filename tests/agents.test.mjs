import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  NearAIProvider,
  parseDecision,
} from "../packages/agent-sdk/near-ai.mjs";
import { createAgentScheduler } from "../packages/agent-sdk/scheduler.mjs";
import {
  genesis,
  tick,
  assertInvariants,
  view,
} from "../packages/simulation-core/index.mjs";
import { openRepository } from "../packages/database/index.mjs";
import { createApplication } from "../apps/api/server.mjs";
const env = {
  AGENT_MODE: "near-ai",
  AGENT_BATCH_SIZE: "2",
  AGENT_DAILY_CALL_LIMIT: "4",
};
const decision = {
  action: { type: "WORK" },
  reason: "Earn capital before expanding.",
  memory: "Compare earnings before choosing a business.",
  model: "test-model",
  requestId: "test-request",
};

test("NEAR AI validates output and never forwards provider error bodies", async () => {
  let request;
  const provider = new NearAIProvider({
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(decision) },
            },
          ],
          usage: { total_tokens: 17 },
        }),
      );
    },
  });
  const result = await provider.decide({ entity: { id: "person_199" } });
  assert.equal(request.url, "https://cloud-api.near.ai/v1/chat/completions");
  assert.equal(JSON.parse(request.init.body).model, "test-model");
  assert.equal(result.usage.totalTokens, 17);
  assert.throws(() =>
    parseDecision({ ...decision, action: { type: "TRANSFER", amount: 100 } }),
  );
  assert.throws(() =>
    parseDecision({
      ...decision,
      action: { type: "BUY", good: "BREAD", quantity: -1 },
    }),
  );
  assert.throws(() =>
    parseDecision({ ...decision, action: { type: "WORK", cash: 999 } }),
  );
  provider.fetch = async () =>
    new Response("secret-provider-details", { status: 401 });
  await assert.rejects(
    provider.decide({}),
    (error) =>
      !error.message.includes("secret-provider-details") &&
      /401/.test(error.message),
  );
});

test("AI proposals execute through the ledger, retain outcomes and rotate planning slots", async () => {
  const w = genesis();
  let calls = 0;
  const scheduler = createAgentScheduler(env, {
    provider: {
      decide: async () => {
        calls++;
        return decision;
      },
    },
  });
  const p = await scheduler.prepare(w, async () => {});
  const selected = Object.keys(w.agentRuntime.requests);
  tick(w, p);
  scheduler.record(w);
  assert.equal(calls, 2);
  assert.equal(
    w.decisions.filter((d) => d.facts.provider === "near-ai").length,
    2,
  );
  assert.ok(
    w.decisions
      .filter((d) => !selected.includes(d.entityId))
      .every(
        (d) => d.action.type === "WAIT" && d.facts.provider === "scheduler",
      ),
  );
  assert.equal(w.agentRuntime.agents[selected[0]].memory.length, 1);
  await scheduler.prepare(w, async () => {});
  assert.ok(
    Object.keys(w.agentRuntime.requests).every((id) => !selected.includes(id)),
  );
  assert.equal(calls, 4);
  assertInvariants(w);
  assert.equal(view(w).agentRuntime.requests, undefined);
});

test("ready plans survive durable SQLite restart without another billed inference", async () => {
  const dir = await mkdtemp(join(tmpdir(), "econia-ai-"));
  const path = join(dir, "agents.sqlite");
  let repo;
  try {
    repo = await openRepository({ path, url: "" });
    let w = genesis();
    let calls = 0;
    const scheduler = createAgentScheduler(env, {
      provider: {
        decide: async () => {
          calls++;
          return decision;
        },
      },
    });
    await scheduler.prepare(w, () => repo.save(w));
    await repo.close();
    repo = await openRepository({ path, url: "" });
    w = await repo.load();
    const p = await scheduler.prepare(w, () => repo.save(w));
    assert.equal(calls, 2);
    tick(w, p);
    scheduler.record(w);
    await repo.save(w);
    assert.ok(
      Object.values(w.agentRuntime.agents).some((a) => a.memory.length),
    );
    assertInvariants(w);
  } finally {
    await repo?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("changed owner constraints invalidate saved plans instead of replaying stale decisions", async () => {
  const w = genesis();
  const scheduler = createAgentScheduler(env, {
    provider: { decide: async () => decision },
  });
  await scheduler.prepare(w, async () => {});
  const id = Object.keys(w.agentRuntime.requests)[0];
  w.entities[id].policy.reserve++;
  const p = await scheduler.prepare(w, async () => {});
  tick(w, p);
  const d = w.decisions.find((d) => d.entityId === id);
  assert.equal(d.action.type, "WAIT");
  assert.match(d.reason, /changed/);
});

test("uncertain requests after interruption are not billed twice and failures do not fall back to rules", async () => {
  const w = genesis();
  let calls = 0;
  const scheduler = createAgentScheduler(env, {
    provider: {
      decide: async () => {
        calls++;
        throw Error("provider unavailable");
      },
    },
  });
  let durable;
  await assert.rejects(
    scheduler.prepare(w, async () => {
      durable = structuredClone(w);
      throw Error("crash");
    }),
    /crash/,
  );
  assert.equal(calls, 0);
  const p = await scheduler.prepare(durable, async () => {});
  tick(durable, p);
  assert.equal(calls, 0);
  assert.ok(durable.decisions.every((d) => d.action.type === "WAIT"));
  const next = await scheduler.prepare(durable, async () => {});
  tick(durable, next);
  assert.equal(calls, 2);
  assert.ok(durable.decisions.every((d) => d.action.type === "WAIT"));
});

test("request allowance and missing configuration pause planning without invented activity", async () => {
  const w = genesis();
  const missing = createAgentScheduler({ AGENT_MODE: "near-ai" });
  assert.equal(missing.ready, false);
  await assert.rejects(
    missing.prepare(w, async () => {}),
    /not configured/,
  );
  assert.equal(w.cycle, 0);
  const scheduler = createAgentScheduler(
    { ...env, AGENT_DAILY_CALL_LIMIT: "1" },
    { provider: { decide: async () => decision } },
  );
  tick(w, await scheduler.prepare(w, async () => {}));
  await assert.rejects(
    scheduler.prepare(w, async () => {}),
    /allowance/,
  );
  assert.equal(w.cycle, 1);
});

test("unaffordable AI actions are rejected by engine without changing money", async () => {
  const w = genesis();
  const total = w.supply;
  const scheduler = createAgentScheduler(env, {
    provider: {
      decide: async () => ({
        ...decision,
        action: {
          type: "CREATE_BUSINESS",
          industry: "FOOD",
          capital: 999999999,
        },
      }),
    },
  });
  tick(w, await scheduler.prepare(w, async () => {}));
  assert.ok(
    w.decisions
      .filter((d) => d.facts.provider === "near-ai")
      .every((d) => d.status === "REJECTED"),
  );
  assert.equal(w.supply, total);
  assertInvariants(w);
});

test("API advances AI cycles atomically and exposes source without raw planning contexts", async () => {
  let saved;
  const repository = {
    kind: "memory-test",
    load: async () => null,
    save: async (w) => {
      saved = structuredClone(w);
    },
    close: async () => {},
  };
  const scheduler = createAgentScheduler(env, {
    provider: { decide: async () => decision },
  });
  const app = await createApplication({
    repository,
    agentScheduler: scheduler,
    autoTick: false,
    quiet: true,
  });
  try {
    await app.advance(1);
    assert.equal(app.world.cycle, 1);
    assert.equal(saved.agentRuntime.budget.calls, 2);
    assert.ok(saved.decisions.some((d) => d.facts.provider === "near-ai"));
    assert.equal(view(saved).agentRuntime.requests, undefined);
    assert.equal(JSON.stringify(saved).includes("test-key"), false);
    assertInvariants(saved);
  } finally {
    await app.close();
  }
});

test("billing failure pauses the economy and backs off instead of repeating blocked requests", async () => {
  const w = genesis();
  let calls = 0;
  const scheduler = createAgentScheduler(env, {
    provider: {
      decide: async () => {
        calls++;
        throw Object.assign(new Error("billing"), {
          code: "AI_BILLING_REQUIRED",
        });
      },
    },
  });
  await assert.rejects(
    scheduler.prepare(w, async () => {}),
    /credits/,
  );
  assert.equal(w.cycle, 0);
  assert.equal(calls, 2);
  const recovered = structuredClone(w);
  await assert.rejects(
    scheduler.prepare(recovered, async () => {}),
    /credits/,
  );
  assert.equal(calls, 2);
  assert.equal(recovered.agentRuntime.budget.calls, 2);
});
