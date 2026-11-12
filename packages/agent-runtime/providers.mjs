export function createNearInferenceProvider({
  apiKey = process.env.NEAR_AI_API_KEY,
  model = process.env.NEAR_AI_MODEL,
  fetchImpl = fetch,
} = {}) {
  return {
    name: "near-ai-cloud",
    ready: Boolean(apiKey && model),
    async infer({ system, context, schema, signal, maxTokens = 2200 }) {
      if (!apiKey || !model)
        throw Error("Funded NEAR AI inference configuration required");
      const response = await fetchImpl(
        "https://cloud-api.near.ai/v1/chat/completions",
        {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            ...(model === "z-ai/glm-5.3-flash"
              ? { thinking_token_budget: 512 }
              : {}),
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "econia_professional_action",
                strict: true,
                schema,
              },
            },
            messages: [
              { role: "system", content: system },
              { role: "user", content: JSON.stringify(context) },
            ],
          }),
        },
      );
      if (!response.ok)
        throw Error(
          `Inference unavailable (HTTP ${response.status}); request will not be automatically retried`,
        );
      const text = await response.text();
      if (text.length > 100000)
        throw Error("Inference response exceeded bounds");
      const result = JSON.parse(text),
        choice = result.choices?.[0];
      if (
        choice?.finish_reason !== "stop" ||
        typeof choice.message?.content !== "string"
      )
        throw Error("Incomplete inference; no automatic retry");
      return {
        value: JSON.parse(choice.message.content),
        model,
        tokens: result.usage?.total_tokens ?? 0,
      };
    },
  };
}

export function unavailableExternalProviders() {
  return {
    discovery: {
      name: "near-agent-market",
      status: "NOT_CONNECTED",
      reason:
        "No valueless testnet marketplace or scoped agent token has been verified.",
    },
    confidentialExecution: {
      name: "ironclaw",
      status: "NOT_CONNECTED",
      reason:
        "Local bounded runtime is active; no IronClaw or TEE hosting claim.",
    },
    settlement: {
      name: "near-intents",
      status: "DISABLED",
      reason:
        "Native testnet escrow is required; real-value cross-chain swaps are excluded.",
    },
  };
}
