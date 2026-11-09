import React from "react";
import "./agents.css";

export function AgentStatus({ entity, world }) {
  const runtime = world.agentRuntime?.agents?.[entity.id];
  const enabled = world.intelligence?.mode === "near-ai";
  const memory = runtime?.memory?.at(-1);
  return (
    <section className="agent-status" aria-label="Agent intelligence">
      <div className="agent-status-heading">
        <strong>Agent intelligence</strong>
        <span>{enabled ? "NEAR AI" : "Rules · development mode"}</span>
      </div>
      <p>
        {!enabled
          ? "This recorded world uses deterministic controllers. AI operation has not been activated here."
          : !world.intelligence.ready
            ? "AI decisions are paused until NEAR AI Cloud is configured."
            : world.intelligence.issue
              ? world.intelligence.issue
              : runtime?.status === "THINKING"
                ? "Evaluating the next opportunity."
                : runtime?.status === "FAILED"
                  ? "Inference was interrupted or failed. No rule-based decision was substituted."
                  : runtime?.status === "REJECTED"
                    ? "The latest proposal was rejected by the economic safeguards."
                    : runtime?.lastDecisionCycle
                      ? `Last AI decision: cycle ${runtime.lastDecisionCycle}.`
                      : "Waiting for an AI planning slot."}
      </p>
      {enabled && memory && (
        <div className="agent-memory">
          <small>Latest remembered outcome</small>
          <p>
            {memory.action.type.replaceAll("_", " ")} ·{" "}
            {memory.status.toLowerCase()}
            {memory.result ? ` · ${memory.result}` : ""}
          </p>
          <p>{memory.note}</p>
        </div>
      )}
      {enabled && (
        <small>
          Plans stay within owner constraints. Funding does not guarantee
          success.
        </small>
      )}
    </section>
  );
}
