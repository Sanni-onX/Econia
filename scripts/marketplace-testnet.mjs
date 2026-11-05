import { Account, JsonRpcProvider, teraToGas } from "near-api-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const wallet = JSON.parse(
    readFileSync(".private/near-testnet-wallet.json", "utf8"),
  ),
  deployment = JSON.parse(readFileSync(".private/deployment.json", "utf8"));
const provider = new JsonRpcProvider({ url: deployment.rpc }),
  owner = new Account(wallet.accountId, provider, wallet.secretKey),
  token = readFileSync(".private/testnet-admin-token", "utf8").trim();
const call = async (path, body, admin = false) => {
  const response = await fetch("http://127.0.0.1:3003" + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      ...(admin ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
};
await call("/api/admin/control", { paused: true }, true);
const file = "docs/testnet-marketplace.json",
  evidence = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : { network: "testnet" };
const initial = await (await fetch("http://127.0.0.1:3003/api/world")).json();
if (!evidence.hash) {
  const listing = initial.listings.find(
    (l) => l.status === "ACTIVE" && l.seller !== wallet.accountId,
  );
  if (!listing) throw new Error("No available asset");
  evidence.entityId = listing.entity;
  evidence.before = initial.entities.find((e) => e.id === listing.entity);
  const tx = await owner.callFunctionRaw({
    contractId: deployment.eco,
    methodName: "ft_transfer_call",
    args: {
      receiver_id: deployment.world,
      amount: String(listing.ask),
      msg: JSON.stringify({ kind: "Buy", entity_id: listing.entity }),
    },
    gas: teraToGas("150"),
    deposit: 1n,
    waitUntil: "FINAL",
  });
  evidence.hash = tx.transaction.hash;
  evidence.explorer = `https://testnet.nearblocks.io/txns/${tx.transaction.hash}`;
  writeFileSync(file, JSON.stringify(evidence, null, 2));
}
await call("/api/marketplace", {
  hash: evidence.hash,
  sender: wallet.accountId,
});
const after = await (await fetch("http://127.0.0.1:3003/api/world")).json();
evidence.after = after.entities.find((e) => e.id === evidence.entityId);
evidence.ownerVerified =
  (
    await provider.callFunction({
      contractId: deployment.world,
      method: "nft_token",
      args: { token_id: evidence.entityId },
    })
  ).owner_id === wallet.accountId;
evidence.identityPreserved =
  JSON.stringify({ ...evidence.before, owner: evidence.after.owner }) ===
  JSON.stringify(evidence.after);
evidence.verifiedAt = new Date().toISOString();
writeFileSync(file, JSON.stringify(evidence, null, 2));
if (!evidence.ownerVerified || !evidence.identityPreserved)
  throw new Error("Ownership or persistent identity assertion failed");
console.log(
  JSON.stringify({
    entityId: evidence.entityId,
    hash: evidence.hash,
    explorer: evidence.explorer,
    ownerVerified: evidence.ownerVerified,
    identityPreserved: evidence.identityPreserved,
  }),
);
