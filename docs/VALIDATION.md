# Validation record

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
