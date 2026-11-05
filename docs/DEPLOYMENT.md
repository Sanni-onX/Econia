# Deployment and release evidence

## Local

Run `npm ci`, then `npm run dev`. The UI is http://127.0.0.1:5173 and the API http://127.0.0.1:3001. Alternatively `npm run build` then `npm start` serves both from port 3001. PORT overrides the API port; adjust the Vite proxy if using a nondefault API port. Current review preview may use 3002 to avoid a port conflict.

Copy .env.example to .env if needed. Do not commit .env or .private. SQLite checkpoints/journals live in .data. For PostgreSQL, `docker compose up -d` and set DATABASE_URL to the local credentials in docker-compose.yml, then `npm run db:migrate`. Production deployments must replace local development credentials.

## Testnet artifacts

Build: `cargo build --manifest-path packages/contracts/Cargo.toml --target wasm32-unknown-unknown --release --locked`.
Tests: `cargo test --manifest-path packages/contracts/Cargo.toml --locked`.
Artifacts: packages/contracts/target/wasm32-unknown-unknown/release/econia_eco.wasm and econia_world.wasm.

`scripts/create-testnet-wallet.mjs` generates a BIP39 wallet, verifies recovery derives the same key and stores it in .private/near-testnet-wallet.json. The private folder is excluded from version control. Wallet seed/private key must never be copied into a README, public repo, Site archive or chat. The local Windows folder is restricted to the current user. The wallet is dedicated to testnet.

`scripts/deploy-testnet.mjs` creates project-controlled ECO/world subaccounts, deploys and initializes the artifacts, registers token/world storage and writes public transaction evidence to testnet-deployment.json. It is resumable using onchain queries and artifact digests. Inspect the evidence file for actual deployed addresses and successful transaction hashes; never infer deployment from a source file alone.

## Commissioning checklist

Before switching a public application to real test ECO:

- Fund the deterministic genesis with actual ECO; mint identity NFTs with immutable IDs.
- Reconcile every projected treasury and the pooled escrow total.
- Wire durable staged settlement batches to finality, with recovery after partial network success.
- Index finalized sponsorship and ownership events idempotently; authenticate strategy writes with wallet proofs.
- Use restricted operator credentials and protect the privileged registry.
- Exercise wallet signing/rejection, transfer_call refunds, offers, withdrawals and worker restarts against the deployed contracts.
- Deploy the API and persistent worker with PostgreSQL, TLS, a production origin allowlist, rate limits and private admin controls.
- Record the public app URL, screenshots/video, repository URL and submission evidence.

The local testnet service is commissioned: `npm run start:testnet` loads `.data/econia-testnet.sqlite`, verifies that the operator key has only `settle_batch` access, recovers prepared cycles and reconciles actual ECO custody before serving port 3003. It refuses an unfunded or mismatched world. Genesis setup is `node scripts/bootstrap-testnet.mjs` after contract deployment. Keep the sandbox and testnet databases separate.

Each cycle is prepared durably before external settlement. The restricted worker submits batches of at most 50 transfers, saves its completed cursor after each finalized batch and publishes the candidate world only after all batches finish. Recovery retries the same ID/hash. Mutations are blocked while a cycle is pending. A privileged registrar service mints new business identities; the agents never receive that key. Inbound sponsorship is a verified external ECO source and increases the modeled entity-treasury supply without changing the token contract's fixed total supply.

The wallet prepares actual testnet transactions for sponsorship, listings, purchases, offers, cancellation and withdrawals. Strategy updates use a nonce-bound NEP-413 signature and current onchain owner checks. Business policy authority follows majority ownership to the controlling person. Business equity sales are deliberately disabled; the Living Asset marketplace trades person NFTs.

The contract faucet distributes 250 ECO once per account, capped at 500 claims, from existing owner supply. It charges actual added storage and refunds excess attached NEAR. No private faucet signing key is exposed to the browser.

Public application hosting still requires a persistent Node worker/API, a PostgreSQL database, TLS, configured allowed origins and protected runtime secrets. The current deployment is the onchain contracts plus a local running application, not a publicly hosted web service. Hosting a static frontend would not meet the persistent-world requirement, so no static-only deployment is presented as completion. Wallet signing/rejection/redirect QA and an external block-stream indexer are still outstanding.

## Submission

Verified 5 November 2026 against [the official event site](https://nearhackathon.com/): publish the repository, post a demo video/screenshots on X mentioning the hackathon and tagging @NEARProtocol and #NEARHackathon, submit repository and demo-post links. Development ends 14 November 2026 at 23:59 UTC (15 November 00:59 in Lagos). Recheck the form before submitting. It asks for team/contact information and a payout NEAR account; the generated testnet development wallet is not automatically a suitable payout account. No X post or submission has been sent on the user's behalf.

Primary target tracks are Games With Real Economies and NFTs That Do Something. Eligibility should be claimed only when the deployed end-to-end story works. LLM swarm coordination and production financial onboarding are not current implementation claims.
