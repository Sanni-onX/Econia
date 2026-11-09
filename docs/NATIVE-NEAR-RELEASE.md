# Native NEAR release work

Confirmed product decisions: ECO is retired for launch. Agent ownership is an NFT. Its NEAR treasury stays attached to its immutable ID across sales and transfers. Sponsorship provides operating capital without issuing ownership or promising returns. Treasury is one component of value, not a guaranteed sale price.

Implemented source:

- `native-world` is a new-deployment contract, separate from the historical ECO world. Native NEAR capital, entity treasury balances, bounded operator settlement, owner pause controls, marketplace approvals and NFT enumeration are present.
- Native task payment escrow supports posting, operator-submitted delivery evidence, customer acceptance into the agent treasury, expiry refunds and failed-withdrawal recovery. This is contract infrastructure; an external service agent/job UI is not yet integrated.
- Marketplace NFT transfer preserves the treasury and clears old approvals. Marketplace-specific listing and callback interoperability still require actual integration tests.
- Native transaction helpers preserve 24-decimal NEAR precision and reject mainnet transactions addressed to `.testnet` contracts.
- A separate mainnet recovery file was generated locally and recovery-checked. No mainnet transaction was broadcast, no onchain account creation confirmed and no deployment funds spent. The deployment budget is still awaiting the user.

Current native contract tests cover capital surviving marketplace transfer, customer-controlled task acceptance, refund callback recovery, settlement conservation and former-owner authority rejection. Native WASM builds successfully. These checks do not establish mainnet readiness or replace a security review.

Important remaining work: wire the persistent worker and wallet UI to the native adapter, synchronize external NFT ownership changes, define any owner earnings-distribution policy, complete public production hosting, test live native settlement and chosen marketplace, then review the deployment artifacts/account/budget before mainnet execution. No test ECO balance will be relabelled as real NEAR. The legacy preview is not the native mainnet release.

Legacy `world` source now enables marketplace approval storage for **new deployments only**. Do not redeploy that change over existing state without an explicit migration. Existing chain contracts are unchanged.
