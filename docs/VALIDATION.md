# Validation record

## Blender premises and live AI access — 9 November 2026

- Built four original economic premises with Blender 4.5.9 LTS. Committed editable source, generation scripts, GLB exports and matching profile renders. The city successfully loaded all 25 models (21 existing scenery assets plus four original premises).
- Browser verified Mira's new bakery and matching profile picture, preserved entity interactions, and a 390-pixel viewport with no horizontal overflow. Building previews loaded at their intended 560-pixel source resolution.
- Production build passed. Local checks: 39 passed; one optional PostgreSQL test skipped. Added checks for self-contained original GLBs/provenance and billing-failure backoff.
- The user's local NEAR AI key is configured. An actual gateway probe returned HTTP 402; live model output remains unverified. No provider key or response body was published. Billing/authentication failures now pause cycles and persist a five-minute retry delay instead of repeatedly consuming planning slots.
- Higgsfield connection appeared, but instruction/preferences tools returned `Unknown tool`. Browser fallback requires user login. No Higgsfield generation was submitted.


## NEAR AI runtime — 9 November 2026

- Implemented the server-side NEAR AI adapter, bounded asynchronous planning, durable request reservations, fair planning slots, persistent outcome memory and validated engine execution.
- Added eight tests for output validation, source attribution, ledger invariants, scheduling, SQLite restart recovery, stale owner constraints, interrupted/failed inference, request allowances, missing credentials and API integration. Full local result: 37 passed, one optional PostgreSQL integration skipped. Production build passed.
- Provider tests use explicit mocked responses. No funded NEAR AI account was available, so live inference, model quality and end-to-end AI testnet settlement are **not verified**.
- Read-only chain enumeration confirmed that all 64 current character IDs have NFTs. Evidence: [post-mint verification](post-mint-verification.json). This is a project-controlled founding cohort, not 64 independently onboarded users.
- Browser checked the configuration-required panel in an isolated local world, including a 390-pixel viewport without horizontal overflow. [Screenshot](screenshots/agent-configuration.png). The temporary review server was stopped afterward.
- Existing testnet cycle 161 and operator allowance blockage remain separate from AI configuration. No payment, sponsorship or contract-permission change was performed for this update.
- External services, negotiation, revenue distribution and independent per-agent wallets remain outside this implemented slice. See [activation](NEAR-AI-SETUP.md) and [product direction](PRODUCT-DIRECTION.md).

## Wallet update — 9 November 2026

- Added official Wallet Selector adapters for Nightly, Sender, OKX Wallet and Intear alongside MyNearWallet.
- The user approved a Nightly connection successfully. Browser verification confirmed the connected state and restoration after a refresh. No purchase, sponsorship or claim was submitted during these checks.
- Verified the five-option picker, provider detection and install links on desktop, plus a 390 × 844 mobile viewport with no horizontal overflow. Proof: [wallet picker](screenshots/wallet-options.png).
- Wallet tests cover active-account selection, decorated sign-in for already exposed accounts, cancellation/redirect behavior and 32-byte Buffer nonces for message signing.
- Production build passed. JavaScript checks: 29 passed, with the optional local PostgreSQL integration skipped. The dependency inspection reported 15 low-severity findings, with no moderate/high/critical findings.
- Other wallets are integrated but have not each completed manual connection, signing and mobile redirect testing.
- The local testnet world remains at confirmed cycle 161 with settlement delayed by the existing operator allowance. Wallet connection does not resolve that separate operational issue.

## Earlier economy and contract validation

Implemented and locally exercised on 5 November 2026:

- JavaScript unit/integration checks for accounting, deterministic replay, ownership, policies, actual state transitions, API authorization and persistence.
- Rust contract unit checks for token supply/transfer, finite test distribution, sponsorship, NFT transfer, marketplace settlement/offers and caller restrictions.
- Accelerated 10,000-cycle simulation with conserved currency and continuing production/employment.
- Production web build.
- Browser observation of the live local economy, profile search, sponsorship confirmation, autonomous bakery creation and hiring.
- Deployed NEAR ECO/world contracts, 78 minted genesis entities and funded ECO treasuries.
- Actual 100-ECO sponsorship, finalized receipt ingestion and autonomous business creation with batched onchain treasury settlement.
- Actual NFT purchase paid with ECO; owner changed and economic profile remained identical while the clock was paused.

Public chain evidence is in testnet-deployment.json, testnet-demo.json, testnet-marketplace.json and testnet-verification.json. The read-only `npm run verify:testnet` script rechecks the chain.

PostgreSQL integration passed in the GitHub application job; it is conditional locally. Local persistence tests use Node SQLite. A prepared-batch recovery test simulates a crash after chain acknowledgement but before durable cursor update, proving a retry does not pay twice. CI pins the same Rust 1.93.1 toolchain used for the deployed contracts; a newer runner toolchain exposed incompatible host-import linker behavior with the pinned SDK.

Limits: browser wallet signing and redirects require manual testing with a user wallet; no user authentication dialog was automated. Contract unit tests do not constitute an external audit. Public hosting, a demo video and the final hackathon submission remain unverified/pending. Dependency audit: ten low-severity transitive Wallet Selector findings, no moderate/high/critical findings at inspection.
