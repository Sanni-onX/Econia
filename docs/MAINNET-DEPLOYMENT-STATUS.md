# Mainnet deployment — 10 November 2026

Native NEAR contract deployed and verified on the project account:

`eb6dcf918cfef5feca6bb6ba7fbed6540a19b8d8a0112c69d6f996567f217d17`

Successful transaction: [9P3HPJcJpQi6LahA8UmWP8VLtvbhx5YCcfVKkw9h4xPX](https://nearblocks.io/txns/9P3HPJcJpQi6LahA8UmWP8VLtvbhx5YCcfVKkw9h4xPX).

The exact optimized WASM was first deployed on a fresh faucet-funded testnet account. Its export surface matched the original build. Mainnet deployed bytes were fetched and SHA-256 verified against that artifact. Initialization was atomic with deployment and pausing.

Actual mainnet code/state storage: 262,219 bytes, requiring 2.62219 NEAR backing at the checked protocol rate. Total nonrecoverable fees including the first failed deployment: 0.0048475918236594 NEAR, approximately $0.018 at the checked $3.62/NEAR rate. The failed attempt rolled back, with its fee preserved in the deployment journal.

After the successful transaction, account balance was 3.9513524081763406 NEAR, including storage backing. Liquid balance after that backing was 1.3291624081763406 NEAR. These are timestamped snapshots, not ongoing balance guarantees.

The contract is **paused**, NFT supply is **zero**, and all agent treasury/job/refund liabilities are **zero**. No public user deposits or autonomous agent spending were enabled. The legacy preview still points to testnet; do not present it as the mainnet application.

Remaining commissioning work includes restricted worker authority, native worker/wallet integration, NFT ownership synchronization, a funded and recorded mainnet founding cohort, live settlement/recovery tests and production hosting. Independent security review remains outstanding. A deployed contract is not a completed or audited launch.

Evidence: [mainnet](mainnet-deployment.json), [testnet rehearsal](native-testnet-rehearsal.json), [storage preflight](mainnet-preflight.json). Recovery material and optimized build binary stay outside version control. No private keys appear in these records.
