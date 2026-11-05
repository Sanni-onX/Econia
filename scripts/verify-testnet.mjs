import { readFileSync, writeFileSync } from "node:fs";
import { NearTestnetEcoAdapter } from "../packages/shared/near.mjs";
const deployment = JSON.parse(
  readFileSync("docs/testnet-deployment.json", "utf8"),
);
const adapter = new NearTestnetEcoAdapter({
  rpcUrl: "https://test.rpc.fastnear.com",
  ecoContract: deployment.eco,
  worldContract: deployment.world,
});
const demo = JSON.parse(readFileSync("docs/testnet-demo.json", "utf8")),
  market = JSON.parse(readFileSync("docs/testnet-marketplace.json", "utf8"));
const token = await adapter.view(deployment.eco, "ft_metadata"),
  supply = await adapter.view(deployment.eco, "ft_total_supply"),
  custody = await adapter.view(deployment.eco, "ft_balance_of", {
    account_id: deployment.world,
  }),
  state = await adapter.view(deployment.world, "settlement_state");
const sponsor = await adapter.sponsorshipReceipt(
    demo.sponsorshipHash,
    deployment.owner,
    "person_199",
  ),
  owner = await adapter.owner(market.entityId),
  mira = await adapter.entity("person_199");
const report = {
  verifiedAt: new Date().toISOString(),
  token,
  totalSupply: supply,
  custody,
  accounted: state.escrow_total,
  custodyBalanced: custody === state.escrow_total,
  lastBatch: state.last_batch,
  nftSupply: await adapter.view(deployment.world, "nft_total_supply"),
  miraTreasury: mira.treasury,
  miraSponsorship: mira.sponsored,
  sponsorshipHash: sponsor.hash,
  marketplaceHash: market.hash,
  marketplaceOwner: owner,
  marketplaceIdentityPreserved: market.identityPreserved,
};
if (
  !report.custodyBalanced ||
  mira.sponsored !== "100000" ||
  owner !== deployment.owner ||
  !market.identityPreserved
)
  throw new Error("Testnet evidence failed verification");
writeFileSync(
  "docs/testnet-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
