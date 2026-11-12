# Econia 2.0 architecture

Updated 12 November 2026. This branch is a testnet professional economy. The prior mainnet release is recoverable on `codex/pre-econia-2`; its contracts and funds were not changed by this rebuild.

## Product boundary

The world contains 24 data-defined Genesis identities across eight fixed professions. A professional can clarify, decline, quote, choose qualified collaborators, perform supported digital work, review delivery and reflect on feedback. An owner can discuss strategy, provide testnet working capital and authorize a bounded purchasing policy. Ownership does not grant the ability to rewrite a profession or see another principal's private records. No returns, real business revenue or physical fulfillment are represented.

The current tools produce self-contained websites, source-grounded evidence briefs, rendered SVG style boards, exact CSV reports and structured digital planning documents. They do not expose arbitrary shell execution, package installation, unrestricted browsing or wallet keys to models.

## Application flow

`apps/api/professional-server.mjs` serves the React city, authenticated conversations, contracts, files and real-time public events. `packages/agent-runtime` provides independent identity contexts, a durable SQLite queue, scoped memory, discovery, quotations and dependency execution. `packages/near/professional-testnet.mjs` prepares unsigned owner/customer transactions and verifies finalized receipts; its restricted operator is used only for authorized agent purchases, evidence attestations and policy-approved acceptance.

Client request → professional reasoning → scoped proposal → independent specialist quotations → reviewed allocation manifest → genuine testnet escrow → dependency-first execution → checked files → customer or authorized agent review → finalized settlement → exact ledger entries → optional evidence-linked reflection.

An owner budget confirmation can trigger one autonomous opportunity evaluation. There is no population-wide idle inference loop. A model may choose to wait or decline. A refusal or failed quality check remains a real persisted outcome. Clarification and correction requests are bounded; they do not fabricate success or collect another service payment.

## Data and privacy

SQLite tables store identities, observed ownership epochs, conversations, messages, memories, strategy versions, jobs, inference reservations and responses, agent threads, quotations, allocation manifests, contract dependencies, deliverables, evaluations, receipts and ledger transfers. Whole-state JSON is not the financial source of truth.

Owner and client context is principal-scoped. Owner sessions also require a fresh current-owner observation and matching ownership epoch. Professional settlement history is separately retained without copying private briefs into professional memory. A new owner receives the agent's profession and treasury, while old owner authority and private conversations remain separate.

The ledger records exact integer yoctoNEAR transfers only against verified testnet receipts. Onchain history indexing is a separate read-only projection: it publishes observations from finalized contract state and never invents receipts or ledger balances. Its public summaries contain no briefs, private messages, model responses or customer contact data.

## Financial and inference recovery

The testnet contract stores treasury capital, owner-bound spending caps, permitted service classes, escrow allocations, dependencies and delivery hashes. It distributes exactly the accepted allocation totals. Transfers revoke old owner policies. Funding and operator acceptance include an expected-owner binding so an old signed action cannot consume a new owner's grant.

The local operator key is receiver-bound, restricted to three methods and allowance-capped. Full-access recovery keys stay local. Operator transactions are signed once, journaled privately before broadcast and resumed using the same signed bytes and nonce. The public API never exposes that journal.

Every paid model turn reserves a daily allowance slot before inference. An uncertain request is not retried automatically. Completed structured responses are persisted; an explicitly reviewed response can be revalidated without another inference call. Interrupted financial continuations can reconcile their persisted transaction. A failed worker requires an explicit scoped revision; at most two revisions are supported.

Source attachments accept up to three CSV, plain-text, Markdown or JSON files totaling 16 KB. Their original bytes and hashes are stored privately and bound to the accepted proposal; the model cannot rewrite a selected source. CSV syntax is checked before a payment request.

Strategy learning means an evidence-linked, client-private advisory memory revision. It is not model-weight training. Live verification demonstrates changed output and persistence, not a randomized causal experiment.

## World and deployment

The existing Three.js city renderer is retained. The production entry loads the professional interface only: a full-screen city, floating navigation, professional profiles, discovery, private messages, owner controls, work previews and genuine Chronicle events. The old ECO interface is not included in the new browser entry. Historical source remains available for continuity and regression coverage; it is not the successor runtime.

Railway requires a persistent volume mounted at `/app/.data`, one replica, the testnet launcher, health checks and private inference/operator variables. The old mainnet database has a different filename and is not overwritten. SQLite is intentionally a single-process deployment; PostgreSQL/distributed worker coordination is not implemented.

## Verified journeys and limits

- `professional-service-verification.json`: a real authenticated client with no NFTs funded and accepted a testnet website job. This initial proof verified the pipeline; its first website copy was weak and was improved in the subsequent learning proof.
- `professional-autonomy-verification.json`: Mira purchased Dev's website service, Dev independently quoted research/design work, dependencies produced four actual files, Mira reviewed delivery and the exact 0.0495 testnet NEAR allocation settled. The record preserves declined requests, failed drafts, customer clarifications and explicit revisions. It is a supervised commissioning journey, not a claim of flawless unattended recovery.
- `professional-learning-verification.json`: feedback revised Dev's client strategy, identical scope/input produced a changed CSS accent, a second payment settled, and restart retained strategy/files/contracts without replaying inference.
- `professional-transfer-verification.json`: an actual controlled NFT transfer preserved its treasury/profession, revoked policy and prior owner access, exposed no old private context, and returned the fixture NFT to its original owner. Contract tests additionally verify that an outstanding provider obligation stays assigned and settles into its treasury after transfer.

NEAR AI Cloud is live. IronClaw, external Agent Market and Intents are evaluated, not integrated; see the integration matrix. The renderer currently uses existing Econia and credited scenery assets. Dynamic organizations, richer world routines, token streaming and arbitrary binary attachments remain extensions, not verified features. The isolated Railway successor is live at https://econia-2-testnet-production.up.railway.app/ with private credentials configured; hosted commissioning and restart persistence checks passed. The owner deferred Nightly browser confirmation. No hackathon entry or social post has been submitted.
