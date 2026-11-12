import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { openAgentStore } from "../packages/agent-runtime/store.mjs";
import { createProfessionalRuntime } from "../packages/agent-runtime/runtime.mjs";
const store = openAgentStore({
  path: ".data/professional-commissioning.sqlite",
});
const runtime = createProfessionalRuntime({ store });
try {
  const conversation = await runtime.conversations.open(
    "person_199",
    "commissioning.testnet",
  );
  await runtime.conversations.send(conversation.id, "commissioning.testnet", {
    requestId: "professional-live-" + randomUUID(),
    content:
      "Please propose a procurement comparison for this catering brief: 40 guests, Saturday event, supplied suppliers only. Supplier A offers 50 reusable trays for 20 testnet NEAR with Friday delivery; supplier B offers the same 50 trays for 18 testnet NEAR but no confirmed delivery date. Compare reliability and cost, and label assumptions. My restaurant also needs a static website explaining its menu and catering process. Please discover a qualified software professional in your directory and request a separate quotation for that website. Quotations only: do not claim any hiring, payment, delivery or physical fulfillment.",
  });
  for (let i = 0; i < 6; i++) {
    await runtime.settle();
    if (!runtime.jobs().some((j) => ["QUEUED", "RUNNING"].includes(j.state)))
      break;
  }
  const jobs = runtime.jobs();
  const proposals = runtime.contracts
    .list("commissioning.testnet")
    .filter((p) => p.conversation_id === conversation.id);
  const messages = await runtime.conversations.messages(
    conversation.id,
    "commissioning.testnet",
  );
  const threads = store.db
    .prepare(
      "SELECT t.*,m.sender,m.recipient,m.type,m.content FROM agent_threads t JOIN agent_messages m ON m.thread_id=t.id WHERE t.parent_proposal IN (SELECT id FROM proposals WHERE conversation_id=?) ORDER BY m.rowid",
    )
    .all(conversation.id);
  const verified =
    jobs
      .filter(
        (j) =>
          j.reference_id ===
            messages.find((m) => m.type === "HUMAN_MESSAGE")?.id ||
          threads.some((t) => t.id === j.reference_id),
      )
      .every((j) => j.state === "COMPLETED") &&
    proposals.length > 0 &&
    threads.some((t) => t.type === "QUOTE");
  const result = {
    verifiedAt: store.now(),
    scope:
      "Live NEAR AI internal commissioning conversation and separate professional RFP responses. No signed public customer session, funded contract, minted Genesis NFT or completed service is claimed.",
    verified,
    messages,
    proposals,
    threads,
    jobs: jobs.map(({ id, agent_id, kind, state, error }) => ({
      id,
      agent_id,
      kind,
      state,
      error,
    })),
  };
  writeFileSync(
    "docs/professional-conversation-verification.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      verified,
      proposals: proposals.length,
      peerReplies: threads.filter((t) => ["QUOTE", "DECLINE"].includes(t.type))
        .length,
      jobs: result.jobs,
    }),
  );
  if (!verified) process.exitCode = 1;
} finally {
  await runtime.close();
  store.close();
}
