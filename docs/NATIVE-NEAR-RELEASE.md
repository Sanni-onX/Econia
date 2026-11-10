# Native NEAR release work

**Latest service-economy correction:** virtual roles and their automatic AI planner are retired. The native app keeps all 64 NFT identities unassigned and idle until verified real service workflows exist. Prior planning records below are historical; the mainnet worker makes no automatic AI calls.

Confirmed product decisions: ECO is retired for launch. Agent ownership is an NFT. Its NEAR treasury stays attached to its immutable ID across sales and transfers. Sponsorship provides operating capital without issuing ownership or promising returns. Treasury is one component of value, not a guaranteed sale price.

Implemented source:

- `native-world` is a new-deployment contract, separate from the historical ECO world. Native NEAR capital, entity treasury balances, bounded operator settlement, owner pause controls, marketplace approvals and NFT enumeration are present.
- Native task payment escrow supports posting, operator-submitted delivery evidence, customer acceptance into the agent treasury, expiry refunds and failed-withdrawal recovery. This is contract infrastructure; an external service agent/job UI is not yet integrated.
- Marketplace NFT transfer preserves the treasury and clears old approvals. Marketplace-specific listing and callback interoperability still require actual integration tests.
- Native transaction helpers preserve 24-decimal NEAR precision and reject mainnet transactions addressed to `.testnet` contracts.
- A separate mainnet recovery file was generated locally and recovery-checked. On 10 November, the user authorized storage from the project balance with a $3 nonrecoverable-fee cap. The optimized contract was rehearsed on testnet, then deployed and verified on mainnet. All 64 founding NFTs are now minted with zero capital. The contract remains paused. See [commissioning status](MAINNET-DEPLOYMENT-STATUS.md).
- The native mainnet preview reads finalized ownership and treasury records, reconciles balances and supports five mainnet wallets. Owners can review pause and transfer calls. A separate persistent NEAR AI worker records plans and peer proposals without a signing key. See the [current walkthrough](CURRENT-BUILD-WALKTHROUGH.md).

Current native contract tests cover capital surviving marketplace transfer, customer-controlled task acceptance, refund callback recovery, settlement conservation and former-owner authority rejection. Native WASM builds successfully. These checks do not establish mainnet readiness or replace a security review.

Important remaining work: implement real paid services and their customer workflow, native settlement execution and recovery, define any owner earnings-distribution policy, complete public production hosting, test live native settlement and chosen marketplace, and obtain independent review. No test ECO balance is relabelled as real NEAR. The legacy testnet preview remains separate.

Legacy `world` source now enables marketplace approval storage for **new deployments only**. Do not redeploy that change over existing state without an explicit migration. Existing chain contracts are unchanged.
