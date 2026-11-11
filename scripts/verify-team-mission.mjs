import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { JsonRpcProvider } from "near-api-js";
import { createServiceWorkforce } from "../packages/agent-sdk/service-workforce.mjs";
import { MAINNET_CONTRACT } from "../packages/shared/native-state.mjs";
const rpc = new JsonRpcProvider({
  url: process.env.NEAR_MAINNET_RPC_URL || "https://free.rpc.fastnear.com",
});
const w = createServiceWorkforce({
  path: ".data/team-commissioning.sqlite",
  resolveAgent: async (id) => {
    const t = await rpc.callFunction({
      contractId: MAINNET_CONTRACT,
      method: "nft_token",
      args: { token_id: id },
    });
    const a = await rpc.callFunction({
      contractId: MAINNET_CONTRACT,
      method: "get_agent",
      args: { agent_id: id },
    });
    return t && a ? { ownerId: t.owner_id, paused: a.paused } : null;
  },
});
try {
  const m = await w.missions.submit(MAINNET_CONTRACT, {
    goal: "Prepare a factual Econia project review: inspect the project account and contract, verify Mira NFT ownership, and reconcile the wrapped NEAR balance. Delegate each supplied target to the appropriate specialist and combine their evidence.",
    inputs: {
      accounts: [MAINNET_CONTRACT],
      contracts: [MAINNET_CONTRACT],
      nfts: [
        {
          contract: MAINNET_CONTRACT,
          tokenId: "person_199",
          claimedOwner: MAINNET_CONTRACT,
        },
      ],
      tokens: [{ contract: "wrap.near", accountId: MAINNET_CONTRACT }],
    },
    requestId: "commission-team-" + randomUUID(),
    maxAiCalls: 1,
  });
  let done;
  for (let i = 0; i < 12; i++) {
    await w.missions.settle();
    for (const t of w
      .list(MAINNET_CONTRACT)
      .filter((t) => t.status === "QUEUED"))
      await w.execute(t.id);
    await w.missions.settle();
    done = w.missions.get(MAINNET_CONTRACT, m.id);
    if (
      ["REVIEW_READY", "NEEDS_ATTENTION", "INTERRUPTED"].includes(done.status)
    )
      break;
  }
  const children = w.missions.children(MAINNET_CONTRACT, m.id);
  const report = {
    verifiedAt: new Date().toISOString(),
    scope:
      "One live NEAR AI coordinator call; real finalized mainnet reads; internal commissioning request, no customer signature or payment",
    verified: done.status === "REVIEW_READY",
    mission: done,
    children,
  };
  mkdirSync("docs/service-examples", { recursive: true });
  writeFileSync(
    "docs/team-mission-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  if (done.output)
    writeFileSync(
      "docs/service-examples/team-mission.md",
      done.output.artifact + "\n",
    );
  console.log(
    JSON.stringify({
      status: done.status,
      error: done.error,
      specialists: children.map((t) => ({
        agent: t.agentId,
        service: t.service,
        status: t.status,
      })),
      verified: report.verified,
    }),
  );
  if (!report.verified) process.exitCode = 1;
} finally {
  await w.close();
}
