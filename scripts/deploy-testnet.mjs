import {
  Account,
  JsonRpcProvider,
  PublicKey,
  actions,
  nearToYocto,
  teraToGas,
} from "near-api-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const root = JSON.parse(
  readFileSync(resolve(".private/near-testnet-wallet.json"), "utf8"),
);
if (root.network !== "testnet" || !root.accountId.endsWith(".testnet"))
  throw new Error("Testnet wallet required");
const provider = new JsonRpcProvider({ url: "https://test.rpc.fastnear.com" }),
  owner = new Account(root.accountId, provider, root.secretKey);
const ecoId = `eco.${root.accountId}`,
  worldId = `world.${root.accountId}`;
const evidencePath = resolve("docs/testnet-deployment.json");
let evidence = existsSync(evidencePath)
  ? JSON.parse(readFileSync(evidencePath, "utf8"))
  : {
      network: "testnet",
      owner: root.accountId,
      eco: ecoId,
      world: worldId,
      transactions: [],
    };
function save() {
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
}
async function record(label, promise) {
  const tx = await promise;
  if (!Object.hasOwn(tx.status || {}, "SuccessValue"))
    throw new Error(`${label} did not succeed`);
  const item = {
    label,
    hash: tx.transaction.hash,
    explorer: `https://testnet.nearblocks.io/txns/${tx.transaction.hash}`,
  };
  evidence.transactions.push(item);
  save();
  console.log(JSON.stringify(item));
  return tx;
}
for (const [id, balance] of [
  [ecoId, "2"],
  [worldId, "6"],
]) {
  let exists = false;
  try {
    await provider.query({
      request_type: "view_account",
      finality: "final",
      account_id: id,
    });
    exists = true;
  } catch {}
  if (!exists)
    await record(
      `Create ${id}`,
      owner.signAndSendTransaction({
        receiverId: id,
        actions: [
          actions.createAccount(),
          actions.transfer(nearToYocto(balance)),
          actions.addFullAccessKey(PublicKey.fromString(root.publicKey)),
        ],
        waitUntil: "FINAL",
      }),
    );
}
for (const [id, file, args] of [
  [
    ecoId,
    "econia_eco.wasm",
    { owner_id: root.accountId, total_supply: "1000000000" },
  ],
  [
    worldId,
    "econia_world.wasm",
    {
      owner_id: root.accountId,
      operator_id: root.accountId,
      eco_contract: ecoId,
    },
  ],
]) {
  const contract = new Account(id, provider, root.secretKey),
    wasm = readFileSync(
      resolve("packages/contracts/target/wasm32-unknown-unknown/release", file),
    );
  const digest = createHash("sha256").update(wasm).digest("hex");
  if (evidence[`${file}Digest`] === digest) continue;
  const accountState = await provider.query({
    request_type: "view_account",
    finality: "final",
    account_id: id,
  });
  const minimumBalance = BigInt(wasm.length + 14000) * 10n ** 19n;
  if (BigInt(accountState.amount) < minimumBalance)
    await record(
      `Fund contract storage ${id}`,
      owner.signAndSendTransaction({
        receiverId: id,
        actions: [
          actions.transfer(minimumBalance - BigInt(accountState.amount)),
        ],
        waitUntil: "FINAL",
      }),
    );
  let initialized = false;
  try {
    await provider.callFunction({
      contractId: id,
      method: id === ecoId ? "ft_metadata" : "settlement_state",
      args: {},
    });
    initialized = true;
  } catch {}
  await record(
    `Deploy ${file}`,
    contract.signAndSendTransaction({
      receiverId: id,
      actions: [
        actions.deployContract(wasm),
        ...(!initialized
          ? [actions.functionCall("new", args, teraToGas("80"), 0n)]
          : []),
      ],
      waitUntil: "FINAL",
    }),
  );
  evidence[`${file}Digest`] = digest;
  save();
}
// Register the pooled world escrow as a token holder. No minting after fixed genesis supply.
const storage = await provider.callFunction({
  contractId: ecoId,
  method: "storage_balance_of",
  args: { account_id: worldId },
});
if (!storage)
  await record(
    "Register world token storage",
    owner.callFunctionRaw({
      contractId: ecoId,
      methodName: "storage_deposit",
      args: { account_id: worldId, registration_only: true },
      gas: teraToGas("30"),
      deposit: nearToYocto("0.01"),
      waitUntil: "FINAL",
    }),
  );
let registered = false;
try {
  await record(
    "Register owner in world",
    owner.callFunctionRaw({
      contractId: worldId,
      methodName: "register_wallet",
      args: {},
      gas: teraToGas("30"),
      deposit: nearToYocto("0.01"),
      waitUntil: "FINAL",
    }),
  );
  registered = true;
} catch (error) {
  if (!String(error.message).includes("Already registered")) throw error;
}
evidence.token = await provider.callFunction({
  contractId: ecoId,
  method: "ft_metadata",
  args: {},
});
evidence.totalSupply = await provider.callFunction({
  contractId: ecoId,
  method: "ft_total_supply",
  args: {},
});
evidence.verifiedAt = new Date().toISOString();
save();
mkdirSync(".private", { recursive: true });
writeFileSync(
  ".private/deployment.json",
  JSON.stringify(
    {
      owner: root.accountId,
      eco: ecoId,
      world: worldId,
      rpc: "https://test.rpc.fastnear.com",
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    deployed: true,
    owner: root.accountId,
    eco: ecoId,
    world: worldId,
    totalSupply: evidence.totalSupply,
  }),
);
