import { createHash } from "node:crypto";
import { catalog } from "../economy/index.mjs";
import { NearAIProvider, parseDecision } from "./near-ai.mjs";

const integer = (value, fallback, min, max) => {
  const n = Number(value ?? fallback);
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw new Error("Invalid agent runtime limit");
  return n;
};
export function createAgentScheduler(env = process.env, overrides = {}) {
  const mode = env.AGENT_MODE || "rules";
  if (mode === "rules") return null;
  if (mode !== "near-ai") throw new Error("Unsupported AGENT_MODE");
  const config = {
    batchSize: integer(env.AGENT_BATCH_SIZE, 4, 1, 100),
    dailyCalls: integer(env.AGENT_DAILY_CALL_LIMIT, 240, 1, 10000),
    maxTokens: integer(env.NEAR_AI_MAX_TOKENS, 1200, 128, 8000),
  };
  const ready = Boolean(
    overrides.provider || (env.NEAR_AI_API_KEY && env.NEAR_AI_MODEL),
  );
  const provider =
    overrides.provider ||
    (ready
      ? new NearAIProvider({
          apiKey: env.NEAR_AI_API_KEY,
          model: env.NEAR_AI_MODEL,
          maxTokens: config.maxTokens,
        })
      : null);
  const now = overrides.now || (() => new Date());
  return {
    mode,
    ready,
    config,
    async prepare(world, persist) {
      if (!ready)
        throw Object.assign(
          new Error("NEAR AI is not configured; agent decisions are paused"),
          { code: "AGENT_CONFIG_REQUIRED" },
        );
      const cycle = world.cycle + 1;
      const day = now().toISOString().slice(0, 10);
      const runtime = (world.agentRuntime ||= {
        mode,
        agents: {},
        budget: { day, calls: 0 },
      });
      runtime.mode = mode;
      if (runtime.retryAfter && now().getTime() < runtime.retryAfter)
        throw Object.assign(new Error(runtime.issue), {
          code: "AGENT_PROVIDER_BLOCKED",
        });
      if (runtime.retryAfter) {
        runtime.retryAfter = null;
        runtime.issue = null;
        runtime.targetCycle = null;
      }
      if (runtime.budget.day !== day) runtime.budget = { day, calls: 0 };
      const entities = Object.values(world.entities).filter(
        (e) =>
          e.capabilities.includes("WORK") || e.capabilities.includes("PRODUCE"),
      );
      for (const e of entities)
        runtime.agents[e.id] ||= {
          id: e.id,
          status: "WAITING",
          lastScheduledCycle: -1,
          memory: [],
        };
      // A prepared cycle is immutable and survives a crash. Never submit an
      // uncertain RUNNING request twice: inference may already have been billed.
      if (runtime.targetCycle !== cycle) {
        if (runtime.budget.calls >= config.dailyCalls)
          throw Object.assign(
            new Error(
              "Daily NEAR AI request allowance reached; agent decisions are paused",
            ),
            { code: "AGENT_BUDGET_EXHAUSTED" },
          );
        runtime.targetCycle = cycle;
        runtime.requests = {};
        const selected = entities
          .filter((e) => e.status === "ACTIVE")
          .sort(
            (a, b) =>
              runtime.agents[a.id].lastScheduledCycle -
                runtime.agents[b.id].lastScheduledCycle ||
              a.id.localeCompare(b.id),
          )
          .slice(
            0,
            Math.min(
              config.batchSize,
              config.dailyCalls - runtime.budget.calls,
            ),
          );
        for (const e of selected) {
          const state = runtime.agents[e.id];
          state.lastScheduledCycle = cycle;
          state.status = "THINKING";
          const context = decisionContext(world, e, state.memory, cycle);
          runtime.requests[e.id] = {
            status: "RUNNING",
            contextHash: digest(context),
            context,
          };
          runtime.budget.calls++;
        }
        await persist();
        const results = await Promise.all(
          selected.map(async (e) => {
            const request = runtime.requests[e.id];
            try {
              const raw = await provider.decide(
                structuredClone(request.context),
              );
              const result = {
                ...parseDecision(raw),
                model: raw.model || "configured-provider",
                requestId: raw.requestId || null,
                usage: raw.usage || { totalTokens: 0 },
              };
              return [e.id, { status: "READY", result }];
            } catch (error) {
              return [
                e.id,
                {
                  status: "FAILED",
                  code: ["AI_BILLING_REQUIRED", "AI_AUTH_REQUIRED"].includes(
                    error.code,
                  )
                    ? error.code
                    : null,
                  error:
                    "Inference failed or returned an invalid decision; no rule fallback was used.",
                },
              ];
            }
          }),
        );
        for (const [id, result] of results) {
          Object.assign(runtime.requests[id], result);
          runtime.agents[id].status = result.status;
        }
        await persist();
        const blocked = results.find(([, result]) => result.code);
        if (blocked) {
          runtime.issue =
            blocked[1].code === "AI_BILLING_REQUIRED"
              ? "NEAR AI requires usable account credits; agent decisions are paused."
              : "NEAR AI credentials were rejected; agent decisions are paused.";
          runtime.retryAfter = now().getTime() + 5 * 60 * 1000;
          await persist();
          throw Object.assign(new Error(runtime.issue), {
            code: "AGENT_PROVIDER_BLOCKED",
          });
        }
      } else {
        for (const [id, request] of Object.entries(runtime.requests))
          if (request.status === "RUNNING") {
            request.status = "FAILED";
            request.error =
              "Interrupted inference was not replayed; no rule fallback was used.";
            runtime.agents[id].status = "FAILED";
          }
        for (const [id, request] of Object.entries(runtime.requests)) {
          if (
            request.status === "READY" &&
            (!world.entities[id] ||
              request.contextHash !==
                digest(
                  decisionContext(
                    world,
                    world.entities[id],
                    runtime.agents[id].memory,
                    cycle,
                  ),
                ))
          ) {
            request.status = "FAILED";
            request.error =
              "World or owner constraints changed after planning; waiting for a new decision.";
            runtime.agents[id].status = "FAILED";
          }
        }
        await persist();
      }
      // The economic engine revalidates all proposals against live state.
      return {
        name: mode,
        strict: true,
        decide({ entity }) {
          const request = runtime.requests[entity.id];
          if (request?.status === "READY")
            return {
              ...request.result,
              evidence: {
                provider: mode,
                model: request.result.model,
                requestId: request.result.requestId,
                contextHash: request.contextHash,
                usage: request.result.usage,
                plannedCycle: cycle,
              },
            };
          return {
            action: { type: "WAIT" },
            reason:
              request?.error ||
              "Waiting for an AI planning slot; no rule-generated action was substituted.",
            evidence: { provider: "scheduler", plannedCycle: cycle },
          };
        },
      };
    },
    record(world) {
      const runtime = world.agentRuntime;
      if (!runtime) return;
      for (const d of world.decisions.filter((d) => d.cycle === world.cycle)) {
        const request = runtime.requests[d.entityId];
        const state = runtime.agents[d.entityId];
        if (!state || request?.status !== "READY") continue;
        state.status = d.status === "REJECTED" ? "REJECTED" : "ACTIVE";
        state.lastDecisionCycle = world.cycle;
        state.model = request.result.model;
        state.memory.push({
          cycle: world.cycle,
          action: d.action,
          status: d.status,
          result: d.result,
          note: request.result.memory,
        });
        state.memory = state.memory.slice(-12);
      }
    },
  };
}
function digest(context) {
  return createHash("sha256").update(JSON.stringify(context)).digest("hex");
}
function decisionContext(world, e, memory, cycle) {
  const {
    id,
    name,
    type,
    goal,
    cash,
    policy,
    inventory,
    skills,
    traits,
    reputation,
    capabilities,
    equipment,
    industry,
    status,
  } = e;
  return {
    entity: {
      id,
      name,
      type,
      goal,
      cash,
      policy,
      inventory,
      skills,
      traits,
      reputation,
      capabilities,
      equipment,
      industry,
      status,
    },
    cycle,
    memory,
    prices: world.prices,
    recipes: catalog.recipes,
    jobs: world.jobs,
    holdings: world.holdings,
    relationships: world.relationships
      .filter((r) => r.from === id || r.to === id)
      .slice(-30),
    counterparties: Object.values(world.entities)
      .filter(
        (x) => x.id !== id && (x.type === "PERSON" || x.type === "BUSINESS"),
      )
      .map((x) => ({
        id: x.id,
        name: x.name,
        type: x.type,
        status: x.status,
        inventory: x.inventory,
        skills: x.skills,
        reputation: x.reputation,
      })),
    constraints:
      "One action per planning slot. HIRE requires an unemployed worker and 18000 cash. CREATE_BUSINESS requires capability, owner permission, founder skill, at least 75000 capital, no existing business holding and minimum reserve. BUY preserves reserve. WORK earns the existing contract wage or a funded public shift. PRODUCE is constrained by recipe, inventory, staff, equipment and reserve. WAIT is permitted.",
  };
}
