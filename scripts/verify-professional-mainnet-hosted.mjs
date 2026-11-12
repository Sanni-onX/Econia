import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { Account, JsonRpcProvider } from "near-api-js";
import { signMessage } from "near-api-js/nep413";

if (!process.argv.includes("--mainnet"))
  throw Error("Explicit --mainnet required");
const base = "https://econia-production.up.railway.app";
const deployment = JSON.parse(
  readFileSync("docs/professional-mainnet-deployment.json", "utf8"),
);
const path = ".data/professional-mainnet-hosted-progress.json";
const inspect = process.argv.includes("--inspect");
let progress = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
if (progress && !inspect)
  throw Error(
    "An attempt is recorded; use --inspect to read it without another inference request",
  );
if (inspect && !progress) throw Error("No prior hosted attempt to inspect");
let token;
async function api(path, body) {
  const r = await fetch(base + "/api/society/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: base,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Hosted verification failed");
  return d;
}
const health = await (
  await fetch(base + "/api/health", { signal: AbortSignal.timeout(20000) })
).json();
const world = await api("world");
if (
  !deployment.verified ||
  health.network !== "mainnet" ||
  !health.inferenceReady ||
  !health.settlementReady ||
  world.contract !== deployment.contract ||
  world.agents.length !== 24 ||
  world.chainIssue
)
  throw Error("Verified mainnet release and worker required");
const provider = new JsonRpcProvider({
  url: "https://rpc.mainnet.fastnear.com",
});
if ((await provider.getNetworkId()) !== "mainnet") throw Error("RPC mismatch");
const wallet = JSON.parse(
  readFileSync(".private/near-mainnet-wallet.json", "utf8"),
);
if (wallet.network !== "mainnet" || wallet.accountId !== deployment.contract)
  throw Error("Wallet mismatch");
const challenge = await api("auth/challenge", { accountId: wallet.accountId });
if (
  challenge.recipient !== "econia.services.mainnet" ||
  !challenge.message.startsWith(
    `Sign in to Econia on NEAR Mainnet as ${wallet.accountId}.`,
  ) ||
  Buffer.from(challenge.nonce, "base64").length !== 32 ||
  challenge.expires < Date.now()
)
  throw Error("Unexpected sign-in challenge");
// NEP-413 signs a free domain-separated login message locally. This script has
// no transaction-signing, funding, capital, grant or acceptance operation.
const signed = await signMessage({
  signerAccount: new Account(wallet.accountId, provider, wallet.secretKey),
  payload: {
    message: challenge.message,
    recipient: challenge.recipient,
    nonce: Buffer.from(challenge.nonce, "base64"),
  },
});
token = (
  await api("auth/login", {
    challengeId: challenge.id,
    accountId: wallet.accountId,
    publicKey: wallet.publicKey,
    signature: Buffer.from(signed.signature).toString("base64"),
  })
).token;
if (!progress) {
  const c = await api("conversations", {
    agentId: "person_199",
    kind: "CLIENT",
  });
  progress = {
    network: "mainnet",
    url: base,
    agentId: "person_199",
    conversationId: c.id,
    requestId: randomUUID(),
    requestedAt: new Date().toISOString(),
  };
  writeFileSync(path, JSON.stringify(progress, null, 2));
  await api("conversations/" + c.id + "/messages", {
    content:
      "Describe your professional capabilities and how a client can commission checked work. This is a deployment check: reply briefly without proposing, hiring or purchasing any service.",
    requestId: progress.requestId,
  });
}
let conversation;
for (let n = 0; n < 50; n++) {
  conversation = await api("conversations/" + progress.conversationId);
  if (
    conversation.messages.some(
      (m) => m.sender === progress.agentId && m.delivery_status === "DELIVERED",
    )
  )
    break;
  if (conversation.messages.some((m) => m.delivery_status === "INTERRUPTED"))
    throw Error(
      "Agent response interrupted; no automatic repeat will be billed",
    );
  await new Promise((r) => setTimeout(r, 1000));
}
const reply = conversation.messages.find(
  (m) => m.sender === progress.agentId && m.delivery_status === "DELIVERED",
);
if (!reply || conversation.proposals.length)
  throw Error("Expected one free conversation reply and no payment proposal");
await api("auth/logout", {});
token = null;
const report = {
  verified: true,
  verifiedAt: new Date().toISOString(),
  network: "mainnet",
  url: base,
  revision: health.revision,
  contract: deployment.contract,
  professionalCount: world.agents.length,
  inferenceReady: health.inferenceReady,
  settlementReady: health.settlementReady,
  chainIssue: world.chainIssue,
  authentication:
    "Actual locally signed NEP-413 mainnet login verified by hosted API; no browser Nightly assertion",
  conversation: {
    ...progress,
    responseType: reply.type,
    responseSha256: createHash("sha256").update(reply.content).digest("hex"),
  },
  financialOperations: 0,
  mainnetPaymentCommissioning:
    "Not attempted: deployment reserves are not allocated to client service payments or agent operating capital.",
  browserNightly: "Not yet rechecked for this mainnet rebuild",
};
writeFileSync(
  "docs/professional-mainnet-hosted-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
