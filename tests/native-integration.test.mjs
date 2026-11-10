import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatNear,
  readNativeState,
} from "../packages/shared/native-state.mjs";
import {
  createNativePlanner,
  parseNativePlan,
} from "../packages/agent-sdk/native-planner.mjs";
import { createNativeApplication } from "../apps/api/native-server.mjs";
import { createApplication } from "../apps/api/server.mjs";
const roster = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
];
test("Mainnet startup retires virtual roles and creates no automatic AI worker", async () => {
  const previous = process.env.SETTLEMENT_MODE;
  process.env.SETTLEMENT_MODE = "mainnet";
  let app;
  try {
    app = await createApplication({ rpc: rpcFor(), roster });
    assert.equal(app.world.plans.enabled, false);
    assert.equal(app.world.plans.dailyLimit, 0);
    assert.equal(app.world.intelligence.mode, "idle");
    assert.equal(app.world.agents[0].role, "Unassigned");
    await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  } finally {
    if (app) await app.close();
    if (previous === undefined) delete process.env.SETTLEMENT_MODE;
    else process.env.SETTLEMENT_MODE = previous;
  }
});
function rpcFor(treasury = "0", paused = true) {
  return async (method, p) => {
    if (method === "block")
      return { header: { hash: "finalized-block", height: 123 } };
    if (p.request_type === "view_account") return { amount: "1" };
    assert.equal(p.block_id, "finalized-block");
    const value =
      p.method_name === "custody"
        ? { paused, treasuries: treasury }
        : p.method_name === "get_agents"
          ? { a: { treasury, capital_received: treasury, paused: false } }
          : [{ token_id: "a", owner_id: "owner.near" }];
    return { result: [...Buffer.from(JSON.stringify(value))] };
  };
}
test("Native balances remain exact and all reads use one final block", async () => {
  assert.equal(
    formatNear("1000000000000000000000001"),
    "1.000000000000000000000001",
  );
  const world = await readNativeState({
    rpc: rpcFor("1000000000000000000000001"),
    roster,
  });
  assert.equal(world.agents[0].treasuryNear, "1.000000000000000000000001");
  assert.equal(world.agents[0].status, "World paused");
  assert.equal(world.agents[1].status, "Awaiting commissioning");
});
test("Native read refuses unreconciled treasury records", async () => {
  const rpc = rpcFor("9");
  await assert.rejects(
    readNativeState({
      roster,
      rpc: async (m, p) =>
        p.method_name === "custody"
          ? { result: [...Buffer.from('{"treasuries":"0","paused":false}')] }
          : rpc(m, p),
    }),
    /reconciliation/,
  );
});
test("Native AI plans cannot invent counterparties", () => {
  assert.throws(
    () =>
      parseNativePlan(
        { plan: "Hire", counterpartyId: "unknown", message: "Hello" },
        ["a"],
      ),
    /Invalid/,
  );
});
test("Native worker persists its budget before inference; restart does not repeat a call", async () => {
  const dir = await mkdtemp(join(tmpdir(), "econia-native-"));
  try {
    let calls = 0;
    const path = join(dir, "plans.json");
    const fetchImpl = async () => {
      calls++;
      return { ok: false, status: 402 };
    };
    const world = {
      verifiedAt: new Date().toISOString(),
      custody: { paused: true },
      agents: roster.map((a) => ({ ...a, token: {}, paused: false })),
    };
    const opts = { path, apiKey: "test", model: "test", fetchImpl, limit: 1 };
    await (await createNativePlanner(opts)).run(world);
    const restarted = await createNativePlanner(opts);
    await restarted.run(world);
    assert.equal(calls, 1);
    assert.match(restarted.publicState().issue, /402/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Mainnet API excludes legacy writes and refuses capital while paused", async () => {
  const app = await createNativeApplication({ rpc: rpcFor(), roster });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + app.server.address().port;
  try {
    assert.equal(
      (await (await fetch(url + "/api/config")).json()).asset,
      "NEAR",
    );
    assert.equal(
      (await fetch(url + "/api/transactions/prepare", { method: "POST" }))
        .status,
      404,
    );
    assert.equal(
      (await fetch(url + "/api/native/capital?agent=a&amount=1")).status,
      503,
    );
  } finally {
    await app.close();
  }
});
test("Native wallet preparation uses exact deposits and checks mainnet transfer recipients", async () => {
  const app = await createNativeApplication({
    rpc: rpcFor("0", false),
    roster,
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + app.server.address().port;
  try {
    const tx = await (
      await fetch(
        url + "/api/native/capital?agent=a&amount=0.000000000000000000000001",
      )
    ).json();
    assert.equal(tx.actions[0].params.deposit, "1");
    assert.equal(tx.actions[0].params.methodName, "provide_capital");
    assert.equal(
      (await fetch(url + "/api/native/transfer?agent=a&receiver=wrong.testnet"))
        .status,
      503,
    );
    const transfer = await (
      await fetch(url + "/api/native/transfer?agent=a&receiver=next.near")
    ).json();
    assert.equal(transfer.actions[0].params.deposit, "1");
    assert.equal(transfer.actions[0].params.args.receiver_id, "next.near");
  } finally {
    await app.close();
  }
});
