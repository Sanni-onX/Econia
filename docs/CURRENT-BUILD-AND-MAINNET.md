# Econia — current build and mainnet direction

Status checked 9 November 2026. This distinguishes the implementation from the running preview and intended release.

## Current build

| Area | Implemented | Current verification or limitation |
| --- | --- | --- |
| Post-mint identity | Living Entity NFTs and persistent economic identity | All 64 current characters verified minted on testnet. These are the founding/demo cohort, not independently onboarded users. |
| City | Three.js coastal world, four districts, selection, profiles, follow state and Chronicle | 26 local models, including four original Blender premises and a Higgsfield Commons pavilion. Decorative scenery is distinct from simulated businesses. |
| Economy | Work, wages, finite goods, production, hiring, founding, inventory, business stakes and durable ledger | Running checkpoint has 64 people and 13 businesses at cycle 161. Settlement remains delayed; it is not advancing. |
| AI | NEAR AI Cloud provider, structured proposals, permitted-action schemas, asynchronous planning, recent outcome memory and restart recovery | A live hiring proposal was accepted in an isolated local fixture. This does not prove continuous AI operation or testnet AI settlement. |
| Wallets | Nightly, MyNearWallet, Sender, OKX Wallet, Intear; account/session handling | Nightly connection and refresh restoration verified. Full transaction testing across every wallet is incomplete. |
| Contracts | Test ECO, NFT ownership, owner sponsorship, marketplace sales/offers, withdrawal credit, treasury settlement | Deployed on testnet. Settlement is pooled and operator-controlled; agents do not each have independent wallets. |
| Persistence | Local SQLite, PostgreSQL support, durable checkpoints/journal and staged settlement recovery | Current preview uses SQLite on this computer. A public persistent production deployment is not commissioned. |
| Validation | Automated economy, API, wallet, AI recovery and asset checks | 41 local tests passed; optional local PostgreSQL integration skipped. GitHub application and contract checks passed. No independent contract audit is claimed. |

## What the user can do now

Explore people and businesses, inspect actual recorded decisions, follow stories, connect a wallet, and inspect testnet ownership/participation flows. Funding and ownership are separate. Current sponsorship is owner-only and grants no return.

## Active agents: release target

Mainnet is now an explicit intended release target, with active autonomous agents. It is not authorization to fund unspecified accounts or launch unreviewed contracts with real user deposits.

The service should remain available independently of this computer. Each agent needs its own persistent identity, goals, memory, task/plan state and authority. AI should choose strategy and economic actions; deterministic checks enforce balances and permissions. Agents can be waiting or idle without being offline. Executing an agent-authored plan does not require a new inference call every second.

Current defaults are four planning requests per cycle and 240 per UTC day. Exhaustion pauses new cycles. That is a bounded development configuration, not the final operating policy for a continuously active population. Mainnet needs sustainable inference funding, event-driven scheduling, durable plans, backpressure and visible per-agent pause/retry states.

## Mainnet work still required

1. Restore testnet settlement and run the full persistent AI loop, including failure/restart recovery and reconciled balances.
2. Add explicit network configuration throughout server, contracts, wallet adapters and interface. Current startup, wallet network and some account checks are testnet-specific.
3. Deploy production hosting, PostgreSQL, monitoring, backups and a supervised worker independent of the development machine.
4. Define production NFT issuance/allocation and ownership rights. Testnet identities and balances do not automatically become mainnet assets. Any preserved identity/history or allocation requires an explicit mapping and verifiable launch record.
5. Define the payment asset, inference/gas funding, platform fees and owner-benefit mechanism. Test ECO is not production revenue. Paid tasks, customer acceptance, refunds, revenue splits and owner distributions are not implemented.
6. Review custody and key authority; implement enforceable exposure limits and pause/recovery controls. The current pooled operator must not be described as trustless independent agent custody.
7. Complete contract security review, adversarial tests and an appropriate independent audit before accepting significant user value.
8. Start with a limited mainnet cohort and bounded funds, then expand only after observed reliability and operating costs support it.

## Evidence

- [Live AI trial](near-ai-verification.json)
- [Post-mint verification](post-mint-verification.json)
- [Build walkthrough](BUILD-WALKTHROUGH.md)
- [AI setup and operating limits](NEAR-AI-SETUP.md)
- [3D production notes](world3d.md)
- [NEAR contract security guidance](https://docs.near.org/smart-contracts/security/checklist)
