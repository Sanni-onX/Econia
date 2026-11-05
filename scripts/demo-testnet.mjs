import { Account, JsonRpcProvider, teraToGas } from "near-api-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const wallet = JSON.parse(
    readFileSync(".private/near-testnet-wallet.json", "utf8"),
  ),
  deployment = JSON.parse(readFileSync(".private/deployment.json", "utf8"));
const provider = new JsonRpcProvider({ url: deployment.rpc }),
  owner = new Account(wallet.accountId, provider, wallet.secretKey);
const file = "docs/testnet-demo.json";
const evidence = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : { network: "testnet", owner: wallet.accountId, transactions: [] };
if (!evidence.sponsorshipHash) {
  const tx = await owner.callFunctionRaw({
    contractId: deployment.eco,
    methodName: "ft_transfer_call",
    args: {
      receiver_id: deployment.world,
      amount: "100000",
      msg: JSON.stringify({ kind: "Sponsor", entity_id: "person_199" }),
    },
    gas: teraToGas("150"),
    deposit: 1n,
    waitUntil: "FINAL",
  });
  evidence.sponsorshipHash = tx.transaction.hash;
  evidence.transactions.push({
    label: "Sponsor Mira with 100 actual test ECO",
    hash: tx.transaction.hash,
    explorer: `https://testnet.nearblocks.io/txns/${tx.transaction.hash}`,
  });
  writeFileSync(file, JSON.stringify(evidence, null, 2));
}
let applied = false;
for (let attempt = 0; attempt < 30; attempt++) {
  const response = await fetch(
    "http://127.0.0.1:3003/api/entities/person_199/sponsor",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": evidence.sponsorshipHash,
      },
      body: JSON.stringify({
        hash: evidence.sponsorshipHash,
        sender: wallet.accountId,
      }),
    },
  );
  const result = await response.json();
  if (response.ok) {
    applied = true;
    break;
  }
  if (response.status !== 409) throw new Error(JSON.stringify(result));
  await new Promise((r) => setTimeout(r, 1000));
}
if (!applied)
  throw new Error(
    "Sponsorship is final onchain; retry this script to finish local receipt ingestion.",
  );
if (process.argv.includes("--advance")) {
  const token = readFileSync(".private/testnet-admin-token", "utf8").trim();
  const r = await fetch("http://127.0.0.1:3003/api/admin/tick", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ count: 5 }),
  });
  if (!r.ok) throw new Error(await r.text());
}
const world = await (await fetch("http://127.0.0.1:3003/api/world")).json();
const mira = world.entities.find((e) => e.id === "person_199");
evidence.cycle = world.cycle;
evidence.mira = {
  cash: mira.cash,
  sponsorship: mira.sponsorship,
  netWorth: mira.netWorth,
};
evidence.business =
  world.holdings.find((h) => h.owner === "person_199") || null;
evidence.verifiedAt = new Date().toISOString();
writeFileSync(file, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
