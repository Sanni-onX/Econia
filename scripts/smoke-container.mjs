import assert from "node:assert/strict";
import { createNativeApplication } from "../apps/api/native-server.mjs";
import { MAINNET_CONTRACT } from "../packages/shared/native-state.mjs";
import { SERVICE_CATALOG } from "../packages/agent-sdk/service-tools.mjs";
import { WORKER_ASSIGNMENTS } from "../packages/agent-sdk/worker-assignments.mjs";
const ids = WORKER_ASSIGNMENTS.map((s) => s.agentId);
const rpc = async (method, p) => {
  if (method === "block")
    return { header: { hash: "container-test-block", height: 1 } };
  const value =
    p.method_name === "custody"
      ? { paused: true, treasuries: "0" }
      : p.method_name === "get_agents"
        ? Object.fromEntries(
            ids.map((id) => [id, { treasury: "0", paused: false }]),
          )
        : ids.map((id) => ({ token_id: id, owner_id: MAINNET_CONTRACT }));
  return { result: [...Buffer.from(JSON.stringify(value))] };
};
const app = await createNativeApplication({ services: true, rpc });
try {
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + app.server.address().port;
  assert.equal((await fetch(url + "/api/health")).status, 200);
  const world = await (await fetch(url + "/api/native/world")).json();
  assert.equal(
    world.agents.filter((a) => a.serviceProfile.active).length,
    WORKER_ASSIGNMENTS.length,
  );
  assert.equal(world.services.backgroundInference, false);
  assert.equal((await fetch(url + "/")).status, 200);
  assert.equal((await fetch(url + "/api/services/tasks")).status, 401);
  console.log(
    "Production container smoke check passed: static app, persistent database, active workforce, authenticated task API. Chain responses are explicit test fixtures.",
  );
} finally {
  await app.close();
}
