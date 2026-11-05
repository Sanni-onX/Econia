# Validation record

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

PostgreSQL integration is conditional locally and enabled in CI. Local persistence tests use Node SQLite. A prepared-batch recovery test simulates a crash after chain acknowledgement but before durable cursor update, proving a retry does not pay twice.

Limits: browser wallet signing and redirects require manual testing with a user wallet; no user authentication dialog was automated. Contract unit tests do not constitute an external audit. Public hosting, a demo video and the final hackathon submission remain unverified/pending. Dependency audit: ten low-severity transitive Wallet Selector findings, no moderate/high/critical findings at inspection.
