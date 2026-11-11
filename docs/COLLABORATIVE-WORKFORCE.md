# Collaborative workforce: current build

Updated 11 November 2026. This is the current product walkthrough; older walkthroughs describe earlier prototypes.

## Customer journey

1. Explore the 3D world and its 64 persistent NFT identities.
2. Connect a NEAR mainnet wallet. Sign in with a free NEP-413 message to access private work.
3. Give a team a specific goal and supply bounded inputs. Account/contract targets, NFT identifiers, token targets, documents and CSV are supported. Arbitrary internet browsing and code execution are not enabled.
4. Approve 1–6 inference calls, including coordinator planning. The app reserves that allowance and eight task slots before admission. Default global limits are 12 inference calls and 24 task slots per UTC day; each wallet gets three top-level requests.
5. NEAR AI produces a plan. Validation checks tool availability, complete input coverage and budget. Unsupported plans stop visibly; there is no rule-based replacement or automatic paid retry.
6. The coordinator commissions specialists. Workers are selected by supported capability and current load. Each identity executes one job at a time; the process executes up to two specialist jobs concurrently. Large documents split into sections for the evidence team.
7. Reviewers repeat output checks. The assembler verifies hashes and collects checked specialist results into one downloadable report. Customer acceptance records trial approval.

## Active identities

| NFT | Work |
| --- | --- |
| person_199 | Evidence brief analyst |
| person_101 | CSV analyst |
| person_102 | Copy editor and reviewer |
| person_103 | NEAR account analyst |
| person_104 | Contract interface inspector |
| person_105 | NFT ownership verifier |
| person_106 | Token balance verifier |
| person_107 | NEAR AI mission coordinator |
| person_108 | Evidence analyst replica |
| person_109 | CSV analyst replica |
| person_110 | Account analyst replica |
| person_111 | Contract inspector replica |
| person_112 | NFT verifier replica |
| person_113 | Token verifier replica |
| person_114 | Copy editor and reviewer |
| person_115 | Report assembler |
| person_116 | Copy editor and reviewer |

There are seven public services, with coordinator and assembler as internal capabilities. Reviewer checks use deterministic validators rather than extra AI calls. All other 47 NFTs remain dormant. Owners can save their purpose and desired work; a description alone cannot authorize unsupported tools or activate spending.

## Autonomy and interaction

The coordinator creates real child tasks for other agents. Specialists request reviewer checks; checked outputs become inputs to assembly. Public events expose agent-to-agent handoffs without customer goals or documents.

Customers may enable account-change follow-up. A free chain probe runs every 30 minutes, expires after 24 hours, and commissions a new budgeted mission only when the supplied account's state changes. Each watch allows three total runs; only one watch per customer and three globally. Customers can stop it. Every follow-up must pass fresh admission limits. This is bounded, permissioned autonomy; agents do not trade, spend NEAR, invent customers or generate idle chatter.

## Ownership and economics

The mainnet collection contains 64 NFTs. Onchain ownership is checked before workers execute. Agent treasuries remain attached to the agent across NFT transfers. Starting treasuries are zero, as requested. API access is funded by the project; API credits are separate from native NEAR custody.

ECO is retired. NEAR is the intended launch asset. Current service work is a free trial. Mainnet settlement is paused, so this build does not claim customer payments, owner yield or autonomous revenue. Contract escrow primitives exist, but paid customer work needs a separately verified integration before charging.

## Architecture and deployment

React/Three.js web app → authenticated native API → durable SQLite mission queue → NEAR AI coordinator → specialist tools → reviewer checks → assembler → private artifact.

NEAR mainnet supplies NFT ownership, agent registry and custody state. NEAR AI Cloud supplies structured coordination and document generation. Web3 tools query finalized public data and validate exact outputs. Contract inspection reads exports and hashes without executing downloaded WASM.

Railway runs the web server and background worker together with one persistent volume. The PC is not required after deployment. A restart retains tasks, profiles and reservations; login sessions intentionally require a fresh signature. Uncertain billed work is marked interrupted rather than repeated.

## Verification

The live commissioning proof in `team-mission-verification.json` records a real NEAR AI plan and four completed mainnet specialist jobs. The combined report is `service-examples/team-mission.md`. This was internal commissioning, not a signed customer purchase. Unit tests also exercise split documents, load balancing, private routes, restart recovery and bounded follow-up.
