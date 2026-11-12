import { randomUUID } from "node:crypto";
import { SERVICES } from "./genesis.mjs";
export function createCollaborationService({ store, enqueue }) {
  const { db, now } = store;
  function proposal(id) {
    const p = db.prepare("SELECT * FROM proposals WHERE id=?").get(id);
    if (!p) throw Error("Unknown project proposal");
    return p;
  }
  function project(id) {
    return db
      .prepare("SELECT * FROM agent_projects WHERE proposal_id=?")
      .get(id);
  }
  function request({
    proposalId,
    buyer,
    provider,
    service,
    reason,
    parentThread = null,
    isPrime = false,
    maxPrice,
  }) {
    const p = proposal(proposalId),
      a = store.professional(provider);
    if (
      buyer === provider ||
      !a.services.includes(service) ||
      typeof reason !== "string" ||
      reason.length < 10 ||
      reason.length > 3000
    )
      throw Error(
        "Qualified independent collaborator and bounded RFP required",
      );
    const threads = db
      .prepare(
        "SELECT id,parent_thread FROM agent_threads WHERE parent_proposal=?",
      )
      .all(p.id);
    if (threads.length >= 7)
      throw Error("At most seven collaborator quotations per project");
    if (parentThread) {
      const parent = db
        .prepare("SELECT * FROM agent_threads WHERE id=? AND parent_proposal=?")
        .get(parentThread, p.id);
      if (!parent || parent.provider_agent !== buyer)
        throw Error("Subcontract requester is not the parent provider");
      if (parent.parent_thread)
        throw Error("Subcontract nesting exceeds approved depth");
    }
    const old = db
      .prepare(
        "SELECT id FROM agent_threads WHERE parent_proposal=? AND provider_agent=? AND service_id=?",
      )
      .get(p.id, provider, service);
    if (old) return old.id;
    const id = randomUUID();
    db.prepare(
      "INSERT INTO agent_threads(id,parent_proposal,buyer_agent,provider_agent,service_id,state,max_price,parent_thread,is_prime) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      p.id,
      buyer,
      provider,
      service,
      "REQUESTED",
      maxPrice || SERVICES[service].price,
      parentThread,
      isPrime ? 1 : 0,
    );
    db.prepare("INSERT INTO agent_messages VALUES(?,?,?,?,?,?,?,?)").run(
      randomUUID(),
      id,
      buyer,
      provider,
      "REQUEST_FOR_PROPOSAL",
      reason,
      "QUEUED",
      now(),
    );
    enqueue(provider, "NEGOTIATE", id);
    store.event(
      buyer,
      "AGENT_REQUESTED_SERVICE",
      id,
      "A professional requested a qualified collaborator’s quotation.",
    );
    return id;
  }
  function completedQuotes(id) {
    return db
      .prepare(
        "SELECT t.*,q.scope,q.input_text,q.price FROM agent_threads t LEFT JOIN service_quotes q ON q.thread_id=t.id WHERE t.parent_proposal=? ORDER BY t.rowid",
      )
      .all(id);
  }
  return {
    proposal,
    project,
    request,
    quotes: completedQuotes,
    startAgentProject({
      buyer,
      ownerId,
      receiptHash,
      provider,
      service,
      scope,
      input,
      maxTotal,
    }) {
      if (
        !SERVICES[service] ||
        !store.professional(provider).services.includes(service) ||
        typeof scope !== "string" ||
        scope.length < 20 ||
        scope.length > 3000 ||
        typeof input !== "string" ||
        input.length < 40 ||
        input.length > 16000 ||
        !/^\d{1,39}$/.test(maxTotal) ||
        BigInt(maxTotal) <= 0n
      )
        throw Error("Invalid bounded professional purchase request");
      return store.transaction(() => {
        const id = randomUUID();
        db.prepare(
          "INSERT INTO proposals VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          null,
          ownerId,
          provider,
          service,
          scope,
          input,
          SERVICES[service].price,
          "near:testnet:NEAR",
          "testnet",
          "NEGOTIATING",
          null,
          now(),
        );
        db.prepare("INSERT INTO agent_projects VALUES(?,?,?,?,?,?)").run(
          id,
          buyer,
          ownerId,
          receiptHash,
          maxTotal,
          "NEGOTIATING",
        );
        request({
          proposalId: id,
          buyer,
          provider,
          service,
          reason: scope,
          isPrime: true,
          maxPrice:
            BigInt(SERVICES[service].price) < BigInt(maxTotal)
              ? SERVICES[service].price
              : maxTotal,
        });
        return proposal(id);
      });
    },
    clarify(threadId, customer, content) {
      const thread = db
        .prepare(
          "SELECT t.*,p.customer_id FROM agent_threads t JOIN proposals p ON p.id=t.parent_proposal WHERE t.id=?",
        )
        .get(threadId);
      if (
        !thread ||
        thread.customer_id !== customer ||
        typeof content !== "string" ||
        content.length < 20 ||
        content.length > 3000
      )
        throw Error("Project customer and bounded clarification required");
      const p = proposal(thread.parent_proposal);
      if (!["NEGOTIATING", "NEEDS_CLARIFICATION"].includes(p.state))
        throw Error("Only unfunded negotiations accept clarification");
      if (
        db
          .prepare(
            "SELECT count(*) n FROM agent_messages WHERE thread_id=? AND type LIKE 'CUSTOMER_CLARIFICATION:%'",
          )
          .get(thread.id).n >= 2
      )
        throw Error("Clarification limit reached; scope needs a new proposal");
      return store.transaction(() => {
        const id = randomUUID();
        db.prepare("INSERT INTO agent_messages VALUES(?,?,?,?,?,?,?,?)").run(
          id,
          thread.id,
          thread.buyer_agent,
          thread.provider_agent,
          "CUSTOMER_CLARIFICATION:" + id,
          content,
          "QUEUED",
          now(),
        );
        db.prepare("UPDATE agent_threads SET state='REQUESTED' WHERE id=?").run(
          thread.id,
        );
        db.prepare("UPDATE proposals SET state='NEGOTIATING' WHERE id=?").run(
          p.id,
        );
        enqueue(thread.provider_agent, "NEGOTIATE", id);
        return id;
      });
    },
    recordQuotation(threadId, response, collaborators = [], turnId = null) {
      const thread = db
          .prepare("SELECT * FROM agent_threads WHERE id=?")
          .get(threadId),
        p = proposal(thread.parent_proposal);
      return store.transaction(() => {
        db.prepare("INSERT INTO agent_messages VALUES(?,?,?,?,?,?,?,?)").run(
          randomUUID(),
          thread.id,
          thread.provider_agent,
          thread.buyer_agent,
          turnId ? response.decision + ":" + turnId : response.decision,
          JSON.stringify(response),
          "DELIVERED",
          now(),
        );
        db.prepare(
          "UPDATE agent_messages SET delivery_status='DELIVERED' WHERE thread_id=? AND type='REQUEST_FOR_PROPOSAL'",
        ).run(thread.id);
        db.prepare("UPDATE agent_threads SET state=? WHERE id=?").run(
          response.decision === "QUOTE" ? "QUOTED" : "DECLINED",
          thread.id,
        );
        if (response.decision === "QUOTE") {
          db.prepare(
            "INSERT INTO service_quotes VALUES(?,?,?,?,?) ON CONFLICT(thread_id) DO UPDATE SET scope=excluded.scope,input_text=excluded.input_text,price=excluded.price,created_at=excluded.created_at",
          ).run(
            thread.id,
            response.scope,
            p.input_text,
            response.priceYocto,
            now(),
          );
          if (thread.is_prime)
            db.prepare("UPDATE proposals SET price=? WHERE id=?").run(
              response.priceYocto,
              p.id,
            );
          for (const c of collaborators)
            request({
              proposalId: p.id,
              buyer: thread.provider_agent,
              provider: c.agentId,
              service: c.serviceId,
              reason: c.reason,
              parentThread: thread.id,
            });
        }
        const rows = completedQuotes(p.id);
        if (rows.some((q) => q.state === "DECLINED")) {
          db.prepare(
            "UPDATE proposals SET state='NEEDS_CLARIFICATION' WHERE id=?",
          ).run(p.id);
          db.prepare(
            "UPDATE agent_projects SET state='NEEDS_CLARIFICATION' WHERE proposal_id=?",
          ).run(p.id);
        } else if (rows.every((q) => q.state === "QUOTED"))
          enqueue(
            project(p.id)?.buyer_agent || p.provider_id,
            "REVIEW_QUOTES",
            p.id,
          );
        store.event(
          thread.provider_agent,
          "AGENT_SENT_QUOTATION",
          thread.id,
          "A collaborator independently evaluated scope and returned a bounded quotation or decline.",
        );
      });
    },
    draftManifest(id) {
      const p = proposal(id),
        rows = completedQuotes(id);
      if (rows.some((r) => r.state !== "QUOTED" || !r.price))
        throw Error(
          "Every commissioned collaborator must return a quotation before agreement",
        );
      const list = [
        {
          allocation_index: 0,
          agent_id: p.provider_id,
          service_id: p.service_id,
          scope: p.scope,
          input_text: p.input_text,
          price: p.price,
          parent_index: null,
          thread_id: rows.find((r) => r.is_prime)?.id || null,
        },
      ];
      const indexes = new Map();
      for (const prime of rows.filter((r) => r.is_prime))
        indexes.set(prime.id, 0);
      const pending = rows.filter((r) => !r.is_prime);
      for (let pass = 0; pending.length && pass < 8; pass++)
        for (let i = pending.length - 1; i >= 0; i--) {
          const r = pending[i];
          const parentIndex = r.parent_thread
            ? indexes.get(r.parent_thread)
            : 0;
          if (parentIndex === undefined) continue;
          const n = list.length;
          indexes.set(r.id, n);
          list.push({
            allocation_index: n,
            agent_id: r.provider_agent,
            service_id: r.service_id,
            scope: r.scope,
            input_text: r.input_text,
            price: r.price,
            parent_index: parentIndex,
            thread_id: r.id,
          });
          pending.splice(i, 1);
        }
      if (pending.length || list.length > 8)
        throw Error("Invalid or oversized dependency graph");
      return list;
    },
    acceptManifest(id, reviewer, reason, manifest) {
      if (
        typeof reason !== "string" ||
        reason.length < 10 ||
        reason.length > 2000 ||
        !manifest.length ||
        manifest.length > 8
      )
        throw Error("Evidence-based contract review required");
      return store.transaction(() => {
        if (
          db
            .prepare(
              "SELECT proposal_id FROM project_allocations WHERE proposal_id=?",
            )
            .get(id)
        )
          return;
        for (const a of manifest)
          db.prepare(
            "INSERT INTO project_allocations VALUES(?,?,?,?,?,?,?,?,?)",
          ).run(
            id,
            a.allocation_index,
            a.agent_id,
            a.service_id,
            a.scope,
            a.input_text,
            a.price,
            a.parent_index,
            a.thread_id,
          );
        db.prepare("INSERT INTO project_decisions VALUES(?,?,?,?,?,?,?)").run(
          randomUUID(),
          id,
          reviewer,
          "QUOTE_REVIEW",
          "ACCEPT",
          reason,
          now(),
        );
        db.prepare("UPDATE proposals SET state='PROPOSED' WHERE id=?").run(id);
        db.prepare(
          "UPDATE agent_projects SET state='AGREED' WHERE proposal_id=?",
        ).run(id);
        store.event(
          reviewer,
          "CONTRACT_AGREED",
          id,
          "Professional scope, dependency work and testnet prices were reviewed. Funding is a separate verified step.",
        );
      });
    },
    decline(id, reviewer, reason) {
      store.transaction(() => {
        db.prepare("INSERT INTO project_decisions VALUES(?,?,?,?,?,?,?)").run(
          randomUUID(),
          id,
          reviewer,
          "QUOTE_REVIEW",
          "DECLINE",
          String(reason).slice(0, 2000),
          now(),
        );
        db.prepare(
          "UPDATE proposals SET state='NEEDS_CLARIFICATION' WHERE id=?",
        ).run(id);
        db.prepare(
          "UPDATE agent_projects SET state='NEEDS_CLARIFICATION' WHERE proposal_id=?",
        ).run(id);
      });
    },
    manifest(id) {
      return db
        .prepare(
          "SELECT * FROM project_allocations WHERE proposal_id=? ORDER BY allocation_index",
        )
        .all(id);
    },
  };
}
