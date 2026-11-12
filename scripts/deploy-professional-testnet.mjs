import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { generateSeedPhrase, parseSeedPhrase } from "near-seed-phrase";
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  actions,
  teraToGas,
} from "near-api-js";
import { GENESIS_AGENTS } from "../packages/agent-runtime/genesis.mjs";
if (!process.argv.includes("--testnet"))
  throw Error(
    "Explicit --testnet is required; this script cannot deploy to mainnet",
  );
const provider = new JsonRpcProvider({
  url: process.env.NEAR_TESTNET_RPC_URL || "https://test.rpc.fastnear.com",
});
if ((await provider.getNetworkId()) !== "testnet")
  throw Error("RPC network mismatch");
const ownerWallet = JSON.parse(
  readFileSync(".private/near-testnet-wallet.json", "utf8"),
);
if (
  ownerWallet.network !== "testnet" ||
  !ownerWallet.accountId.endsWith(".testnet")
)
  throw Error("Testnet owner account required");
mkdirSync(".private", { recursive: true });
const path = ".private/econia-2-testnet-wallet.json";
let wallet;
if (existsSync(path)) wallet = JSON.parse(readFileSync(path, "utf8"));
else {
  const key = generateSeedPhrase(randomBytes(32));
  if (parseSeedPhrase(key.seedPhrase).publicKey !== key.publicKey)
    throw Error("Recovery verification failed");
  const operator = KeyPair.fromRandom("ed25519");
  wallet = {
    network: "testnet",
    accountId: "econia2-" + randomBytes(5).toString("hex") + ".testnet",
    ...key,
    operatorSecretKey: operator.toString(),
    operatorPublicKey: operator.getPublicKey().toString(),
  };
  writeFileSync(path, JSON.stringify(wallet, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
}
if (wallet.network !== "testnet" || !wallet.accountId.endsWith(".testnet"))
  throw Error("Testnet deployment identity mismatch");
const wasm = readFileSync(
  "packages/contracts/target/wasm32-unknown-unknown/release/econia_professional_world.wasm",
);
const sha = createHash("sha256").update(wasm).digest("hex");
const evidencePath = "docs/professional-testnet-deployment.json";
const evidence = existsSync(evidencePath)
  ? JSON.parse(readFileSync(evidencePath, "utf8"))
  : {
      network: "testnet",
      contract: wallet.accountId,
      owner: ownerWallet.accountId,
      wasmSha256: sha,
      transactions: [],
      genesis: [],
      feesYocto: "0",
    };
if (evidence.contract !== wallet.accountId || evidence.wasmSha256 !== sha)
  throw Error(
    "Deployment artifact differs from existing evidence; review before an upgrade",
  );
const save = () =>
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
async function record(promise, operation) {
  const result = await promise;
  if (!Object.hasOwn(result.status || {}, "SuccessValue"))
    throw Error("Testnet operation not successful: " + operation);
  const fees = [result.transaction_outcome, ...result.receipts_outcome].reduce(
    (n, x) => n + BigInt(x.outcome.tokens_burnt),
    0n,
  );
  evidence.transactions.push({
    operation,
    hash: result.transaction.hash,
    receiver: result.transaction.receiver_id,
    feesYocto: fees.toString(),
  });
  evidence.feesYocto = (BigInt(evidence.feesYocto) + fees).toString();
  save();
  console.log(JSON.stringify({ operation, hash: result.transaction.hash }));
  return result;
}
const state = async (id) =>
  provider.query({
    request_type: "view_account",
    finality: "final",
    account_id: id,
  });
let accountState;
try {
  accountState = await state(wallet.accountId);
} catch (error) {
  if (!/does not exist|UNKNOWN_ACCOUNT/i.test(error.message)) throw error;
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
    throw Error(
      "Testnet account faucet unavailable (HTTP " +
        r.status +
        "); recovery is saved locally",
    );
  for (let n = 0; n < 8; n++) {
    try {
      accountState = await state(wallet.accountId);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!accountState) throw Error("Funded testnet account not finalized yet");
}
const contractAccount = new Account(
    wallet.accountId,
    provider,
    wallet.secretKey,
  ),
  owner = new Account(ownerWallet.accountId, provider, ownerWallet.secretKey);
if (accountState.code_hash === "11111111111111111111111111111111") {
  const reserve = BigInt(wasm.length + 40000) * 10n ** 19n + 2n * 10n ** 24n;
  if (BigInt(accountState.amount) < reserve)
    throw Error(
      "Faucet funds insufficient for code, Genesis state and bounded test setup",
    );
  await record(
    contractAccount.signAndSendTransaction({
      receiverId: wallet.accountId,
      actions: [
        actions.deployContract(wasm),
        actions.functionCall(
          "new",
          { owner_id: ownerWallet.accountId, operator_id: wallet.accountId },
          teraToGas("80"),
          0n,
        ),
        actions.addFunctionCallAccessKey(
          KeyPair.fromString(wallet.operatorSecretKey).getPublicKey(),
          wallet.accountId,
          [
            "deliver_service_job",
            "open_agent_service_job",
            "accept_service_job",
          ],
          2n * 10n ** 23n,
        ),
      ],
      waitUntil: "FINAL",
    }),
    "deploy-professional-world",
  );
} else {
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
    throw Error("Deployed code does not match reviewed artifact");
}
const ownerState = await state(ownerWallet.accountId);
if (BigInt(ownerState.amount) < 15n * 10n ** 23n) {
  const amount = 15n * 10n ** 23n - BigInt(ownerState.amount);
  await record(
    contractAccount.signAndSendTransaction({
      receiverId: ownerWallet.accountId,
      actions: [actions.transfer(amount)],
      waitUntil: "FINAL",
    }),
    "provide-owner-test-setup-assets",
  );
}
async function call(method, args, deposit = 0n) {
  return record(
    owner.signAndSendTransaction({
      receiverId: wallet.accountId,
      actions: [actions.functionCall(method, args, teraToGas("80"), deposit)],
      waitUntil: "FINAL",
    }),
    method,
  );
}
for (const a of GENESIS_AGENTS) {
  const existing = await provider.callFunction({
    contractId: wallet.accountId,
    method: "get_professional",
    args: { agent_id: a.id },
    blockQuery: { finality: "final" },
  });
  if (existing) {
    if (
      existing.profession !== a.profession ||
      JSON.stringify(existing.services) !== JSON.stringify(a.services)
    )
      throw Error("Genesis identity mismatch: " + a.id);
    continue;
  }
  await call(
    "mint_professional",
    {
      agent_id: a.id,
      receiver_id: ownerWallet.accountId,
      name: a.name,
      profession: a.profession,
      services: a.services,
      provenance: "econia:genesis-2:" + a.id,
    },
    3n * 10n ** 22n,
  );
  evidence.genesis.push({ id: a.id, name: a.name, profession: a.profession });
  save();
}
const custody = await provider.callFunction({
  contractId: wallet.accountId,
  method: "custody",
  args: {},
  blockQuery: { finality: "final" },
});
if (BigInt(custody.execution_storage) < 3n * 10n ** 23n)
  await call(
    "fund_execution_storage",
    {},
    3n * 10n ** 23n - BigInt(custody.execution_storage),
  );
const supply = await provider.callFunction({
  contractId: wallet.accountId,
  method: "nft_total_supply",
  args: {},
  blockQuery: { finality: "final" },
});
if (Number(supply) !== GENESIS_AGENTS.length)
  throw Error("Genesis NFT supply mismatch");
evidence.verified = true;
evidence.verifiedAt = new Date().toISOString();
evidence.supply = String(supply);
evidence.startingCapitalYocto = "0";
evidence.operator = {
  permission: "FunctionCall",
  methods: [
    "deliver_service_job",
    "open_agent_service_job",
    "accept_service_job",
  ],
  allowanceYocto: (2n * 10n ** 23n).toString(),
  noFullAccessKeyUploaded: true,
};
save();
console.log(
  JSON.stringify({
    verified: true,
    contract: wallet.accountId,
    owner: ownerWallet.accountId,
    supply: String(supply),
    network: "testnet",
  }),
);
