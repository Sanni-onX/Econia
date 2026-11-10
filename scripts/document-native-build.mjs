import { readFileSync, writeFileSync } from "node:fs";
import { formatNear } from "../packages/shared/native-state.mjs";
const r = await fetch("http://127.0.0.1:3004/api/native/world");
if (!r.ok) throw Error("Mainnet preview unavailable");
const world = await r.json();
if(world.intelligence.mode==='idle')throw Error('Virtual-role walkthrough generator retired. Preserve its historical records and update the service-economy documentation instead.');
if (world.stale) throw Error("Fresh verification required");
if (
  world.agents.length !== 64 ||
  world.agents.some((a) => !a.token || a.treasuryYocto !== "0")
)
  throw Error("Founding commissioning incomplete");
const historical = JSON.parse(readFileSync("docs/agent-roster.json"));
historical.scope =
  "Identity profiles and archived testnet cycle 161 work; employers and business stakes are not mainnet employment or assets";
for (const a of historical.agents) delete a.mainnetStatus;
writeFileSync(
  "docs/agent-roster.json",
  JSON.stringify(historical, null, 2) + "\n",
);
writeFileSync(
  "docs/native-mainnet-verification.json",
  JSON.stringify(
    {
      network: world.network,
      contract: world.contract,
      blockHeight: world.blockHeight,
      blockHash: world.blockHash,
      verifiedAt: world.verifiedAt,
      custody: world.custody,
      supply: world.agents.length,
      allTreasuriesZero: true,
      owners: [...new Set(world.agents.map((a) => a.token.owner_id))],
      planning: {
        completed: Object.values(world.plans.agents).filter((a) => a.plan)
          .length,
        dailyLimit: world.plans.dailyLimit,
        issue: world.plans.issue,
        agents: world.plans.agents,
      },
    },
    null,
    2,
  ) + "\n",
);
const escape = (s) =>
  String(s ?? "None")
    .replaceAll("|", "/")
    .replaceAll("\n", " ");
let doc = "# Econia: all 64 founding agents\n\n";
doc += `Verified on mainnet at block ${world.blockHeight}, ${world.verifiedAt}. All 64 NFTs are created; all treasuries hold 0 NEAR. All are initially owned by the project account. Economic settlement remains paused. AI plans and peer messages are offchain proposals, not executed trades or paid services.\n\n`;
doc +=
  "The four roles below came from the virtual city economy. They do not imply real farms, kitchens, shops or delivery businesses. Each agent has its own NFT identity and goal. The live preview shows its current AI plan when available.\n\n";
for (const role of ["Food artisan", "Grower", "Merchant", "Courier"]) {
  doc += `## ${role}s\n\n| Identity | Agent | Goal | Current AI status | Latest plan (excerpt; not execution) |\n| --- | --- | --- | --- | --- |\n`;
  for (const a of world.agents.filter((a) => a.role === role))
    doc += `| ${a.id} | ${escape(a.name)} | ${escape(a.goal)} | ${escape(world.plans.agents[a.id]?.status||'Awaiting plan')} | ${escape(world.plans.agents[a.id]?.plan?.slice(0,230)||'No completed mainnet plan recorded')} |\n`;
  doc += "\n";
}
doc +=
  "## What they are doing today\n\nThe planning worker asks each commissioned, unpaused agent to prepare a next-step plan and a collaboration proposal to a listed peer. It passes in the actual NEAR balance, the goal, previous plan, and recent peer proposals. It validates the response, saves accepted plans, and exposes them in the agent profile. The worker has no transaction signing key.\n\nEach agent has at most one planning attempt per UTC day, with 64 attempts across the population. Failed or interrupted calls consume an attempt; they are not silently retried or replaced by rules. Planning continues only while this local worker is running. A continuously hosted worker is still needed for a public always-on release.\n\nThe last archived testnet decision was WORK for all 64 agents. Twelve had private jobs and thirteen held business stakes. These records and their test ECO wages did not migrate to mainnet. No agent currently has a real customer job or earned mainnet revenue.\n";
writeFileSync("docs/64-AGENT-ROSTER.md", doc);
const deploy = JSON.parse(readFileSync("docs/mainnet-deployment.json"));
const mints = JSON.parse(readFileSync("docs/native-founding-agents.json"));
const upgrade = JSON.parse(readFileSync("docs/native-view-upgrade.json"));
const fees =
  deploy.transactions.reduce((n, t) => n + BigInt(t.feesYocto), 0n) +
  BigInt(mints.feesYocto) +
  BigInt(upgrade.feesYocto);
writeFileSync(
  "docs/CURRENT-BUILD-WALKTHROUGH.md",
  `# Econia current build and walkthrough\n\nVerified ${world.verifiedAt}. This is a mainnet ownership and treasury foundation with an AI planning preview. It is not yet a revenue-producing service economy.\n\n## Open the build\n\nRun \`npm run build\`, then \`npm run start:mainnet\`. Open http://127.0.0.1:3004/. Configure the existing NEAR AI key and model in the local .env; never commit them. No mainnet signing key is needed by this preview worker. The legacy testnet build remains available separately on port 3003.\n\n1. The header identifies NEAR mainnet. The city preserves the Blender and Higgsfield scenery. The scenery illustrates roles; it does not prove economic activity.\n2. Search or filter the full 64-agent roster, or select a character in the city. Buildings are illustrative premises from the earlier world, not additional mainnet NFTs.\n3. An agent profile shows its goal, current NFT owner, exact native NEAR treasury, settlement status, AI planning status and latest proposal. Earlier jobs and business stakes are labelled as archived testnet history.\n4. Connect Nightly, MyNearWallet, Sender, OKX or Intear on mainnet. Mainnet wallet sessions use separate storage from the old testnet session. Actual connection still requires the wallet's approval.\n5. A current owner can review a pause or NFT transfer in their wallet. Transfer preparation checks an existing mainnet recipient. The contract checks ownership at execution. These controls are implemented and contract-tested; no live mainnet NFT was transferred during verification.\n6. Operating capital uses a native NEAR payable call. All agents start at zero; deposits are currently closed because settlement is paused. A deposit would grant no ownership or promised return. Its value stays with the agent when the NFT changes owner.\n\n## What is built\n\n- 64 mainnet NEAR NFTs, with NEP-171 transfer, NEP-178 approval and NEP-181 enumeration interfaces. All are currently owned by the project account; no sale or public mint is open. External marketplace indexing and sale flows remain unverified.\n- Native NEAR treasury accounting tied to immutable agent ID. Exact 24-decimal amounts; liabilities and storage backing checked by the contract. No legacy ECO balances are relabelled as NEAR.\n- Finalized-block reads for ownership, custody and all agent records; treasury reconciliation before serving a new snapshot. Stale data is labelled, and transaction preparation refuses stale or paused capital flows.\n- NEAR AI planning, previous-plan context and peer proposal inboxes. At most four concurrent calls, one attempt per agent per UTC day, 64 total. Budget reservations survive restart. No rule-based fallback or automatic financial execution.\n- Contract primitives for customer-funded task escrow, operator delivery evidence, customer acceptance, expiry refunds and refund recovery. These are tested contract capabilities, not a connected customer service marketplace.\n- The 3D world and five-wallet connection interface, plus searchable individual agent profiles.\n\n## Money and ownership\n\nAgent capital: **0 NEAR each**. API credits pay inference separately. Recorded commissioning fees: **${formatNear(mints.feesYocto)} NEAR**. Total mainnet deployment, commissioning and read-view upgrade fees: **${formatNear(fees)} NEAR**. Account storage and liquid reserve are deployment infrastructure, not agent treasury. The project account still controls upgrades and the operator role; this is pooled contract custody rather than 64 independently signing agent wallets.\n\nAn NFT sale can transfer an agent with its treasury. Automated owner earnings withdrawals, dividends, revenue sharing and guaranteed yields are not implemented.\n\n## Still required before the full launch\n\nChoose and build a real paid service; connect requests to agent execution, deliverables, customer acceptance and payment. Add a reconciled native settlement executor and recovery workflow before opening autonomous transfers. Define and implement owner earnings policy if wanted. Verify external NFT marketplace listings, media, transfers and sales. Harden production deployment and admin custody, arrange an independent contract review, and operate a continuously hosted worker. Settlement remains paused while these pieces are incomplete.\n\nSee [every agent and its goal](64-AGENT-ROSTER.md), [founding mint receipts](native-founding-agents.json), [verified mainnet state](native-mainnet-verification.json), and [state-preserving view upgrade](native-view-upgrade.json).\n`,
);
console.log(
  JSON.stringify({
    supply: world.agents.length,
    feesNear: formatNear(fees),
    plans: Object.values(world.plans.agents).filter((a) => a.plan).length,
  }),
);
