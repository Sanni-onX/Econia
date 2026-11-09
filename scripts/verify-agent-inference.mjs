// One bounded, paid inference request against an isolated local fixture.
// Does not touch the running world, wallets, contracts or testnet balances.
import { writeFileSync } from "node:fs";
import { createAgentScheduler } from "../packages/agent-sdk/scheduler.mjs";
import {
  genesis,
  tick,
  assertInvariants,
} from "../packages/simulation-core/index.mjs";

const scheduler = createAgentScheduler({
  ...process.env,
  AGENT_MODE: "near-ai",
  AGENT_BATCH_SIZE: "1",
  AGENT_DAILY_CALL_LIMIT: "1",
});
const world = genesis();
try {
  const prepared = await scheduler.prepare(world, async () => {});
  tick(world, prepared);
  scheduler.record(world);
  assertInvariants(world);
  const result = world.decisions.find((d) => d.facts.provider === "near-ai");
  if (!result) throw new Error("No valid live AI proposal was returned.");
  const report = {
    verifiedAt: new Date().toISOString(),
    scope:
      "One live NEAR AI request in an isolated sandbox; not testnet settlement",
    model: result.facts.inference.model,
    requestId: result.facts.inference.requestId,
    contextHash: result.facts.inference.contextHash,
    usage: result.facts.inference.usage,
    entityId: result.entityId,
    action: result.action,
    reason: result.reason,
    executionStatus: result.status,
    result: result.result,
    balanced: true,
  };
  writeFileSync(
    "docs/near-ai-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(
    error.code === "AGENT_PROVIDER_BLOCKED"
      ? error.message
      : "Live NEAR AI verification did not complete. No credential or provider body is included in this diagnostic.",
  );
  process.exitCode = 1;
}
