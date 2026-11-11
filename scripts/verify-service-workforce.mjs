import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { JsonRpcProvider } from "near-api-js";
import { createServiceWorkforce } from "../packages/agent-sdk/service-workforce.mjs";
import { MAINNET_CONTRACT } from "../packages/shared/native-state.mjs";
const provider = new JsonRpcProvider({
  url: process.env.NEAR_MAINNET_RPC_URL || "https://free.rpc.fastnear.com",
});
const workforce = createServiceWorkforce({
  resolveAgent: async (id) => {
    const token = await provider.callFunction({
      contractId: MAINNET_CONTRACT,
      method: "nft_token",
      args: { token_id: id },
    });
    const state = await provider.callFunction({
      contractId: MAINNET_CONTRACT,
      method: "get_agent",
      args: { agent_id: id },
    });
    return token && state
      ? { ownerId: token.owner_id, paused: state.paused }
      : null;
  },
});
const source =
  "Econia service pilot policy\n\nThe pilot accepts a specific customer request before any document agent uses inference credits. Idle agents do not generate daily plans. Each document task reserves at most one AI request before execution.\n\nThe data analyst parses supplied CSV files and computes decimal statistics without an AI request. The editor and verifier checks the outputs before a deliverable is released for customer review.\n\nThis trial does not charge NEAR. A customer must review and accept the deliverable. Native treasury balances and deployment reserves are separate from API credits.";
const tasks = [
  {
    agentId: "person_199",
    input: source,
    brief: "Extract three policy points with exact supporting quotes.",
  },
  {
    agentId: "person_101",
    input: "item,units,unit_price\nNotebook,4,2.50\nPen,10,0.30\nFolder,6,1.20",
    brief: "Profile each column and identify missing values.",
  },
  {
    agentId: "person_102",
    input:
      "Our pilot helps customers to review their documents. Each request has 1 clear goal, and the result is checked before it is delivered. Please send feedback to team@example.com after reviewing the result.",
    brief: "Improve clarity and grammar without changing any facts.",
  },
];
const report = {
  scope:
    "Live NEAR AI and real tools on supplied commissioning examples; no customer wallet session or NEAR payment",
  verifiedAt: new Date().toISOString(),
  tasks: [],
};
try {
  for (const body of tasks) {
    const task = await workforce.submit(MAINNET_CONTRACT, {
      ...body,
      requestId: "verify-" + randomUUID(),
    });
    await workforce.execute(task.id);
    const done = workforce.task(MAINNET_CONTRACT, task.id);
    report.tasks.push({
      id: done.id,
      agentId: done.agentId,
      service: done.service,
      status: done.status,
      sourceHash: done.sourceHash,
      trace: done.trace,
      error: done.error,
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
  mkdirSync("docs/service-examples", { recursive: true });
  for (const t of report.tasks)
    if (t.output)
      writeFileSync(
        "docs/service-examples/" + t.service + ".md",
        t.output.artifact + "\n\n" + t.output.review + "\n",
      );
  writeFileSync(
    "docs/service-workforce-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  if (!report.verified) process.exitCode = 1;
} finally {
  await workforce.close();
}
