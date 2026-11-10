# Econia current build and walkthrough

Verified 2026-11-10T08:56:38.362Z. This is a mainnet ownership and treasury foundation with an AI planning preview. It is not yet a revenue-producing service economy.

## Open the build

Run `npm run build`, then `npm run start:mainnet`. Open http://127.0.0.1:3004/. Configure the existing NEAR AI key and model in the local .env; never commit them. No mainnet signing key is needed by this preview worker. The legacy testnet build remains available separately on port 3003.

1. The header identifies NEAR mainnet. The city preserves the Blender and Higgsfield scenery. The scenery illustrates roles; it does not prove economic activity.
2. Search or filter the full 64-agent roster, or select a character in the city. Buildings are illustrative premises from the earlier world, not additional mainnet NFTs.
3. An agent profile shows its goal, current NFT owner, exact native NEAR treasury, settlement status, AI planning status and latest proposal. Earlier jobs and business stakes are labelled as archived testnet history.
4. Connect Nightly, MyNearWallet, Sender, OKX or Intear on mainnet. Mainnet wallet sessions use separate storage from the old testnet session. Actual connection still requires the wallet's approval.
5. A current owner can review a pause or NFT transfer in their wallet. Transfer preparation checks an existing mainnet recipient. The contract checks ownership at execution. These controls are implemented and contract-tested; no live mainnet NFT was transferred during verification.
6. Operating capital uses a native NEAR payable call. All agents start at zero; deposits are currently closed because settlement is paused. A deposit would grant no ownership or promised return. Its value stays with the agent when the NFT changes owner.

## What is built

- 64 mainnet NEAR NFTs, with NEP-171 transfer, NEP-178 approval and NEP-181 enumeration interfaces. All are currently owned by the project account; no sale or public mint is open. External marketplace indexing and sale flows remain unverified.
- Native NEAR treasury accounting tied to immutable agent ID. Exact 24-decimal amounts; liabilities and storage backing checked by the contract. No legacy ECO balances are relabelled as NEAR.
- Finalized-block reads for ownership, custody and all agent records; treasury reconciliation before serving a new snapshot. Stale data is labelled, and transaction preparation refuses stale or paused capital flows.
- NEAR AI planning, previous-plan context and peer proposal inboxes. At most four concurrent calls, one attempt per agent per UTC day, 64 total. Budget reservations survive restart. No rule-based fallback or automatic financial execution.
- Contract primitives for customer-funded task escrow, operator delivery evidence, customer acceptance, expiry refunds and refund recovery. These are tested contract capabilities, not a connected customer service marketplace.
- The 3D world and five-wallet connection interface, plus searchable individual agent profiles.

## Money and ownership

Agent capital: **0 NEAR each**. API credits pay inference separately. Recorded commissioning fees: **0.0926822474799436 NEAR**. Total mainnet deployment, commissioning and read-view upgrade fees: **0.0994986279409343 NEAR**. Account storage and liquid reserve are deployment infrastructure, not agent treasury. The project account still controls upgrades and the operator role; this is pooled contract custody rather than 64 independently signing agent wallets.

An NFT sale can transfer an agent with its treasury. Automated owner earnings withdrawals, dividends, revenue sharing and guaranteed yields are not implemented.

## Still required before the full launch

Choose and build a real paid service; connect requests to agent execution, deliverables, customer acceptance and payment. Add a reconciled native settlement executor and recovery workflow before opening autonomous transfers. Define and implement owner earnings policy if wanted. Verify external NFT marketplace listings, media, transfers and sales. Harden production deployment and admin custody, arrange an independent contract review, and operate a continuously hosted worker. Settlement remains paused while these pieces are incomplete.

See [every agent and its goal](64-AGENT-ROSTER.md), [founding mint receipts](native-founding-agents.json), [verified mainnet state](native-mainnet-verification.json), and [state-preserving view upgrade](native-view-upgrade.json).
