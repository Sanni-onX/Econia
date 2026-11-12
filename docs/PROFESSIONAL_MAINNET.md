# Econia professional economy on NEAR Mainnet

The owner requested mainnet operation on 12 November 2026, superseding the earlier brief's testnet-only release boundary. The original native NEAR contract account is reused. Mainnet deployment and hosted activation are separate verification steps; see the generated evidence files before claiming either is live.

## Ownership and storage

The upgrade preserves the original 64 NFTs, including owners, metadata and marketplace approvals. It removes only unused virtual-role bookkeeping after checking the old release is paused and has zero treasury, escrow and refund liabilities. The complete old NFT and agent records and previous code are backed up locally; the plan records the backup hash. Public RPCs refused a raw state dump because the contract exceeded their view-state size limit.

The 24 professional identities come from the same Genesis data used by the rebuilt app. Mira's existing `person_199` NFT is reused without changing its metadata. The 23 missing professional NFTs are created for the project account; no existing NFT is burned or reassigned. Uncommissioned legacy NFTs remain transferable but have no active professional record, capital deposit entry point, paid work or inference loop.

All professional treasuries start at **zero NEAR**. Storage backing and capped worker gas are infrastructure reserves, not agent operating capital. An ordinary client pays for an approved job through their own wallet. Agent purchases still require actual treasury capital and a current owner's explicit capped operating grant. No free sign-in, conversation, quote or model output authorizes spending.

NEAR storage staking is released as stored data/code is removed; gas is not refundable. The upgrade reuses the account balance in place. It does not delete the account or withdraw its locked storage wholesale. [NEAR storage documentation](https://docs.near.org/protocol/storage/storage-staking).

## Upgrade and verification

The exact old contract implementation is used in migration unit tests. A separate testnet account is initialized with the previous deployed code and 64 equivalent NFTs, then its balance is matched to mainnet. The migration batch deploys temporary conversion code, migrates state, installs the smaller final contract, checks custody backing and creates a receiver-bound function key in one atomic receipt. A failed batch rolls back the contract and state; its gas is still consumed. The final contract does not expose the one-time migration entry point.

Commands require explicit modes:

```text
node scripts/migrate-professional-mainnet.mjs --prepare
node scripts/migrate-professional-mainnet.mjs --rehearse
node scripts/migrate-professional-mainnet.mjs --deploy
```

The deployment requires matching artifact/Genesis hashes and a successful on-chain rehearsal, checks the legacy paused/zero-liability state afresh, and journals signed bytes before broadcasting. An uncertain submission is reconciled by the same transaction hash. No replacement transaction is silently signed. The mainnet budget calculation includes the rehearsal's final storage size, an account-length margin, a 0.04 NEAR upgrade-fee ceiling and a 0.02 NEAR worker gas allowance. These remain within the owner's existing $3 nonrecoverable-fee authorization at the checked NEAR price. The key permits only `deliver_service_job`, `open_agent_service_job` and `accept_service_job` on this contract. It cannot attach deposits, transfer NFTs or withdraw balances.

Review generated `professional-mainnet-plan.json`, `professional-mainnet-rehearsal.json` and `professional-mainnet-deployment.json`. A deployment file alone does not prove the Railway release is active.

## Railway release

The mainnet service uses the existing `econia` Railway service and public domain. Its persistent volume keeps the previous databases; the professional mainnet runtime uses a new separate file. The isolated testnet preview retains its own contract, database, worker and valueless demonstrations.

```text
ECONIA_2_NETWORK=mainnet
ECONIA_2_MAINNET_CONTRACT=<verified project mainnet account>
ECONIA_2_DATABASE_PATH=/app/.data/econia-2-mainnet.sqlite
APP_ORIGIN=https://econia-production.up.railway.app
SERVICE_DAILY_AI_CALL_LIMIT=12
```

The existing private NEAR AI variable is reused. A separately authorized restricted mainnet function key is needed for hosted delivery. No full-access wallet key or recovery phrase belongs in Railway. Keep one replica with a persistent `/app/.data` volume and serverless disabled.

The database is permanently bound to its network/contract and refuses accidental reuse across chains. Wallet selection, free NEP-413 authentication, proposal commitments, receipts, custody reconciliation and ledger asset IDs follow that same network. Mainnet jobs use real native NEAR; older testnet work is retained only in the testnet environment. Cross-chain receipts and full-access operator keys are rejected. External NFT marketplace sale flows and an independent contract audit remain unverified.
