import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { JsonRpcProvider } from "near-api-js";
import { createServiceWorkforce } from "../packages/agent-sdk/service-workforce.mjs";
import { MAINNET_CONTRACT } from "../packages/shared/native-state.mjs";
const rpc = new JsonRpcProvider({
  url: process.env.NEAR_MAINNET_RPC_URL || "https://free.rpc.fastnear.com",
});
const w = createServiceWorkforce({
  path: ".data/web3-commissioning.sqlite",
  accountTaskLimit: 4,
  resolveAgent: async (id) => {
    const t = await rpc.callFunction({
        contractId: MAINNET_CONTRACT,
        method: "nft_token",
        args: { token_id: id },
      }),
      a = await rpc.callFunction({
        contractId: MAINNET_CONTRACT,
        method: "get_agent",
        args: { agent_id: id },
      });
    return t && a ? { ownerId: t.owner_id, paused: a.paused } : null;
  },
});
const examples = [
  { agentId: "person_103", input: MAINNET_CONTRACT },
  { agentId: "person_104", input: MAINNET_CONTRACT },
  {
    agentId: "person_105",
    input: JSON.stringify({
      contract: MAINNET_CONTRACT,
      tokenId: "person_199",
      claimedOwner: MAINNET_CONTRACT,
    }),
  },
  {
    agentId: "person_106",
    input: JSON.stringify({
      contract: "wrap.near",
      accountId: MAINNET_CONTRACT,
    }),
  },
];
const report = {
  scope:
    "Live read-only NEAR mainnet tools on commissioning examples; no wallet session, inference or transactions",
  verifiedAt: new Date().toISOString(),
  tasks: [],
};
try {
  for (const example of examples) {
    const t = await w.submit(MAINNET_CONTRACT, {
      ...example,
      requestId: "verify-web3-" + randomUUID(),
    });
    await w.execute(t.id);
    const done = w.task(MAINNET_CONTRACT, t.id);
    report.tasks.push({
      service: done.service,
      status: done.status,
      error: done.error,
      trace: done.trace,
      output: done.output,
    });
    console.log(
      JSON.stringify({
        service: done.service,
        status: done.status,
        error: done.error,
      }),
    );
  }
  report.verified = report.tasks.every((t) => t.status === "REVIEW_READY");
  report.inferenceCallsReserved = w.status().aiCallsReserved;
  mkdirSync("docs/service-examples", { recursive: true });
  for (const t of report.tasks)
    if (t.output)
      writeFileSync(
        "docs/service-examples/" + t.service + ".md",
        t.output.artifact + "\n\n" + t.output.review + "\n",
      );
  writeFileSync(
    "docs/web3-workforce-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  if (!report.verified) process.exitCode = 1;
} finally {
  await w.close();
}
