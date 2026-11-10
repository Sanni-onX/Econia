# Mainnet deployment — 10 November 2026

Native NEAR contract deployed and verified on the project account:

`eb6dcf918cfef5feca6bb6ba7fbed6540a19b8d8a0112c69d6f996567f217d17`

Successful transaction: [9P3HPJcJpQi6LahA8UmWP8VLtvbhx5YCcfVKkw9h4xPX](https://nearblocks.io/txns/9P3HPJcJpQi6LahA8UmWP8VLtvbhx5YCcfVKkw9h4xPX).

The exact optimized WASM was first deployed on a fresh faucet-funded testnet account. Its export surface matched the original build. Mainnet deployed bytes were fetched and SHA-256 verified against that artifact. Initialization was atomic with deployment and pausing.

Actual mainnet code/state storage: 262,219 bytes, requiring 2.62219 NEAR backing at the checked protocol rate. Total nonrecoverable fees including the first failed deployment: 0.0048475918236594 NEAR, approximately $0.018 at the checked $3.62/NEAR rate. The failed attempt rolled back, with its fee preserved in the deployment journal.

After the successful transaction, account balance was 3.9513524081763406 NEAR, including storage backing. Liquid balance after that backing was 1.3291624081763406 NEAR. These are timestamped snapshots, not ongoing balance guarantees.

Subsequent commissioning created **all 64 founding NFTs**, each with **0 NEAR**. All are initially owned by the project account. Economic settlement remains **paused**, and all treasury/job/refund liabilities remain zero. No public deposits or autonomous spending were enabled.

The native preview now runs at http://127.0.0.1:3004/ with finalized ownership and treasury reads, balance reconciliation, five-wallet mainnet connection, and wallet-reviewed owner controls. A separate NEAR AI worker records offchain plans and peer proposals without a signing key. The legacy testnet preview remains separate.

Creating the NFTs cost **0.0926822474799436 NEAR** in fees. A state-preserving read-only batch-view upgrade cost **0.0019687886373313 NEAR**; it was first rehearsed on testnet and verified to preserve existing ownership, zero balances and paused custody. Total mainnet fees, including original deployment: **0.0994986279409343 NEAR**. At completion of minting, before the small view upgrade, liquid deployment reserve was **0.720150160696397 NEAR**. Deployment storage and reserves are not agent capital.

Latest deployed WASM SHA-256: `90409ecb869f7482f8dc1ae928d52cc4dc03d71d2ab4c381e59e8e8213bcd9e1`. See [64 mint receipts](native-founding-agents.json), [view upgrade](native-view-upgrade.json), [current verified state](native-mainnet-verification.json), [current walkthrough](CURRENT-BUILD-WALKTHROUGH.md) and [every agent](64-AGENT-ROSTER.md).

Real customer services, native settlement execution/recovery, owner earnings policy, external marketplace sales verification and public production hosting remain incomplete. Independent security review remains outstanding. This is not a completed or audited public launch.

Evidence: [mainnet](mainnet-deployment.json), [testnet rehearsal](native-testnet-rehearsal.json), [storage preflight](mainnet-preflight.json). Recovery material and optimized build binary stay outside version control. No private keys appear in these records.
