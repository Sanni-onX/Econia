import { Account, JsonRpcProvider, nearToYocto } from "near-api-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
const ownerId = JSON.parse(
  readFileSync(".private/near-mainnet-wallet.json"),
).accountId;
const roster = JSON.parse(readFileSync("docs/agent-roster.json")).agents;
const provider = new JsonRpcProvider({
  url: mainnet
    ? "https://free.rpc.fastnear.com"
    : "https://test.rpc.fastnear.com",
});
const account = new Account(wallet.accountId, provider, wallet.secretKey);
const path = mainnet
  ? "docs/native-founding-agents.json"
  : "docs/native-mint-rehearsal.json";
const report = existsSync(path)
  ? JSON.parse(readFileSync(path))
  : {
      network: wallet.network,
      contract: wallet.accountId,
      owner: ownerId,
      capitalPerAgent: "0",
      minted: [],
      feesYocto: "0",
    };
const save = () => writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
const count = mainnet ? 64 : 1;
const existingTokens = await provider.callFunction({
  contractId: wallet.accountId,
  method: "nft_tokens",
  args: { from_index: "0", limit: 100 },
});
let free = 0n,
  checks = 0;
for (const agent of roster.slice(0, count)) {
  const existing = existingTokens.find((t) => t.token_id === agent.id);
  if (existing) {
    if (existing.owner_id !== ownerId)
      throw Error("Existing ownership differs");
    continue;
  }
  if (checks++ % 8 === 0) {
    const state = await provider.query({
      request_type: "view_account",
      finality: "final",
      account_id: wallet.accountId,
    });
    free = BigInt(state.amount) - BigInt(state.storage_usage) * 10n ** 19n;
  }
  if (mainnet && free < nearToYocto("0.16"))
    throw Error("Stopped to preserve gas and operational reserve");
  if (BigInt(report.feesYocto) > nearToYocto("0.15"))
    throw Error("Commissioning gas guard reached");
  const tx = await account.callFunctionRaw({
    contractId: wallet.accountId,
    methodName: "mint_agent",
    args: {
      agent_id: agent.id,
      receiver_id: ownerId,
      name: agent.name,
      provenance:
        "Econia native-NEAR founding cohort; fresh zero treasury; no legacy ECO or history balance migration",
    },
    gas: 80000000000000n,
    deposit: nearToYocto("0.04"),
    waitUntil: "FINAL",
  });
  const fee = [tx.transaction_outcome, ...tx.receipts_outcome].reduce(
    (n, o) => n + BigInt(o.outcome.tokens_burnt),
    0n,
  );
  report.feesYocto = (BigInt(report.feesYocto) + fee).toString();
  report.minted.push({
    id: agent.id,
    name: agent.name,
    hash: tx.transaction.hash,
    feesYocto: fee.toString(),
  });
  save();
  if (!Object.hasOwn(tx.status, "SuccessValue")) throw Error("Mint failed");
  free -= nearToYocto("0.02");
  console.log(JSON.stringify({ id: agent.id, hash: tx.transaction.hash }));
}
const state = await provider.query({
  request_type: "view_account",
  finality: "final",
  account_id: wallet.accountId,
});
report.supply = await provider.callFunction({
  contractId: wallet.accountId,
  method: "nft_total_supply",
  args: {},
});
report.storageBytes = state.storage_usage;
report.liquidYocto = (
  BigInt(state.amount) -
  BigInt(state.storage_usage) * 10n ** 19n
).toString();
report.verifiedAt = new Date().toISOString();
save();
console.log(
  JSON.stringify({
    supply: report.supply,
    storageBytes: report.storageBytes,
    liquidYocto: report.liquidYocto,
    feesYocto: report.feesYocto,
  }),
);
