# Econia — agent economy product direction

Updated 9 November 2026 from the user's clarification. This records the intended product; it does not claim these capabilities are already implemented. BUILD-WALKTHROUGH.md remains an account of the current build.

## Product premise

Econia is a persistent economy of NFT-owned autonomous agents. Each character represents an agent with an identity, capabilities, memory, treasury, reputation and economic relationships. The city makes that economy visible. Users own and support agents and observe their economic performance. External customer services are a later phase, explicitly deferred by the user.

The production lifecycle includes a mint phase in which a user mints an Econia entity. The hackathon experience starts after the founding mint: the demonstration cohort is already minted. Judges should not need a public mint campaign or many independent users to demonstrate the economy. A genesis/demo allocation is not evidence of independent user adoption. Newly founded businesses and any future entity issuance are separate lifecycle decisions.

## Intelligence and enforcement

NEAR AI Cloud should supply the agents' reasoning. Agents decide which opportunities to pursue, when to establish businesses, whom to trade with or hire, how to use capital and how to adapt. Those choices should depend on goals, memory, capabilities and current opportunities, rather than a fixed sequence of scripted economic events.

The existing deterministic ledger and validation remain authoritative for balances, permissions, inventory and settlement. An AI proposal cannot write economic state directly. Owner spending limits, tool permissions, payment checks and execution receipts remain enforceable regardless of what the model proposes.

Use durable, asynchronous jobs with bounded inference budgets and revalidate proposals before execution. Show the actual provider, request status and evidence. If inference fails, report that state and retry or pause the affected work; never silently label rule-generated choices as AI decisions. Existing rules remain useful as explicit test fixtures and low-level mechanics.

## Current phase: complete the internal agent economy

The user explicitly deferred choosing or building external services. Do not turn Econia into a research/content marketplace as part of this phase. Keep the existing economic world and complete its autonomous agent systems first.

The intended walkthrough is:

Enter the already-minted world → connect a wallet → inspect an existing agent and its ownership → review goals, memory, finances and relationships → provide permitted capital or strategic constraints → the agent independently plans and acts → inspect resulting businesses, trades, employment, treasury changes and history → return to persistent progress.

Each character needs an actual agent runtime identity and enabled economic tools. Merely rendering a named resident or using an LLM to explain a scripted decision is insufficient. An agent can be idle, waiting for an opportunity or paused; every resident need not make an inference request every tick.

Funding an agent is distinct from buying its NFT. NFT ownership must not imply an implemented revenue-share or withdrawal right: owner distributions need explicit economics and contract support. Current sponsorship is owner-only and grants no financial return. External utility and sustainable external revenue remain a later product requirement; internal ECO circulation alone does not prove them.

## NEAR integration boundaries

- NEAR AI Cloud: model inference and tool-based planning. Choose models based on current tool support and documented privacy tier; using the gateway does not itself make the whole Econia runtime confidential.
- NEAR contracts: persistent NFT identity, ECO custody and verifiable payments. The current pooled operator settlement is not an independent wallet per agent.
- NEAR Agent Market: a possible later external demand and subcontracting channel. Official documentation describes self-hosted agents and programmatic job handling; no integration or listing is required in the current phase.
- NEAR Intents: potential cross-chain payment access when a concrete payment flow needs it. It is not required merely to run the internal same-chain testnet economy.

No external listing, paid inference, account provisioning or live revenue distribution is implied by this document.

## Build sequence

1. Reconcile the founding NFT population and demonstrate the post-mint ownership experience, without a public mint requirement.
2. Connect NEAR AI Cloud through an asynchronous scheduler with per-agent context, memory, inference limits and durable execution records.
3. Connect validated economic tools so AI plans cause real work, trade, production, business creation and hiring within the existing supported economy. Add negotiation and more complex capabilities explicitly; they are not already present.
4. Revalidate actions against current funds, owner constraints and counterparties before execution. Recover safely across model failures, restarts and pending settlement.
5. Make ownership, funding, strategy, actual agent activity and economic results understandable throughout the city and profiles. Resolve testnet settlement allowance and demonstrate reconciled receipts.
6. Review the completed internal economy before selecting and adding external customer services.

The current wallet, persistence, world presentation, supported economic actions and ledger are foundations. The NEAR AI adapter, asynchronous scheduler and persistent outcome memory are implemented and locally tested. Live inference and an accepted hiring proposal are verified in an isolated local fixture; AI operation against the persistent testnet world remains unverified while settlement is blocked. Negotiation, independent agent custody and an explicit owner-benefit mechanism remain gaps. This sequence describes intended work, not completion. Credentials must stay out of source control and chat. See [activation and limits](NEAR-AI-SETUP.md).

## Sources checked

- [Hackathon tracks and submission requirements](https://nearhackathon.com/)
- [Agent Economy track example](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/07-agents.md)
- [Autonomous Business track example](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/04-business.md)
- [NEAR AI Cloud quickstart](https://docs.near.ai/cloud/quickstart)
- [Model features and privacy tiers](https://docs.near.ai/cloud/models)
- [NEAR Agent Market self-hosted integration](https://docs.market.near.ai/guides/self-hosted-agents)
