import { Account, JsonRpcProvider, actions } from "near-api-js";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const mainnet = process.argv.includes("--mainnet");
if (!mainnet && !process.argv.includes("--testnet"))
  throw Error("Explicit network required");
const wallet = JSON.parse(
  readFileSync(
    mainnet
      ? ".private/near-mainnet-wallet.json"
      : ".private/native-rehearsal.json",
  ),
);
const wasm = readFileSync(".private/econia-native-views.wasm");
const sha = createHash("sha256").update(wasm).digest("hex");
if (mainnet) {
  const proof = JSON.parse(readFileSync("docs/native-view-rehearsal.json"));
  if (!proof.verified || proof.wasmSha256 !== sha)
    throw Error("Matching state-preserving testnet rehearsal required");
}
const provider = new JsonRpcProvider({
  url: mainnet
    ? "https://free.rpc.fastnear.com"
    : "https://test.rpc.fastnear.com",
});
const account = new Account(wallet.accountId, provider, wallet.secretKey);
const call = (method, args = {}) =>
  provider.callFunction({ contractId: wallet.accountId, method, args });
const before = {
  custody: await call("custody"),
  tokens: await call("nft_tokens", { from_index: "0", limit: 100 }),
};
const state = await provider.query({
  request_type: "view_account",
  finality: "final",
  account_id: wallet.accountId,
});
const needed =
  BigInt(Math.max(0, wasm.length - 261647)) * 10n ** 19n + 10n ** 23n;
if (BigInt(state.amount) - BigInt(state.storage_usage) * 10n ** 19n < needed)
  throw Error("Preserve gas and storage reserve");
const tx = await account.signAndSendTransaction({
  receiverId: wallet.accountId,
  actions: [actions.deployContract(wasm)],
  waitUntil: "FINAL",
});
const fees = [tx.transaction_outcome, ...tx.receipts_outcome].reduce(
  (n, r) => n + BigInt(r.outcome.tokens_burnt),
  0n,
);
const report = {
  network: mainnet ? "mainnet" : "testnet",
  contract: wallet.accountId,
  wasmSha256: sha,
  hash: tx.transaction.hash,
  feesYocto: fees.toString(),
  status: tx.status,
  verified: false,
};
const path = mainnet
  ? "docs/native-view-upgrade.json"
  : "docs/native-view-rehearsal.json";
writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
if (!Object.hasOwn(tx.status, "SuccessValue")) throw Error("Upgrade failed");
if (fees > 2n * 10n ** 22n) throw Error("Upgrade fee guard reached");
const after = {
  custody: await call("custody"),
  tokens: await call("nft_tokens", { from_index: "0", limit: 100 }),
};
if (JSON.stringify(before) !== JSON.stringify(after))
  throw Error("Existing ownership or custody changed");
const agents = await call("get_agents", {
  agent_ids: before.tokens.map((t) => t.token_id),
});
if (
  Object.keys(agents).length !== before.tokens.length ||
  Object.values(agents).some(
    (a) => a.treasury !== "0" || a.capital_received !== "0" || a.paused,
  )
)
  throw Error("Founding zero-state changed");
const code = await provider.query({
  request_type: "view_code",
  finality: "final",
  account_id: wallet.accountId,
});
if (
  createHash("sha256")
    .update(Buffer.from(code.code_base64, "base64"))
    .digest("hex") !== sha
)
  throw Error("Code hash differs");
Object.assign(report, {
  verified: true,
  supply: before.tokens.length,
  custody: after.custody,
  verifiedAt: new Date().toISOString(),
});
writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
