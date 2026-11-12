# Econia 2.0 rebuild audit

Audited 12 November 2026 against baseline `dfb3adae80a93c61b0c4450b34e41e5e5c3412c9`. Recoverable branch: `codex/pre-econia-2`; rebuild branch: `codex/econia-2`. Existing Railway mainnet release remains separate until the replacement acceptance journey passes.

## Baseline

React 19.3.1, Vite 8.3.6, Three.js 0.187, npm workspaces, Node 24 production Docker image, native Node HTTP APIs. Rust workspace uses near-sdk 5.24.1. PostgreSQL support exists for the historical simulation; current service tasks use SQLite with a Railway persistent volume. New code should retain compatible dependencies and introduce relational migrations, not arbitrary JSON-only domain records.

`npm test`: 74 tests, 73 passed, 0 failed, 1 optional database test skipped. Captured locally in `.data/rebuild-baseline-tests.log`. Existing application was not listening on port 3003; started the current native application there for inspection. Did not start historical population-wide inference or automated token settlement.

## Classification

| Component                                             | Decision                         | Evidence and required change                                                                                                                                                         |
| ----------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wallet Selector, Nightly and NEP-413                  | PRESERVE / REFACTOR              | Working mainnet login confirmed by user; parameterize authentication recipient and network for testnet.                                                                              |
| Native-world NFT and custody contract                 | PRESERVE / REFACTOR              | Real NFTs, NEAR treasury, escrow and refund accounting. Add explicit authorization and subcontract commitments; separate testnet deployment. Existing mainnet contract stays paused. |
| Agent service tools                                   | PRESERVE                         | Exact CSV arithmetic, source quote checks, copy-edit checks, artifact hashes, finalized chain tools. Generalize chain configuration.                                                 |
| Mission planner and queue                             | REFACTOR                         | Real NEAR AI planning, child tasks and durable reservations work. It is a central coordinator, not independent professional reasoning or negotiation.                                |
| Worker assignments and owner purpose editing          | REPLACE                          | Fixed mapping of 17 active identities and editable preferred capabilities conflicts with immutable professions and data-driven Genesis.                                              |
| Task persistence                                      | REFACTOR                         | Idempotency/recovery working; normalized conversations, memory, strategies, proposals, dependencies and settlements needed.                                                          |
| World3D and Blender/Higgsfield assets                 | PRESERVE / REFACTOR              | Real camera, hit testing and identity selection; make full-screen with contextual workplace interaction and backend-driven activity.                                                 |
| NativeApp scrolling roster/forms                      | REPLACE                          | No longer shows KPI counters, but still not the requested immersive primary interface.                                                                                               |
| Legacy simulation, ECO contracts and testnet launcher | REMOVE from 2.0 runtime          | Current `start:testnet` enables old token settlement and old scheduler. Archive only behind recoverable version control; no ECO in new runtime, seeds or payments.                   |
| Historical docs                                       | REPLACE as current documentation | Keep provenance in baseline branch; write current architecture and honest status separately.                                                                                         |
| Railway single-process container                      | PRESERVE / REFACTOR              | Existing web/worker deployment and persistent storage work. New service must use a separate database/contract, testnet-only payment adapters, and no project mainnet key.            |
| Tests                                                 | PRESERVE / EXTEND                | Reuse auth/accounting/tool tests; add learning behavior, professional boundaries, durable messages, owner transfer privacy, dependency graphs and settlement reconciliation.         |

## What is real today

64 minted mainnet NFTs, 17 activated identities, seven public capabilities; live NEAR AI plans and real tool artifacts; durable local task execution; hosted signed wallet login. Treasury capital remains zero. No paid settlement is enabled. No independent learning, negotiation, persistent chat, real agent-created organizations or external Market integration is claimed.

## Rebuild decisions

- New brief governs the successor: valueless testnet payments only, fixed professions, 24 data-defined Genesis professionals, no public minting.
- Mira #199 becomes the Genesis hospitality professional. Her mainnet predecessor and its history are not silently rewritten; new testnet collection is explicitly versioned.
- Use existing Three.js renderer as the permitted optimized renderer; no arbitrary Pixi/Next migration. Compare three coherent visual directions before final styling.
- Keep external Agent Market and Intents optional. Neither is assumed to provide testnet escrow. Inference uses the existing funded NEAR AI gateway with durable per-call reservations.
- Learning means evidence-backed, versioned strategy revision used in later decisions; not model-weight training or predetermined personality rules.
- No deployed successor or completion claim until the three full acceptance journeys are verified.
