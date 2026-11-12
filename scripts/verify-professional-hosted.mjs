import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { Account, JsonRpcProvider, actions } from "near-api-js";
import { signMessage } from "near-api-js/nep413";
if (!process.argv.includes("--testnet"))
  throw Error("Explicit testnet commissioning required");
const base = "https://econia-2-testnet-production.up.railway.app",
  contract = "econia2-575e686f5c.testnet",
  progressPath = ".data/professional-hosted-progress.json";
if (
  existsSync(progressPath) &&
  !process.argv.includes("--inspect") &&
  !process.argv.includes("--attach-source")
)
  throw Error(
    "A hosted commissioning attempt is already recorded; inspect its transactions before another attempt",
  );
const client = JSON.parse(
  readFileSync(".private/econia-2-demo-client.json", "utf8"),
);
if (client.network !== "testnet" || !client.accountId.endsWith(".testnet"))
  throw Error("Synthetic testnet client required");
const provider = new JsonRpcProvider(
  { url: process.env.NEAR_TESTNET_RPC_URL || "https://test.rpc.fastnear.com" },
  { retries: 3, wait: 500, backoff: 1.5 },
);
if ((await provider.getNetworkId()) !== "testnet") throw Error("RPC mismatch");
const priorProgress = existsSync(progressPath)
  ? JSON.parse(readFileSync(progressPath, "utf8"))
  : null;
if (
  process.argv.includes("--attach-source") &&
  (!priorProgress ||
    priorProgress.transactions.length ||
    priorProgress.verified)
)
  throw Error(
    "Only an unfunded hosted quotation may be clarified with an exact source",
  );
const account = new Account(client.accountId, provider, client.secretKey);
let token;
const transactions = [];
const progress = {
  network: "testnet",
  base,
  client: client.accountId,
  transactions,
};
const save = () => {
  mkdirSync(".data", { recursive: true });
  writeFileSync(progressPath, JSON.stringify(progress, null, 2));
};
const api = async (path, body) => {
  const r = await fetch(base + "/api/society/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: base,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(70000),
  });
  const v = await r.json();
  if (!r.ok) throw Error(v.error || "Hosted API failed");
  return v;
};
async function sign(tx, method) {
  const p = tx.actions?.[0]?.params;
  if (
    tx.receiverId !== contract ||
    tx.actions?.length !== 1 ||
    p?.methodName !== method ||
    BigInt(p.deposit) > 105n * 10n ** 21n
  )
    throw Error("Hosted commissioning exceeds reviewed testnet scope");
  const r = await account.signAndSendTransaction({
    receiverId: contract,
    actions: [
      actions.functionCall(method, p.args, BigInt(p.gas), BigInt(p.deposit)),
    ],
    waitUntil: "FINAL",
  });
  if (!Object.hasOwn(r.status || {}, "SuccessValue"))
    throw Error("Hosted testnet transaction failed");
  transactions.push({ method, hash: r.transaction.hash });
  save();
  return r.transaction.hash;
}
async function poll(path, test) {
  for (let i = 0; i < 90; i++) {
    const value = await api(path);
    if (test(value)) return value;
    if (value.messages?.some((m) => m.delivery_status === "INTERRUPTED"))
      throw Error("Hosted professional response needs attention");
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error("Hosted work did not finish within bounded commissioning window");
}
const health = await (await fetch(base + "/api/health")).json(),
  world = await api("world");
if (
  health.network !== "testnet" ||
  !health.inferenceReady ||
  !health.settlementReady ||
  world.agents.length !== 24
)
  throw Error("Hosted release not commissioned");
const nftCount = await provider.callFunction({
  contractId: contract,
  method: "nft_supply_for_owner",
  args: { account_id: client.accountId },
  blockQuery: { finality: "final" },
});
if (nftCount !== "0") throw Error("Ordinary client proof requires no NFTs");
const challenge = await api("auth/challenge", { accountId: client.accountId }),
  signed = await signMessage({
    signerAccount: account,
    payload: {
      message: challenge.message,
      recipient: challenge.recipient,
      nonce: Buffer.from(challenge.nonce, "base64"),
    },
  });
token = (
  await api("auth/login", {
    challengeId: challenge.id,
    accountId: client.accountId,
    publicKey: client.publicKey,
    signature: Buffer.from(signed.signature).toString("base64"),
  })
).token;
if (process.argv.includes("--inspect")) {
  const prior = JSON.parse(readFileSync(progressPath, "utf8"));
  const t = await api("conversations/" + prior.conversationId);
  console.log(
    JSON.stringify(
      {
        proposals: t.proposals.map((p) => ({
          id: p.id,
          service: p.service_id,
          input: p.input_text,
          scope: p.scope,
          allocations: p.allocations?.length,
        })),
        messages: t.messages.map((m) => ({
          type: m.type,
          status: m.delivery_status,
          content: m.content,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const csv = "item,amount\nNotebook,0.10\nPen,0.20\nFolder,0.30\nTape,1.40",
  conversation = await api("conversations", {
    agentId: "person_017",
    kind: "CLIENT",
  });
progress.conversationId = conversation.id;
save();
await api("conversations/" + conversation.id + "/messages", {
  requestId: "hosted-csv-" + randomUUID(),
  attachments: [
    { filename: "records.csv", contentType: "text/csv", content: csv },
  ],
  content:
    "Please propose your supported csv-audit service now for the exact supplied CSV below. Your proposal input must contain only these CSV bytes, no explanation, code fences or additional instructions. Compute exact numeric sums, minima, maxima and means, and report missing cells. No collaborators are needed. This is descriptive data analysis only. The full four-row CSV is:\n" +
    csv,
});
const thread = await poll("conversations/" + conversation.id, (v) =>
    v.proposals.some(
      (p) =>
        p.service_id === "csv-audit" &&
        p.source?.sha256 === createHash("sha256").update(csv).digest("hex"),
    ),
  ),
  p = thread.proposals.find(
    (p) =>
      p.service_id === "csv-audit" &&
      p.source?.sha256 === createHash("sha256").update(csv).digest("hex"),
  );
if (
  !p ||
  p.input_text.replaceAll("\r\n", "\n").trim() !== csv ||
  p.allocations.length !== 1
)
  throw Error(
    "Hosted proposal changed source data or requested unnecessary collaborators; no funding authorized",
  );
progress.proposalId = p.id;
save();
const funding = await api("proposals/" + p.id + "/funding", {}),
  fundHash = await sign(funding, "post_service_job"),
  c = await api("proposals/" + p.id + "/confirm-funding", {
    transactionHash: fundHash,
  });
progress.contractId = c.id;
save();
await poll("contracts/" + c.id, (v) => v.state === "REVIEW_READY");
const files = await api("contracts/" + c.id + "/artifacts"),
  file = files.find((f) => f.filename === "analysis.json");
const download = await fetch(base + "/api/society/artifacts/" + file.id, {
    headers: { Authorization: "Bearer " + token },
  }),
  text = await download.text();
if (
  !download.ok ||
  createHash("sha256").update(text).digest("hex") !== file.sha256
)
  throw Error("Hosted artifact hash mismatch");
const analysis = JSON.parse(text),
  amount = analysis.columns.find((c) => c.name === "amount");
if (analysis.rowCount !== 4 || amount.sum !== "2" || amount.mean !== "0.5")
  throw Error("Hosted exact arithmetic failed");
const acceptance = await api("contracts/" + c.id + "/acceptance", {}),
  acceptHash = await sign(acceptance, "accept_service_job"),
  settled = await api("contracts/" + c.id + "/confirm-acceptance", {
    transactionHash: acceptHash,
  });
if (settled.state !== "SETTLED") throw Error("Hosted settlement not confirmed");
const report = {
  verified: true,
  verifiedAt: new Date().toISOString(),
  network: "testnet",
  url: base,
  scope:
    "Actual public Railway service: production health, testnet identity, same-origin NEP-413 client login with zero NFTs, real Cloud quotation, exact source preservation, customer-funded escrow, checked downloadable CSV artifacts and finalized testnet acceptance.",
  client: client.accountId,
  nftCount,
  provider: p.provider_id,
  conversationId: conversation.id,
  proposalId: p.id,
  contractId: c.id,
  chainJobId: settled.chain_job_id,
  transactions,
  artifacts: files,
  analysis,
  health,
  worldIdentityVerified: world.agents.every((a) => a.nft.status === "VERIFIED"),
  privacyCheck:
    (await fetch(base + "/api/society/conversations")).status === 401,
};
writeFileSync(
  "docs/professional-hosted-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
progress.verified = true;
save();
console.log(
  JSON.stringify({
    verified: true,
    url: base,
    clientOwnsNfts: false,
    exactSum: amount.sum,
    contractState: settled.state,
  }),
);
