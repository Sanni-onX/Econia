import { randomUUID } from "node:crypto";
export function createMemoryService(store) {
  const { db, now } = store;
  return {
    remember({
      agentId,
      kind = "EPISODIC",
      visibility = "PROFESSIONAL",
      principal = null,
      content,
      sourceType,
      sourceId,
    }) {
      if (
        !["EPISODIC", "SEMANTIC", "RELATIONSHIP", "STRATEGY"].includes(kind) ||
        !["PROFESSIONAL", "CLIENT", "OWNER"].includes(visibility) ||
        typeof content !== "string" ||
        content.length < 1 ||
        content.length > 4000 ||
        !sourceType ||
        !sourceId ||
        (visibility !== "PROFESSIONAL" && !principal)
      )
        throw Error("Invalid bounded memory");
      store.professional(agentId);
      db.prepare(
        "INSERT OR IGNORE INTO memories VALUES(?,?,?,?,?,?,?,?,?)",
      ).run(
        randomUUID(),
        agentId,
        kind,
        visibility,
        principal,
        content,
        sourceType,
        sourceId,
        now(),
      );
    },
    retrieve(
      agentId,
      { query = "", principal, owner = false, limit = 8 } = {},
    ) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 12)
        throw Error("Memory retrieval bound");
      const terms = query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
      const rows = db
        .prepare(
          "SELECT id,kind,visibility,content,source_type,source_id,created_at FROM memories WHERE agent_id=? AND (visibility='PROFESSIONAL' OR (principal=? AND visibility='CLIENT') OR (principal=? AND visibility='OWNER' AND ?=1)) ORDER BY rowid DESC LIMIT 100",
        )
        .all(agentId, principal || "", principal || "", owner ? 1 : 0);
      return rows
        .map((m, i) => ({
          ...m,
          score:
            terms.reduce(
              (n, t) => n + (m.content.toLowerCase().includes(t) ? 1 : 0),
              0,
            ) +
            1 / (i + 1),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ score, ...m }) => m);
    },
    strategy(agentId, principal = "") {
      return (
        db
          .prepare(
            "SELECT version,guidance,evidence_id,created_at FROM strategy_versions WHERE agent_id=? AND principal=? ORDER BY version DESC LIMIT 1",
          )
          .get(agentId, principal) || {
          version: 0,
          guidance:
            "No evaluated strategy revisions for this relationship yet.",
        }
      );
    },
    revise(agentId, { guidance, evaluationId }) {
      if (
        typeof guidance !== "string" ||
        guidance.length < 20 ||
        guidance.length > 1800
      )
        throw Error("Bounded strategy guidance required");
      const evidence = db
        .prepare(
          "SELECT e.id,e.customer_id,p.provider_id FROM evaluations e JOIN contracts c ON c.id=e.contract_id JOIN proposals p ON p.id=c.proposal_id WHERE e.id=?",
        )
        .get(evaluationId);
      if (!evidence || evidence.provider_id !== agentId)
        throw Error(
          "Strategy revision requires this agent’s verified evaluation",
        );
      return store.transaction(() => {
        const duplicate = db
          .prepare(
            "SELECT version FROM strategy_versions WHERE agent_id=? AND evidence_id=?",
          )
          .get(agentId, evaluationId);
        if (duplicate) return duplicate.version;
        const version =
          (db
            .prepare(
              "SELECT MAX(version) AS n FROM strategy_versions WHERE agent_id=?",
            )
            .get(agentId).n || 0) + 1;
        db.prepare("INSERT INTO strategy_versions VALUES(?,?,?,?,?,?)").run(
          agentId,
          version,
          guidance,
          evaluationId,
          evidence.customer_id,
          now(),
        );
        store.event(
          agentId,
          "AGENT_UPDATED_STRATEGY",
          evaluationId,
          `Professional strategy revised to version ${version} after evaluated work.`,
        );
        return version;
      });
    },
  };
}
