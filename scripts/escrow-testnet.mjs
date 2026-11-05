import { Account, JsonRpcProvider, teraToGas, nearToYocto } from "near-api-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const wallet = JSON.parse(
    readFileSync(".private/near-testnet-wallet.json", "utf8"),
  ),
  deployment = JSON.parse(readFileSync(".private/deployment.json", "utf8"));
const provider = new JsonRpcProvider({ url: deployment.rpc }),
  owner = new Account(wallet.accountId, provider, wallet.secretKey),
  seller = new Account(deployment.eco, provider, wallet.secretKey);
const file = "docs/testnet-escrow.json",
  evidence = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : { network: "testnet", transactions: [] };
const view = (contractId, method, args = {}) =>
  provider.callFunction({ contractId, method, args });
async function record(label, operation) {
  const tx = await operation;
  const data = {
    label,
    hash: tx.transaction.hash,
    explorer: `https://testnet.nearblocks.io/txns/${tx.transaction.hash}`,
  };
  evidence.transactions.push(data);
  writeFileSync(file, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(data));
  return tx;
}
if (
  !(await view(deployment.eco, "faucet_claimed", {
    account_id: deployment.eco,
  }))
) {
  const supply = await view(deployment.eco, "ft_total_supply");
  await record(
    "Finite faucet claim: 250 existing ECO",
    seller.callFunctionRaw({
      contractId: deployment.eco,
      methodName: "claim_test_eco",
      args: {},
      gas: teraToGas("50"),
      deposit: nearToYocto("0.01"),
      waitUntil: "FINAL",
    }),
  );
  evidence.faucetPreservedSupply =
    supply === (await view(deployment.eco, "ft_total_supply"));
}
const entityId = "person_105",
  amount = "10000";
if (!evidence.offered) {
  evidence.walletBefore = await view(deployment.eco, "ft_balance_of", {
    account_id: wallet.accountId,
  });
  await record(
    "Escrow 10 ECO offer",
    owner.callFunctionRaw({
      contractId: deployment.eco,
      methodName: "ft_transfer_call",
      args: {
        receiver_id: deployment.world,
        amount,
        msg: JSON.stringify({ kind: "Offer", entity_id: entityId }),
      },
      gas: teraToGas("150"),
      deposit: 1n,
      waitUntil: "FINAL",
    }),
  );
  evidence.offered = true;
  writeFileSync(file, JSON.stringify(evidence, null, 2));
}
if (
  await view(deployment.world, "get_offer", {
    entity_id: entityId,
    buyer: wallet.accountId,
  })
)
  await record(
    "Cancel offer and release escrow credit",
    owner.callFunctionRaw({
      contractId: deployment.world,
      methodName: "cancel_offer",
      args: { entity_id: entityId },
      gas: teraToGas("50"),
      deposit: 1n,
      waitUntil: "FINAL",
    }),
  );
if (
  (await view(deployment.world, "wallet_balance", {
    account_id: wallet.accountId,
  })) === "10000"
)
  await record(
    "Withdraw released 10 ECO to wallet",
    owner.callFunctionRaw({
      contractId: deployment.world,
      methodName: "withdraw",
      args: { amount },
      gas: teraToGas("100"),
      deposit: 1n,
      waitUntil: "FINAL",
    }),
  );
evidence.walletAfter = await view(deployment.eco, "ft_balance_of", {
  account_id: wallet.accountId,
});
evidence.roundTripBalanced = evidence.walletBefore === evidence.walletAfter;
evidence.verifiedAt = new Date().toISOString();
writeFileSync(file, JSON.stringify(evidence, null, 2));
if (!evidence.roundTripBalanced || !evidence.faucetPreservedSupply)
  throw new Error("Escrow or faucet invariant failed");
console.log(
  JSON.stringify({ roundTripBalanced: true, faucetPreservedSupply: true }),
);
