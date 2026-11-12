import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Account, JsonRpcProvider } from "near-api-js";
import { signMessage } from "near-api-js/nep413";
if (
  !process.argv.includes("--testnet") ||
  !process.argv.includes("--after-restart")
)
  throw Error(
    "Use only after observing an actual restart of the isolated testnet service",
  );
const reportPath = "docs/professional-hosted-verification.json",
  report = JSON.parse(readFileSync(reportPath, "utf8")),
  client = JSON.parse(
    readFileSync(".private/econia-2-demo-client.json", "utf8"),
  );
if (
  !report.verified ||
  report.network !== "testnet" ||
  client.network !== "testnet" ||
  report.client !== client.accountId ||
  report.url !== "https://econia-2-testnet-production.up.railway.app"
)
  throw Error("Verified hosted testnet commission required");
const base = report.url,
  provider = new JsonRpcProvider(
    {
      url: process.env.NEAR_TESTNET_RPC_URL || "https://test.rpc.fastnear.com",
    },
    { retries: 3, wait: 500, backoff: 1.5 },
  ),
  account = new Account(client.accountId, provider, client.secretKey);
let token;
const api = async (path, body) => {
  const r = await fetch(base + "/api/society/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: base,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const v = await r.json();
  if (!r.ok) throw Error(v.error || "Hosted read failed");
  return v;
};
const health = await (await fetch(base + "/api/health")).json();
if (
  health.network !== "testnet" ||
  !health.inferenceReady ||
  !health.settlementReady
)
  throw Error("Hosted restart is not healthy");
const challenge = await api("auth/challenge", { accountId: client.accountId }),
  proof = await signMessage({
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
    signature: Buffer.from(proof.signature).toString("base64"),
  })
).token;
const contract = await api("contracts/" + report.contractId),
  thread = await api("conversations/" + report.conversationId),
  files = await api("contracts/" + report.contractId + "/artifacts");
if (
  contract.state !== "SETTLED" ||
  contract.funding_tx !==
    report.transactions.find((t) => t.method === "post_service_job").hash ||
  contract.settlement_tx !==
    report.transactions.find((t) => t.method === "accept_service_job").hash
)
  throw Error("Receipt-backed contract did not survive restart");
const expected = "item,amount\nNotebook,0.10\nPen,0.20\nFolder,0.30\nTape,1.40",
  sourceHash = createHash("sha256").update(expected).digest("hex");
if (
  contract.input_text !== expected ||
  contract.source?.sha256 !== sourceHash ||
  !thread.messages.some((m) =>
    m.attachments?.some((a) => a.sha256 === sourceHash),
  )
)
  throw Error("Exact source/provenance did not survive restart");
for (const f of report.artifacts) {
  const saved = files.find((x) => x.id === f.id && x.sha256 === f.sha256);
  if (!saved) throw Error("Artifact metadata changed after restart");
  const r = await fetch(base + "/api/society/artifacts/" + f.id, {
      headers: { Authorization: "Bearer " + token },
    }),
    content = await r.text();
  if (!r.ok || createHash("sha256").update(content).digest("hex") !== f.sha256)
    throw Error("Artifact bytes changed after restart");
}
report.restartVerified = true;
report.restartVerifiedAt = new Date().toISOString();
report.restartHealth = health;
report.source = contract.source;
report.exactSourcePreserved = true;
report.restartVerificationScope =
  "After an observed Railway restart, a fresh free signed session retrieved the same settled contract, funding/acceptance receipts, exact source attachment and unchanged artifact bytes. No inference or financial transaction was requested by this verifier.";
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    verified: true,
    restartVerified: true,
    exactSourcePreserved: true,
    filesPreserved: files.length,
    revision: health.revision,
  }),
);
