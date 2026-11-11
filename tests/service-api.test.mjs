import test from "node:test";
import assert from "node:assert/strict";
import { Account, KeyPair } from "near-api-js";
import { signMessage } from "near-api-js/nep413";
import { createNativeApplication } from "../apps/api/native-server.mjs";
import { createServiceAuth } from "../packages/agent-sdk/service-auth.mjs";
import { createServiceWorkforce } from "../packages/agent-sdk/service-workforce.mjs";
import { MAINNET_CONTRACT } from "../packages/shared/native-state.mjs";
test("Authenticated task API runs a trial with chain settlement paused and protects artifacts", async () => {
  const ids = ["person_199", "person_101", "person_102"],
    roster = ids.map((id) => ({ id, name: id }));
  const rpc = async (method, p) => {
    if (method === "block") return { header: { hash: "fixture", height: 1 } };
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
  const key = KeyPair.fromRandom("ed25519"),
    provider = {
      viewAccessKey: async ({ publicKey }) => {
        assert.equal(publicKey, key.getPublicKey().toString());
        return { permission: "FullAccess" };
      },
    };
  const auth = createServiceAuth({ provider }),
    workforce = createServiceWorkforce({
      path: ":memory:",
      resolveAgent: async () => ({ ownerId: MAINNET_CONTRACT, paused: false }),
      apiKey: "fixture",
      model: "fixture",
      missionPlanProvider: () => ({
        summary: "Delegate exact CSV analysis.",
        steps: [
          {
            key: "s1",
            service: "csv-audit",
            sourceRef: "csv",
            reason: "Check supplied data.",
          },
        ],
      }),
    });
  const app = await createNativeApplication({
    rpc,
    roster,
    workforce,
    serviceAuth: auth,
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + app.server.address().port;
  const send = (path, body, token, origin) =>
    fetch(url + "/api/services/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await fetch(url + "/api/services/tasks")).status, 401);
    assert.equal(
      (
        await send(
          "challenge",
          { accountId: "customer.near" },
          null,
          "https://untrusted.example",
        )
      ).status,
      403,
    );
    const c = await (
      await send("challenge", { accountId: "customer.near" })
    ).json();
    const signed = await signMessage({
      signerAccount: new Account("customer.near", provider, key.toString()),
      payload: {
        message: c.message,
        recipient: c.recipient,
        nonce: Buffer.from(c.nonce, "base64"),
      },
    });
    const session = await (
      await send("login", {
        challengeId: c.id,
        accountId: "customer.near",
        publicKey: key.getPublicKey().toString(),
        signature: Buffer.from(signed.signature).toString("base64"),
      })
    ).json();
    assert.ok(session.token);
    const response = await send(
      "tasks",
      {
        agentId: "person_101",
        requestId: "http-trial-001",
        input: "product,amount\nNotebook,0.10\nPen,0.20\nFolder,0.30",
      },
      session.token,
    );
    assert.equal(response.status, 202);
    const task = await response.json();
    await workforce.execute(task.id);
    const artifactPath = url + "/api/services/tasks/" + task.id + "/artifact";
    assert.equal((await fetch(artifactPath)).status, 401);
    const artifact = await fetch(artifactPath, {
      headers: { Authorization: "Bearer " + session.token },
    });
    assert.equal(artifact.status, 200);
    assert.match(await artifact.text(), /0.6/);
    const accepted = await (
      await send("tasks/" + task.id + "/accept", {}, session.token)
    ).json();
    assert.equal(accepted.status, "ACCEPTED_TRIAL");
    assert.equal(accepted.priceNear, "0");
    assert.equal((await fetch(url + "/api/services/missions")).status, 401);
    const missionResponse = await send(
      "missions",
      {
        goal: "Review this dataset and prepare a checked report.",
        inputs: { csv: "product,amount\nNotebook,0.10\nPen,0.20\nFolder,0.30" },
        maxAiCalls: 1,
        requestId: "http-mission-001",
      },
      session.token,
    );
    const mission = await missionResponse.json();
    assert.equal(missionResponse.status, 202, JSON.stringify(mission));
    await workforce.missions.settle();
    await workforce.missions.settle();
    for (const child of workforce.missions.children(
      "customer.near",
      mission.id,
    ))
      await workforce.execute(child.id);
    await workforce.missions.settle();
    const teamArtifact =
      url + "/api/services/missions/" + mission.id + "/artifact";
    assert.equal((await fetch(teamArtifact)).status, 401);
    const teamDownload = await fetch(teamArtifact, {
      headers: { Authorization: "Bearer " + session.token },
    });
    assert.equal(teamDownload.status, 200);
    assert.match(await teamDownload.text(), /Artifact SHA-256/);
    assert.equal(
      (
        await (
          await send("missions/" + mission.id + "/accept", {}, session.token)
        ).json()
      ).status,
      "ACCEPTED_TRIAL",
    );
  } finally {
    await app.close();
  }
});
