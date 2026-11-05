import {
  Account,
  JsonRpcProvider,
  KeyPair,
  actions,
  nearToYocto,
  teraToGas,
} from "near-api-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { genesis } from "../packages/simulation-core/index.mjs";
import { openRepository } from "../packages/database/index.mjs";
const wallet = JSON.parse(
    readFileSync(".private/near-testnet-wallet.json", "utf8"),
  ),
  deployment = JSON.parse(readFileSync(".private/deployment.json", "utf8"));
const provider = new JsonRpcProvider({ url: deployment.rpc }),
  owner = new Account(wallet.accountId, provider, wallet.secretKey),
  seller = new Account(deployment.eco, provider, wallet.secretKey);
const evidence = JSON.parse(
  readFileSync("docs/testnet-deployment.json", "utf8"),
);
const save = () =>
  writeFileSync(
    "docs/testnet-deployment.json",
    JSON.stringify(evidence, null, 2),
  );
async function record(label, txPromise) {
  const tx = await txPromise;
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
const repo = await openRepository({
  url: "",
  path: ".data/econia-testnet.sqlite",
});
try {
  const ownerState = await provider.query({
    request_type: "view_account",
    finality: "final",
    account_id: wallet.accountId,
  });
  if (BigInt(ownerState.amount) < nearToYocto("0.8")) {
    const worldAccount = new Account(
        deployment.world,
        provider,
        wallet.secretKey,
      ),
      state = await provider.query({
        request_type: "view_account",
        finality: "final",
        account_id: deployment.world,
      });
    const available =
      BigInt(state.amount) - BigInt(state.storage_usage) * 10n ** 19n;
    const move = available - nearToYocto("0.2");
    if (move > 0n)
      await record(
        "Rebalance project deployment gas",
        worldAccount.signAndSendTransaction({
          receiverId: wallet.accountId,
          actions: [actions.transfer(move)],
          waitUntil: "FINAL",
        }),
      );
  }
  if (await repo.load())
    throw new Error("Testnet world is already initialized; refusing to reseed");
  const w = genesis("econia-genesis-1", 64);
  w.mode = "testnet";
  w.chain = {
    network: "testnet",
    eco: deployment.eco,
    world: deployment.world,
    owner: wallet.accountId,
    rpc: deployment.rpc,
  };
  for (const e of Object.values(w.entities))
    e.owner =
      e.type === "PERSON" &&
      e.id !== "person_199" &&
      !["person_101", "person_102", "person_103"].includes(e.id)
        ? deployment.eco
        : wallet.accountId;
  const entities = Object.values(w.entities);
  const existing = await provider.callFunction({
    contractId: deployment.world,
    method: "nft_tokens",
    args: { from_index: "0", limit: 1000 },
  });
  const known = new Set(existing.map((t) => t.token_id));
  const missing = entities.filter((e) => !known.has(e.id));
  for (let i = 0; i < missing.length; i += 10) {
    const group = missing.slice(i, i + 10);
    await record(
      `Mint genesis entities ${i + 1}–${i + group.length}`,
      owner.callFunctionRaw({
        contractId: deployment.world,
        methodName: "mint_batch",
        args: {
          entities: group.map((e) => ({
            entity_id: e.id,
            receiver_id: e.owner,
            entity_type: e.type,
            name: e.name,
            provenance: `genesis:${w.seed}`,
          })),
        },
        gas: teraToGas("250"),
        deposit: nearToYocto(String(group.length * 0.015)),
        waitUntil: "FINAL",
      }),
    );
  }
  const unfunded = [];
  for (const e of entities) {
    const entry = await provider.callFunction({
      contractId: deployment.world,
      method: "get_entity",
      args: { entity_id: e.id },
    });
    if (BigInt(entry.treasury) === 0n) unfunded.push(e);
    else if (BigInt(entry.treasury) !== BigInt(e.cash))
      throw new Error(`Genesis mismatch ${e.id}`);
  }
  for (let i = 0; i < unfunded.length; i += 20) {
    const group = unfunded.slice(i, i + 20),
      amount = group.reduce((n, e) => n + e.cash, 0);
    await record(
      `Fund genesis treasuries ${i + 1}–${i + group.length}`,
      owner.callFunctionRaw({
        contractId: deployment.eco,
        methodName: "ft_transfer_call",
        args: {
          receiver_id: deployment.world,
          amount: String(amount),
          msg: JSON.stringify({
            kind: "GenesisBatch",
            allocations: group.map((e) => ({
              entity_id: e.id,
              amount: String(e.cash),
            })),
          }),
        },
        gas: teraToGas("250"),
        deposit: 1n,
        waitUntil: "FINAL",
      }),
    );
  }
  const registered = await provider.callFunction({
    contractId: deployment.world,
    method: "wallet_registered",
    args: { account_id: deployment.eco },
  });
  if (!registered)
    await record(
      "Register genesis distribution seller",
      seller.callFunctionRaw({
        contractId: deployment.world,
        methodName: "register_wallet",
        args: {},
        gas: teraToGas("30"),
        deposit: nearToYocto("0.01"),
        waitUntil: "FINAL",
      }),
    );
  const listings = w.listings.map((l) => ({ ...l, seller: deployment.eco }));
  const sellerState = await provider.query({
    request_type: "view_account",
    finality: "final",
    account_id: deployment.eco,
  });
  if (
    BigInt(sellerState.amount) -
      BigInt(sellerState.storage_usage) * 10n ** 19n <
    nearToYocto("0.22")
  )
    await record(
      "Fund distribution listing gas",
      owner.signAndSendTransaction({
        receiverId: deployment.eco,
        actions: [actions.transfer(nearToYocto("0.2"))],
        waitUntil: "FINAL",
      }),
    );
  await record(
    "List founding Living Assets",
    seller.signAndSendTransaction({
      receiverId: deployment.world,
      actions: listings.map((l) =>
        actions.functionCall(
          "list_asset",
          { entity_id: l.entity, ask: String(l.ask) },
          teraToGas("20"),
          1n,
        ),
      ),
      waitUntil: "FINAL",
    }),
  );
  w.listings = listings;
  const operatorFile = ".private/operator.json";
  let operator;
  if (existsSync(operatorFile))
    operator = JSON.parse(readFileSync(operatorFile, "utf8"));
  else {
    const key = KeyPair.fromRandom("ed25519");
    operator = {
      accountId: wallet.accountId,
      secretKey: key.toString(),
      publicKey: key.getPublicKey().toString(),
    };
    writeFileSync(operatorFile, JSON.stringify(operator, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
  }
  let access;
  try {
    access = await provider.query({
      request_type: "view_access_key",
      finality: "final",
      account_id: operator.accountId,
      public_key: operator.publicKey,
    });
  } catch {}
  if (!access)
    await record(
      "Install restricted simulation operator key",
      owner.addFunctionCallAccessKey({
        publicKey: operator.publicKey,
        contractId: deployment.world,
        methodNames: ["settle_batch"],
        allowance: nearToYocto("0.5"),
      }),
    );
  w.chain.lastBatch = 0;
  await repo.save(w);
  evidence.genesis = {
    seed: w.seed,
    population: 64,
    entities: entities.length,
    entityTreasuryTotal: String(w.supply),
    cycle: 0,
  };
  save();
  console.log(
    JSON.stringify({
      initialized: true,
      entities: entities.length,
      treasuryTotal: w.supply,
    }),
  );
} finally {
  await repo.close();
}
