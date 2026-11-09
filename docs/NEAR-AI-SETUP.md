# Activate Econia's NEAR AI runtime

The integration is implemented; live inference requires your NEAR AI Cloud account, credits and a private local API key. External customer services are not part of this phase.

## Account and local configuration

1. Create an account at [NEAR AI Cloud](https://cloud.near.ai/).
2. Add inference credits and generate an API key in its dashboard. Set an account spending limit if available. Do not paste the key into chat or source files.
3. Open the project's ignored `.env` file locally and fill in `NEAR_AI_API_KEY`. The file must remain outside version control. The application sends that credential only to `https://cloud-api.near.ai` from the server.
4. Use `AGENT_MODE=near-ai` and select an available model. The prepared configuration uses `z-ai/glm-5.3-flash`, documented by NEAR AI on 9 November 2026. Model availability and pricing can change. The adapter caps its reasoning at 512 tokens and caps total completion output at `NEAR_AI_MAX_TOKENS`.
5. Restart the local testnet worker with `npm run start:testnet`. Do not start two workers on the same world database. This command reads `.env`; plain `npm start` does not currently load it automatically.

Default limits are four requests per cycle and 240 reserved requests per UTC day, with a maximum 1,200 completion tokens per request. These are request/output limits, not a guaranteed dollar ceiling: input tokens also cost money. Failed and interrupted requests count conservatively against the request allowance. Reaching the allowance pauses new economic cycles until the UTC day changes or an operator changes the configuration.

The live testnet world also has a previously exhausted restricted operator gas allowance. Adding inference credits does not fix NEAR settlement. A prepared settlement is recovered before new AI plans are requested; a failed pending batch prevents new plans from being billed.

On 9 November the configured local key reached the gateway, but inference returned HTTP 402. Account credits still need checking; a configured key does not establish successful paid inference. Billing and authentication refusals pause the cycle and persist a five-minute retry delay. Correct the account/key issue before restarting a live trial. The development probe did not produce an AI decision.

## What the runtime does

- Maintains a runtime identity for each working/producing entity, with recent structured outcome memory.
- Rotates bounded planning slots across active agents. A waiting entity receives an explicit WAIT action, with the scheduler identified as its source.
- Supplies the model with the entity's goal, traits, capabilities, policy, cash, inventory, recipes, relevant relationships and current counterparties. No wallet private keys or full-access credentials enter the prompt.
- Accepts a structured action proposal and concise rationale. It does not expose internal model reasoning traces.
- Enforces action shapes and then passes proposals through the existing capability, affordability, inventory and reserve checks.
- Saves planning progress and reserves its request allowance before calling the model. Ready results are reused after a restart; uncertain requests are not automatically billed again. Changed context invalidates a cached plan.
- Writes actual accepted/rejected outcomes into the entity's bounded memory after execution. Checkpoints preserve this memory across restarts. Decision evidence retains model, request ID where supplied, context fingerprint and reported token usage.
- Uses the same prepared-cycle and settlement recovery path as the existing testnet ledger. AI failure never triggers a hidden rule-generated decision.

The current AI action surface is WAIT, WORK, BUY, CONSUME, PRODUCE, HIRE and CREATE_BUSINESS. It uses the existing posted goods prices and employment mechanics. Negotiated quotes, lending, dividends and external services are not enabled by this integration. A model cannot invent those capabilities or mutate the ledger directly.

## Verification

Check `/api/health` and `/api/world` for `intelligence.mode` and `intelligence.ready`. A configured key is not proof that it is valid or funded. Reopen a resident's Life panel to see its intelligence status and latest remembered outcome. Its Choices evidence identifies the actual decision source.

Source `rules` means an explicit development controller. Source `scheduler` means waiting; it is not an AI decision. Source `near-ai` with inference evidence identifies a completed model proposal, which may still be rejected by the engine. Runtime memory and successful mocked integration tests do not prove a live provider request occurred.

## Documentation

- [NEAR AI quickstart](https://docs.near.ai/cloud/quickstart)
- [Model catalog and privacy tiers](https://docs.near.ai/cloud/models)
- [Reasoning controls](https://docs.near.ai/cloud/reasoning-models)
