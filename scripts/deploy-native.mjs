import {
  Account,
  JsonRpcProvider,
  actions,
  teraToGas,
  KeyPair,
} from "near-api-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { generateSeedPhrase } from "near-seed-phrase";
const mainnet = process.argv.includes("--mainnet");
if (!mainnet && !process.argv.includes("--testnet"))
  throw Error("Explicit network required");
const path = mainnet
  ? ".private/near-mainnet-wallet.json"
  : ".private/native-rehearsal.json";
if (!mainnet && !existsSync(path))
  writeFileSync(
    path,
    JSON.stringify(
      {
        network: "testnet",
        accountId:
          "econia-native-" + randomBytes(5).toString("hex") + ".testnet",
        ...generateSeedPhrase(randomBytes(32)),
      },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
const wallet = JSON.parse(readFileSync(path));
if (wallet.network !== (mainnet ? "mainnet" : "testnet"))
  throw Error("Wallet network mismatch");
if (
  mainnet &&
  Buffer.from(
    KeyPair.fromString(wallet.secretKey).getPublicKey().data,
  ).toString("hex") !== wallet.accountId
)
  throw Error("Wallet address mismatch");
const provider = new JsonRpcProvider({
  url: mainnet
    ? "https://rpc.mainnet.near.org"
    : "https://test.rpc.fastnear.com",
});
const owner = new Account(wallet.accountId, provider, wallet.secretKey);
async function state() {
  return provider.query({
    request_type: "view_account",
    finality: "final",
    account_id: wallet.accountId,
  });
}
if (!mainnet) {
  try {
    await state();
  } catch {
    const r = await fetch("https://helper.testnet.near.org/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newAccountId: wallet.accountId,
        newAccountPublicKey: wallet.publicKey,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok)
      throw Error("Testnet rehearsal funding unavailable: " + r.status);
  }
}
const wasm = readFileSync(".private/econia-native-optimized.wasm");
const sha = createHash("sha256").update(wasm).digest("hex");
const preflight = JSON.parse(readFileSync("docs/mainnet-preflight.json"));
if (sha !== preflight.optimizedWasmSha256)
  throw Error("Artifact differs from reviewed preflight");
const evidencePath = mainnet
  ? "docs/mainnet-deployment.json"
  : "docs/native-testnet-rehearsal.json";
const evidence = existsSync(evidencePath)
  ? JSON.parse(readFileSync(evidencePath))
  : {
      network: wallet.network,
      contract: wallet.accountId,
      wasmSha256: sha,
      transactions: [],
      feesYocto: "0",
    };
if (evidence.contract !== wallet.accountId || evidence.wasmSha256 !== sha)
  throw Error("Deployment evidence mismatch");
const save = () =>
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
let before;
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    before = await state();
    break;
  } catch (error) {
    if (mainnet || attempt === 4) throw error;
    await new Promise((r) => setTimeout(r, 2000));
  }
}
if (before.code_hash === "11111111111111111111111111111111") {
  if (mainnet) {
    const rehearsal = JSON.parse(
      readFileSync("docs/native-testnet-rehearsal.json"),
    );
    if (!rehearsal.verified || rehearsal.wasmSha256 !== sha)
      throw Error("Matching testnet rehearsal required");
    // Mainnet rejected the first atomic deployment despite the rehearsal estimate.
    // Reserve additional liquid headroom; it is not an authorization to spend it.
    const needed = BigInt(wasm.length + 4096) * 10n ** 19n + 15n * 10n ** 22n;
    if (BigInt(before.amount) < needed)
      throw Error("Insufficient balance for reviewed deployment reserve");
  }
  if (BigInt(evidence.feesYocto) >= 2n * 10n ** 22n)
    throw Error("Conservative fee cap reached");
  const tx = await owner.signAndSendTransaction({
    receiverId: wallet.accountId,
    actions: [
      actions.deployContract(wasm),
      actions.functionCall(
        "new",
        { owner_id: wallet.accountId, operator_id: wallet.accountId },
        teraToGas("80"),
        0n,
      ),
      actions.functionCall(
        "set_world_paused",
        { paused: true },
        teraToGas("20"),
        1n,
      ),
    ],
    waitUntil: "FINAL",
  });
  const fees = [tx.transaction_outcome, ...tx.receipts_outcome].reduce(
    (n, o) => n + BigInt(o.outcome.tokens_burnt),
    0n,
  );
  evidence.feesYocto = (BigInt(evidence.feesYocto) + fees).toString();
  evidence.transactions.push({
    hash: tx.transaction.hash,
    label: "Deploy and initialize paused native NEAR world",
    feesYocto: fees.toString(),
    status: tx.status,
  });
  save();
  if (!Object.hasOwn(tx.status, "SuccessValue"))
    throw Error("Deployment failed; inspect retained evidence before retrying");
}
const bytes = await provider.query({
  request_type: "view_code",
  finality: "final",
  account_id: wallet.accountId,
});
if (
  createHash("sha256")
    .update(Buffer.from(bytes.code_base64, "base64"))
    .digest("hex") !== sha
)
  throw Error("Deployed code differs");
const custody = await provider.callFunction({
  contractId: wallet.accountId,
  method: "custody",
  args: {},
});
if (custody.asset !== "NEAR" || !custody.paused)
  throw Error("Unexpected initialized state");
const after = await state();
evidence.verified = true;
evidence.deploymentStatus =
  "deployed and verified; paused pending runtime commissioning";
delete evidence.reportedShortfallYocto;
delete evidence.recommendedAdditionalNEAR;
evidence.verifiedAt = new Date().toISOString();
evidence.custody = custody;
evidence.storageBytes = after.storage_usage;
evidence.storageLockedNEAR = (Number(after.storage_usage) / 100000).toFixed(5);
evidence.remainingBalanceYocto = after.amount;
evidence.liquidBalanceYocto = (
  BigInt(after.amount) -
  BigInt(after.storage_usage) * 10n ** 19n
).toString();
evidence.nftSupply = await provider.callFunction({
  contractId: wallet.accountId,
  method: "nft_total_supply",
  args: {},
});
save();
console.log(JSON.stringify(evidence, null, 2));
