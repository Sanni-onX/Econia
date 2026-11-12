import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  SignedTransaction,
  actions,
  baseEncode,
  teraToGas,
} from "near-api-js";
import { GENESIS_AGENTS } from "../packages/agent-runtime/genesis.mjs";
import { createProfessionalChain } from "../packages/near/professional-testnet.mjs";

const mode = process.argv[2];
if (!["--prepare", "--rehearse", "--deploy"].includes(mode))
  throw Error("Choose --prepare, --rehearse or --deploy explicitly");
const json = (value, space) =>
  JSON.stringify(
    value,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    space,
  );
const sha = (x) => createHash("sha256").update(x).digest("hex");
const save = (path, value) =>
  writeFileSync(path, json(value, 2) + "\n", { mode: 0o600 });
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const migration = readFileSync(".private/econia-professional-migration.wasm");
const release = readFileSync(".private/econia-professional-mainnet.wasm");
const profiles = GENESIS_AGENTS.map((a) => ({
  agent_id: a.id,
  name: a.name,
  profession: a.profession,
  services: a.services,
  provenance: `econia-professionals:genesis-2:${a.id}`,
}));
const artifacts = {
  migrationSha256: sha(migration),
  releaseSha256: sha(release),
  migrationBytes: migration.length,
  releaseBytes: release.length,
  profilesSha256: sha(json(profiles)),
};
const methods = [
  "deliver_service_job",
  "open_agent_service_job",
  "accept_service_job",
];
const mainnet = new JsonRpcProvider(
  {
    url: process.env.NEAR_MAINNET_RPC_URL || "https://rpc.mainnet.fastnear.com",
  },
  { retries: 3, wait: 500, backoff: 1.5 },
);
const prior = read("docs/mainnet-deployment.json");
const previousCodeSha = read("docs/native-view-upgrade.json").wasmSha256;
if ((await mainnet.getNetworkId()) !== "mainnet")
  throw Error("Mainnet RPC mismatch");
const view = (p, id, method, args = {}, blockQuery = { finality: "final" }) =>
  p.callFunction({ contractId: id, method, args, blockQuery });
const fees = (tx) =>
  [tx.transaction_outcome, ...(tx.receipts_outcome || [])].reduce(
    (n, x) => n + BigInt(x.outcome.tokens_burnt),
    0n,
  );
function success(tx) {
  if (
    !Object.hasOwn(tx.status || {}, "SuccessValue") ||
    (tx.receipts_outcome || []).some((x) => x.outcome.status?.Failure)
  )
    throw Error("Transaction failed; inspect recorded hash before continuing");
}
const batch = (publicKey) => [
  actions.deployContract(migration),
  actions.functionCall(
    "migrate_native",
    { profiles, expected_supply: 64 },
    teraToGas("260"),
    0n,
  ),
  actions.deployContract(release),
  actions.functionCall("assert_custody_backed", {}, teraToGas("10"), 0n),
  actions.addFunctionCallAccessKey(
    KeyPair.fromString(publicKey.secretKey).getPublicKey(),
    publicKey.contract,
    methods,
    2n * 10n ** 22n,
  ),
];

if (mode === "--prepare") {
  const block = await mainnet.viewBlock({ finality: "final" }),
    query = { blockId: block.header.hash };
  const [account, custody, tokens, agents, code, protocol] = await Promise.all([
    mainnet.viewAccount({ accountId: prior.contract, blockQuery: query }),
    view(mainnet, prior.contract, "custody", {}, query),
    view(
      mainnet,
      prior.contract,
      "nft_tokens",
      { from_index: "0", limit: 100 },
      query,
    ),
    view(
      mainnet,
      prior.contract,
      "get_agents",
      {
        agent_ids: read("docs/mainnet-reuse-preflight.json").tokens.map(
          (t) => t.id,
        ),
      },
      query,
    ),
    mainnet.query({
      request_type: "view_code",
      account_id: prior.contract,
      block_id: block.header.hash,
    }),
    mainnet.sendJsonRpc("EXPERIMENTAL_protocol_config", {
      block_id: block.header.hash,
    }),
  ]);
  const oldCode = Buffer.from(code.code_base64, "base64");
  if (
    sha(oldCode) !== previousCodeSha ||
    !custody.paused ||
    [custody.treasuries, custody.jobs, custody.refunds].some(
      (n) => n !== "0",
    ) ||
    tokens.length !== 64 ||
    Object.keys(agents).length !== 64 ||
    Object.values(agents).some((a) => a.treasury !== "0")
  )
    throw Error("Legacy release changed; migration refused");
  const backup = {
    network: "mainnet",
    contract: prior.contract,
    blockHeight: block.header.height,
    blockHash: block.header.hash,
    account,
    custody,
    tokens,
    agents,
  };
  save(".private/mainnet-before-professional-records.json", backup);
  writeFileSync(".private/mainnet-before-professional.wasm", oldCode);
  const missing = profiles.filter(
    (a) => !tokens.some((t) => t.token_id === a.agent_id),
  );
  const plan = {
    preparedAt: new Date().toISOString(),
    network: "mainnet",
    contract: prior.contract,
    ...artifacts,
    previousSha256: sha(oldCode),
    backupSha256: sha(json(backup)),
    blockHeight: block.header.height,
    balanceYocto: account.amount,
    storageBytes: account.storage_usage,
    storageCostYoctoPerByte: protocol.runtime_config.storage_amount_per_byte,
    originalNfts: tokens.length,
    newProfessionalNfts: missing.length,
    professionalCount: profiles.length,
    initialCapitalYocto: "0",
    upgradeFeeCeilingYocto: "40000000000000000000000",
    workerGasAllowanceYocto: "20000000000000000000000",
    workerMethods: methods,
    privateKeyUpload: "Not authorized or performed by this script",
    upgrade:
      "One atomic receipt: temporary migration code, preserve old NFTs/activate Genesis, final smaller release code, backing check, restricted function key. No NFT burn, fund transfer or operating capital allocation.",
  };
  save("docs/professional-mainnet-plan.json", plan);
  console.log(json(plan));
  process.exit();
}

const plan = read("docs/professional-mainnet-plan.json");
if (
  Object.entries(artifacts).some(([k, v]) => plan[k] !== v) ||
  plan.contract !== prior.contract
)
  throw Error("Reviewed artifacts or Genesis profiles changed; prepare again");

if (mode === "--rehearse") {
  const p = new JsonRpcProvider(
    { url: "https://test.rpc.fastnear.com" },
    { retries: 3, wait: 500, backoff: 1.5 },
  );
  if ((await p.getNetworkId()) !== "testnet")
    throw Error("Rehearsal is testnet only");
  const path = ".private/professional-migration-rehearsal.json";
  let w;
  if (existsSync(path)) w = read(path);
  else {
    const key = KeyPair.fromRandom("ed25519");
    const op = KeyPair.fromRandom("ed25519");
    w = {
      network: "testnet",
      accountId: `econia-upgrade-${randomBytes(4).toString("hex")}.testnet`,
      secretKey: key.toString(),
      publicKey: key.getPublicKey().toString(),
      operatorKey: op.toString(),
      transactions: [],
    };
    save(path, w);
  }
  const account = new Account(w.accountId, p, w.secretKey);
  let state;
  try {
    state = await p.viewAccount({
      accountId: w.accountId,
      blockQuery: { finality: "final" },
    });
  } catch (e) {
    if (!/does not exist|UNKNOWN_ACCOUNT/i.test(e.message)) throw e;
    const r = await fetch("https://helper.testnet.near.org/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json({
        newAccountId: w.accountId,
        newAccountPublicKey: w.publicKey,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw Error("Rehearsal faucet unavailable: " + r.status);
    state = await p.viewAccount({
      accountId: w.accountId,
      blockQuery: { finality: "final" },
    });
  }
  const send = async (label, txActions) => {
    if (w.pending)
      throw Error("Rehearsal transaction pending; inspect before retry");
    const signed = await account.createSignedTransaction({
      receiverId: w.accountId,
      actions: txActions,
    });
    w.pending = {
      label,
      hash: baseEncode(
        createHash("sha256").update(signed.transaction.encode()).digest(),
      ),
    };
    save(path, w);
    const tx = await p.sendTransactionUntil(signed, "FINAL");
    w.transactions.push({
      label,
      hash: tx.transaction.hash,
      feesYocto: fees(tx).toString(),
      success: Object.hasOwn(tx.status || {}, "SuccessValue"),
    });
    w.pending = null;
    save(path, w);
    success(tx);
    return tx;
  };
  const backup = read(".private/mainnet-before-professional-records.json");
  if (state.code_hash === "11111111111111111111111111111111") {
    await send("install-previous-release", [
      actions.deployContract(
        readFileSync(".private/mainnet-before-professional.wasm"),
      ),
      actions.functionCall(
        "new",
        { owner_id: w.accountId, operator_id: w.accountId },
        teraToGas("60"),
        0n,
      ),
    ]);
  }
  if (
    !w.transactions.some(
      (t) => t.label === "atomic-professional-migration" && t.success,
    )
  ) {
    for (const token of backup.tokens) {
      if (await view(p, w.accountId, "nft_token", { token_id: token.token_id }))
        continue;
      await send("legacy-mint:" + token.token_id, [
        actions.functionCall(
          "mint_agent",
          {
            agent_id: token.token_id,
            receiver_id: w.accountId,
            name: token.metadata.title,
            provenance: backup.agents[token.token_id].provenance,
          },
          teraToGas("30"),
          10n ** 22n,
        ),
      ]);
    }
    const custody = await view(p, w.accountId, "custody");
    if (!custody.paused)
      await send("pause-legacy", [
        actions.functionCall(
          "set_world_paused",
          { paused: true },
          teraToGas("10"),
          1n,
        ),
      ]);
    // Constrain the rehearsal to the real mainnet balance. Self-transfer does
    // not reduce balance; the excess is returned to the project testnet owner.
    const current = await p.viewAccount({
      accountId: w.accountId,
      blockQuery: { finality: "final" },
    });
    const target = BigInt(plan.balanceYocto);
    if (BigInt(current.amount) < target) {
      const owner = read(".private/near-testnet-wallet.json");
      const r = await new Account(
        owner.accountId,
        p,
        owner.secretKey,
      ).signAndSendTransaction({
        receiverId: w.accountId,
        actions: [actions.transfer(target - BigInt(current.amount))],
        waitUntil: "FINAL",
      });
      success(r);
      w.transactions.push({
        label: "restore-matched-testnet-balance",
        hash: r.transaction.hash,
        feesYocto: fees(r).toString(),
      });
      save(path, w);
    }
    if (BigInt(current.amount) > target + 10n ** 21n) {
      const owner = read(".private/near-testnet-wallet.json");
      const r = await account.signAndSendTransaction({
        receiverId: owner.accountId,
        actions: [actions.transfer(BigInt(current.amount) - target)],
        waitUntil: "FINAL",
      });
      success(r);
      w.transactions.push({
        label: "match-mainnet-balance",
        hash: r.transaction.hash,
        feesYocto: fees(r).toString(),
      });
      save(path, w);
    }
    await send(
      "atomic-professional-migration",
      batch({ contract: w.accountId, secretKey: w.operatorKey }),
    );
  }
  const chain = await createProfessionalChain({
    network: "testnet",
    contract: w.accountId,
    operatorKey: w.operatorKey,
    provider: p,
  });
  const registry = await chain.readRegistry(GENESIS_AGENTS);
  const tokens = await view(p, w.accountId, "nft_tokens", {
    from_index: "0",
    limit: 100,
  });
  for (const old of backup.tokens) {
    const token = tokens.find((t) => t.token_id === old.token_id);
    if (
      !token ||
      token.owner_id !== w.accountId ||
      json(token.metadata) !== json(old.metadata)
    )
      throw Error("Old NFT metadata/ownership was not preserved");
  }
  const after = await p.viewAccount({
    accountId: w.accountId,
    blockQuery: { finality: "final" },
  });
  if (
    after.code_hash !==
      baseEncode(Buffer.from(artifacts.releaseSha256, "hex")) ||
    registry.custody.treasuries !== "0"
  )
    throw Error("Rehearsal release mismatch");
  const report = {
    verified: true,
    verifiedAt: new Date().toISOString(),
    network: "testnet",
    contract: w.accountId,
    ...artifacts,
    mainnetBalanceMatched: true,
    originalNftsPreserved: 64,
    totalNfts: tokens.length,
    professionalCount: registry.identities.length,
    storageBytes: after.storage_usage,
    endingBalanceYocto: after.amount,
    upgradeTransaction: w.transactions.find(
      (t) => t.label === "atomic-professional-migration" && t.success,
    ),
    allTransactions: w.transactions,
    startingCapital: "0",
    fullKeysUploaded: false,
  };
  save("docs/professional-mainnet-rehearsal.json", report);
  console.log(json(report));
  process.exit();
}

const rehearsal = read("docs/professional-mainnet-rehearsal.json");
if (
  !rehearsal.verified ||
  Object.entries(artifacts).some(([k, v]) => rehearsal[k] !== v)
)
  throw Error("Matching on-chain rehearsal required");
const wallet = read(".private/near-mainnet-wallet.json");
if (wallet.network !== "mainnet" || wallet.accountId !== plan.contract)
  throw Error("Mainnet wallet mismatch");
const account = new Account(wallet.accountId, mainnet, wallet.secretKey);
const opPath = ".private/econia-2-mainnet-operator.json";
let worker;
if (existsSync(opPath)) worker = read(opPath);
else {
  const k = KeyPair.fromRandom("ed25519");
  worker = {
    network: "mainnet",
    contract: wallet.accountId,
    secretKey: k.toString(),
    publicKey: k.getPublicKey().toString(),
    methods,
    allowance: plan.workerGasAllowanceYocto,
  };
  save(opPath, worker);
}
const journalPath = ".private/professional-mainnet-upgrade-transaction.json";
let journal;
if (existsSync(journalPath)) journal = read(journalPath);
else {
  const current = await mainnet.viewAccount({
    accountId: wallet.accountId,
    blockQuery: { finality: "final" },
  });
  const custody = await view(mainnet, wallet.accountId, "custody");
  if (
    current.code_hash !== baseEncode(Buffer.from(plan.previousSha256, "hex")) ||
    !custody.paused ||
    [custody.treasuries, custody.jobs, custody.refunds].some((n) => n !== "0")
  )
    throw Error("Fresh legacy guards failed");
  const required =
    BigInt(
      rehearsal.storageBytes +
        (wallet.accountId.length - rehearsal.contract.length) *
          (rehearsal.totalNfts + 8),
    ) *
      BigInt(plan.storageCostYoctoPerByte) +
    BigInt(plan.upgradeFeeCeilingYocto) +
    BigInt(plan.workerGasAllowanceYocto);
  if (BigInt(current.amount) < required)
    throw Error(
      "Balance insufficient for rehearsed final storage, fee cap and worker allowance",
    );
  const signed = await account.createSignedTransaction({
    receiverId: wallet.accountId,
    actions: batch(worker),
  });
  journal = {
    network: "mainnet",
    contract: wallet.accountId,
    artifacts,
    hash: baseEncode(
      createHash("sha256").update(signed.transaction.encode()).digest(),
    ),
    signedBase64: Buffer.from(signed.encode()).toString("base64"),
    state: "PREPARED",
  };
  save(journalPath, journal);
}
if (
  json(journal.artifacts) !== json(artifacts) ||
  journal.contract !== wallet.accountId
)
  throw Error("Pending transaction belongs to different artifacts");
let tx;
try {
  tx = await mainnet.viewTransactionStatus({
    txHash: journal.hash,
    accountId: wallet.accountId,
    waitUntil: "NONE",
  });
} catch (e) {
  if (
    !/does(?: not|n't) exist|UNKNOWN_TRANSACTION|not found/i.test(e.message) &&
    !/UnknownTransaction/i.test(e.name)
  )
    throw Error(
      "Cannot reconcile prepared hash; no replacement will be signed",
    );
}
if (!tx)
  tx = await mainnet.sendTransactionUntil(
    SignedTransaction.decode(Buffer.from(journal.signedBase64, "base64")),
    "FINAL",
  );
else if (tx.final_execution_status !== "FINAL")
  tx = await mainnet.viewTransactionStatus({
    txHash: journal.hash,
    accountId: wallet.accountId,
    waitUntil: "FINAL",
  });
journal.state = "CONFIRMED";
save(journalPath, journal);
success(tx);
if (fees(tx) > BigInt(plan.upgradeFeeCeilingYocto))
  throw Error(
    "Actual fee exceeded conservative ceiling; stop further spending",
  );
const chain = await createProfessionalChain({
  network: "mainnet",
  contract: wallet.accountId,
  operatorKey: worker.secretKey,
  provider: mainnet,
});
const registry = await chain.readRegistry(GENESIS_AGENTS);
const tokens = await view(mainnet, wallet.accountId, "nft_tokens", {
  from_index: "0",
  limit: 100,
});
const backup = read(".private/mainnet-before-professional-records.json");
for (const old of backup.tokens)
  if (json(tokens.find((t) => t.token_id === old.token_id)) !== json(old))
    throw Error("Post-upgrade legacy NFT verification failed");
const after = await mainnet.viewAccount({
  accountId: wallet.accountId,
  blockQuery: { finality: "final" },
});
if (after.code_hash !== baseEncode(Buffer.from(artifacts.releaseSha256, "hex")))
  throw Error("Final code mismatch");
const report = {
  verified: true,
  network: "mainnet",
  contract: wallet.accountId,
  verifiedAt: new Date().toISOString(),
  ...artifacts,
  transactionHash: tx.transaction.hash,
  feesYocto: fees(tx).toString(),
  storageBytes: after.storage_usage,
  balanceYocto: after.amount,
  storageLockedYocto: (
    BigInt(after.storage_usage) * BigInt(plan.storageCostYoctoPerByte)
  ).toString(),
  originalNftsPreserved: 64,
  totalNfts: tokens.length,
  professionalCount: registry.identities.length,
  custody: registry.custody,
  worker: {
    publicKey: worker.publicKey,
    methods,
    gasAllowanceYocto: worker.allowance,
    uploaded: false,
  },
  startingCapitalYocto: "0",
};
save("docs/professional-mainnet-deployment.json", report);
console.log(json(report));
