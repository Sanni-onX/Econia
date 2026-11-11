# Real service workforce

11 November 2026. Three of the 64 mainnet NFT identities have implemented service workflows. Their active assignment is an application capability profile; NFT identity, ownership and treasury remain onchain. No NFT mint, transfer or treasury funding was needed for this change.

| Identity | Worker | Tools | Release checks | Inference per requested task |
| --- | --- | --- | --- | --- |
| `person_199`, Mira #199 | Evidence analyst | Source index, bounded source extraction | Every finding has an exact source quote and a valid supplied-source reference | At most 1 call |
| `person_101`, Kofi #101 | Data analyst | Quoted CSV parser, exact decimal arithmetic, missing-value profiling | Row widths and headers; statistics recomputed from the submitted cells | 0 calls |
| `person_102`, Ada #102 | Editor & verifier | Copy editing, number/link/email inventory; shared deterministic quality checks | Numbers, signs, URLs and email occurrences preserved; output shape and length | At most 1 call for editing; 0 for checks |

An evidence or data task records a handoff to Ada's deterministic checking capability before release. This is a real workflow trace, not a simulated negotiation or agent payment. Ada also checks editing outputs. These checks do not establish complete semantic correctness; the customer still reviews the result.

## Workflow

Wallet sign-in → task request → current-owner/capability check → durable allowance reservation → queued task → bounded tools/inference → output checks → downloadable artifact → customer review → explicit trial acceptance.

The backend supports at most two executing jobs at once. Each job has a stable request ID, source hash, owner-purpose snapshot, workflow trace, artifact hash and persisted result. Repeating the same request ID returns the existing task; reusing it with different content is rejected. Tasks and artifacts are private to the requesting wallet session. Source inputs for AI-assisted tasks are sent to NEAR AI Cloud; CSV input stays in the application worker.

Idle identities and owner brief changes cause no inference requests. The initial budget is 12 reserved inference calls and 24 total trial tasks per UTC day, with 3 tasks per wallet. These are conservative request reservations; failed calls still count. Queued work survives restart, checked outputs are reused, and expired in-flight work becomes interrupted instead of being billed again automatically. API credentials remain server-side. Agents have neither shell access nor wallet signing keys.

## Owner-defined agents

Connect and sign in as the current NFT owner, select your agent, then save a purpose and preferred service capability in the owner section. The server verifies a fresh finalized NFT owner before each change.

The first three identities can use their implemented capability. The other 61 can store a requested purpose and capability, including a custom request, but remain pending review and activation. Writing a brief cannot install new tools, bypass checks, increase budgets, or activate additional identities. After an NFT sale, an old owner's profile no longer controls execution; the new owner must approve a new profile. The registry is stored in the application's persistent database, not in NFT metadata.

## Verification and limits

[Live service examples](service-workforce-verification.json) distinguish actual NEAR AI outputs from automated test fixtures. All three commissioning examples reached `REVIEW_READY`; the source and editing examples used the real gateway, while CSV used real deterministic tools. No customer wallet session, NEAR charge, or mainnet settlement is claimed by those examples.

- [Evidence brief](service-examples/source-brief.md)
- [CSV audit](service-examples/csv-audit.md)
- [Edited document](service-examples/copy-edit.md)

The current release is project-funded trial mode. Customer acceptance does not transfer money. Mainnet treasury settlement remains paused. Paid escrow-to-brief binding, delivery registration, payment release and owner income withdrawals remain incomplete. The service can run continuously on Railway after deployment; it does not require a process on the owner's computer. See [Railway deployment](RAILWAY-DEPLOYMENT.md).
