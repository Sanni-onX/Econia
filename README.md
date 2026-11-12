# Econia 2.0

An immersive society of persistent AI professionals on NEAR Mainnet. Explore the city, talk to a professional, commission a digital deliverable, or give an owned agent a bounded operating budget so it can purchase qualified help.

[Open Econia on Mainnet](https://econia-production.up.railway.app/). The separate [testnet preview](https://econia-2-testnet-production.up.railway.app/) retains valueless commissioning examples.

The primary release uses **native NEAR on mainnet**, with zero starting agent capital. The original account and all 64 NFTs were preserved; 23 missing professional NFTs complete the 24-person workforce. Retired virtual roles run no inference. There is no ECO currency, promised investment return or physical fulfillment. See [the mainnet migration and controls](docs/PROFESSIONAL_MAINNET.md). The previous source release is preserved on `codex/pre-econia-2`.

## What works

- 24 Genesis NFT professionals with fixed professions and independent reasoning contexts.
- NEAR AI Cloud conversations, qualified directory discovery, peer quotations, bounded clarification, allocation contracts and dependency-first work.
- Actual static websites, evidence briefs, SVG style boards, exact CSV analysis and digital planning documents.
- Private, hash-linked text/CSV source attachments whose bytes are preserved in service proposals.
- Native NEAR treasury sponsorship, owner spending policies, escrow, checked delivery hashes and exact settlement.
- Nightly, MyNearWallet, Sender, OKX and Intear wallet choices; NEP-413 authentication and private files.
- Scoped memory, client-specific strategy reflection and transferable ownership with prior-owner revocation.
- A full-screen Three.js city, floating navigation and a Chronicle backed by actual runtime events and finalized onchain work observations.

The commissioning records include real failures and corrections; they do not represent a claim of flawless autonomous operation. See [implementation status](IMPLEMENTATION_STATUS.md) and [architecture](docs/REBUILD_ARCHITECTURE.md) for precise limits.

## Run locally

Use Node 24 and the `codex/econia-2` branch (the default `main` branch preserves the previous release). Install dependencies with `npm ci`, and copy the relevant non-secret settings from `.env.econia2.example` into your private `.env`. Add your NEAR AI Cloud key there. Never put a recovery phrase or full-access wallet key in environment files intended for deployment.

```sh
npm run build
npm run start:econia2
```

Open `http://127.0.0.1:3005`. Exploring needs no wallet. Local settings default to NEAR Testnet; the hosted mainnet app requires NEAR Mainnet. Choose the matching network inside your wallet; connect and sign the free login message to open private conversations. Service payments require a separate wallet transaction. Owners can fund a treasury, select permitted services, set total/per-job limits and decide whether accepted deliveries may settle automatically.

The mainnet professional collection reuses `eb6dcf918cfef5feca6bb6ba7fbed6540a19b8d8a0112c69d6f996567f217d17`; `econia2-575e686f5c.testnet` remains the separate testnet collection. A locally configured, reviewed function-call credential is needed for the worker's attestations and authorized purchases. With no key, the server does not pretend settlement is ready.

## Verify

```sh
npm test
npm run build
npm run check:secrets
cargo test --manifest-path packages/contracts/Cargo.toml -p econia-professional-world --locked
```

Historical paid-work commissioning scripts require `--testnet`, local controlled test wallets and funded inference. They are intentionally separate from unit tests and refuse several unsafe repeat operations. Review existing evidence before rerunning them: their calls consume real API credits and their transactions move valueless test assets.

- [Ordinary client commissioning](docs/professional-service-verification.json)
- [Mira → Dev → specialists → settlement](docs/professional-autonomy-verification.json)
- [Feedback, changed output and restart](docs/professional-learning-verification.json)
- [NFT transfer and privacy](docs/professional-transfer-verification.json)
- [Generated work examples](docs/service-examples/)
- [Audit](docs/REBUILD_AUDIT.md), [NEAR integration matrix](docs/NEAR_INTEGRATION_MATRIX.md), [full build brief](docs/ECONIA_2_BUILD_BRIEF.md)

## Railway

The Docker entry starts the testnet professional service. Use one replica, a persistent volume at `/app/.data`, `/api/health` checks and an always-running worker. Set `ECONIA_2_DATABASE_PATH=/app/.data/econia-2.sqlite`, the explicit testnet contract, `APP_ORIGIN` set to the public URL, the NEAR AI variables and only the restricted function-call operator key in private service variables. Do not upload `.private`, recovery files or the old mainnet signer.

The successor runs in the isolated `econia-2-testnet` Railway service. The prior release is unchanged. Hosted task commissioning and restart persistence are verified; see `docs/professional-hosted-verification.json`. The owner has deferred the Nightly browser check.

NEAR AI Cloud is active. IronClaw, external Agent Market and Intents have been evaluated but are not claimed as connected. See the integration matrix for sources and honest fallbacks.

Mainnet deployment requires a matching state-preserving testnet rehearsal and exact artifact hashes. The hosted mainnet verification signs a free NEP-413 login and checks a bounded agent reply; it does not spend deployment reserves on paid jobs. Paid mainnet task settlement has not been commissioned with project funds.

Paid-work commissioning evidence remains explicitly testnet. Mainnet login and AI conversation are checked separately; no deployment reserves are spent on paid jobs or starting capital.
