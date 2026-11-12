import { randomUUID, createHash } from "node:crypto";
import { analyseCsv } from "../agent-sdk/service-tools.mjs";
import { SERVICES } from "./genesis.mjs";
import { createVerifiedLedger } from "./ledger.mjs";
export function createContractService(store, { settlement, enqueue, memory }) {
  const { db, now } = store;
  const ledger = createVerifiedLedger(store);
  function reconcileProfessionalHistory() {
    const settled = db
      .prepare(
        "SELECT a.*,p.provider_id,p.service_id,j.buyer_agent,r.tx_hash FROM contract_allocations a JOIN contracts c ON c.id=a.contract_id JOIN proposals p ON p.id=c.proposal_id JOIN contracts root ON root.id=a.root_contract JOIN receipts r ON r.tx_hash=root.settlement_tx AND r.network_id='testnet' LEFT JOIN agent_projects j ON j.proposal_id=root.proposal_id WHERE c.state='SETTLED'",
      )
      .all();
    db.prepare("UPDATE relationships SET completed=0").run();
    for (const row of settled) {
      const buyer = row.parent_contract
        ? db
            .prepare(
              "SELECT p.provider_id FROM contracts c JOIN proposals p ON p.id=c.proposal_id WHERE c.id=?",
            )
            .get(row.parent_contract)?.provider_id
        : row.buyer_agent;
      if (buyer && buyer !== row.provider_id)
        db.prepare(
          "INSERT INTO relationships(agent_id,peer_id,completed) VALUES(?,?,1) ON CONFLICT(agent_id,peer_id) DO UPDATE SET completed=completed+1",
        ).run(buyer, row.provider_id);
      memory.remember({
        agentId: row.provider_id,
        visibility: "PROFESSIONAL",
        content:
          "Checked " +
          row.service_id +
          " work was accepted and settled on NEAR testnet. Private brief and client records remain separately scoped.",
        sourceType: "verified-settlement",
        sourceId: row.contract_id,
      });
    }
  }
  store.transaction(reconcileProfessionalHistory);
  function enrich(p) {
    const rows = db
      .prepare(
        "SELECT * FROM project_allocations WHERE proposal_id=? ORDER BY allocation_index",
      )
      .all(p.id);
    const allocations = rows.length
      ? rows
      : [
          {
            allocation_index: 0,
            agent_id: p.provider_id,
            service_id: p.service_id,
            scope: p.scope,
            input_text: p.input_text,
            price: p.price,
            parent_index: null,
          },
        ];
    const project = db
      .prepare("SELECT * FROM agent_projects WHERE proposal_id=?")
      .get(p.id);
    return {
      ...p,
      allocations,
      total_price: allocations
        .reduce((n, a) => n + BigInt(a.price), 0n)
        .toString(),
      buyer_agent: project?.buyer_agent || null,
      source:
        db
          .prepare(
            "SELECT a.id,a.filename,a.content_type,a.sha256 FROM proposal_sources s JOIN source_attachments a ON a.id=s.attachment_id WHERE s.proposal_id=?",
          )
          .get(p.id) || null,
    };
  }
  function requireProposal(id, customer) {
    const p = db
      .prepare("SELECT * FROM proposals WHERE id=? AND customer_id=?")
      .get(id, customer);
    if (!p) throw Object.assign(Error("Proposal not found"), { status: 404 });
    return enrich(p);
  }
  function requireContract(id, customer) {
    const c = db
      .prepare(
        "SELECT c.*,p.customer_id,p.provider_id,p.service_id,p.scope,p.input_text,p.price FROM contracts c JOIN proposals p ON p.id=c.proposal_id WHERE c.id=? AND p.customer_id=?",
      )
      .get(id, customer);
    if (!c) throw Object.assign(Error("Contract not found"), { status: 404 });
    const root =
      db
        .prepare(
          "SELECT root_contract FROM contract_allocations WHERE contract_id=?",
        )
        .get(c.id)?.root_contract || c.id;
    const rows = db
      .prepare(
        "SELECT c.delivery_hash FROM contract_allocations a JOIN contracts c ON c.id=a.contract_id WHERE a.root_contract=? ORDER BY a.allocation_index",
      )
      .all(root);
    return {
      ...enrich(requireProposal(c.proposal_id, customer)),
      ...c,
      id: c.id,
      proposal_id: c.proposal_id,
      root_contract: root,
      issues: db
        .prepare(
          "SELECT c.id,p.provider_id,p.service_id FROM contracts c JOIN proposals p ON p.id=c.proposal_id WHERE c.id=? OR c.id IN (SELECT contract_id FROM contract_allocations WHERE root_contract=?)",
        )
        .all(root, root)
        .map((x) => ({
          ...x,
          attempt: db
            .prepare(
              "SELECT state,error FROM runtime_jobs WHERE kind='EXECUTE' AND (reference_id=? OR reference_id IN (SELECT id FROM work_revisions WHERE contract_id=?)) ORDER BY rowid DESC LIMIT 1",
            )
            .get(x.id, x.id),
        }))
        .filter((x) => x.attempt?.state === "INTERRUPTED"),
      evidence: rows.length
        ? rows.map((r) => r.delivery_hash)
        : [c.delivery_hash],
    };
  }
  return {
    requireProposal,
    requireContract,
    propose({
      conversationId,
      customerId,
      providerId,
      serviceId,
      scope,
      input,
      price,
      parentId = null,
    }) {
      const a = store.professional(providerId),
        service = SERVICES[serviceId];
      if (
        !service ||
        !a.services.includes(serviceId) ||
        typeof scope !== "string" ||
        scope.length < 20 ||
        scope.length > 3000 ||
        typeof input !== "string" ||
        input.length < (service.type === "csv" ? 1 : 40) ||
        input.length > 16000 ||
        !/^\d{1,30}$/.test(price) ||
        BigInt(price) < 1n ||
        BigInt(price) > BigInt(service.price)
      )
        throw Error(
          "Proposal violates professional scope or published price ceiling",
        );
      if (service.type === "csv") analyseCsv(input);
      const id = randomUUID();
      db.prepare("INSERT INTO proposals VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
        id,
        conversationId || null,
        customerId,
        providerId,
        serviceId,
        scope,
        input,
        price,
        "near:testnet:NEAR",
        "testnet",
        "PROPOSED",
        parentId,
        now(),
      );
      store.event(
        providerId,
        "AGENT_SENT_PROPOSAL",
        id,
        "A professional submitted a scoped testnet service proposal.",
      );
      return requireProposal(id, customerId);
    },
    list(customer) {
      return db
        .prepare(
          "SELECT p.*,c.id AS contract_id,c.state AS contract_state FROM proposals p LEFT JOIN contracts c ON c.proposal_id=p.id WHERE p.customer_id=? AND p.parent_id IS NULL ORDER BY p.created_at DESC LIMIT 50",
        )
        .all(customer)
        .map(enrich);
    },
    fundingRequest(id, customer) {
      const p = requireProposal(id, customer);
      if (SERVICES[p.service_id].type === "csv") analyseCsv(p.input_text);
      if (p.state !== "PROPOSED")
        throw Error("Proposal is not available for funding");
      if (p.buyer_agent)
        throw Error(
          "Agent purchases require their current owner's operating policy",
        );
      if (
        db
          .prepare("SELECT id FROM agent_threads WHERE parent_proposal=?")
          .get(p.id) &&
        !db
          .prepare(
            "SELECT proposal_id FROM project_allocations WHERE proposal_id=?",
          )
          .get(p.id)
      )
        throw Error("Collaborator quotations must be reviewed before funding");
      if (!settlement?.ready || !settlement?.prepareFunding)
        throw Object.assign(
          Error(
            "Testnet escrow is not commissioned; no payment has been requested",
          ),
          { status: 503 },
        );
      return settlement.prepareFunding(p);
    },
    async confirmFunding(id, customer, transactionHash) {
      const p = requireProposal(id, customer);
      if (
        db
          .prepare("SELECT id FROM agent_threads WHERE parent_proposal=?")
          .get(p.id) &&
        !db
          .prepare(
            "SELECT proposal_id FROM project_allocations WHERE proposal_id=?",
          )
          .get(p.id)
      )
        throw Error("Collaborator quotations must be reviewed before funding");
      const old = db
        .prepare("SELECT * FROM contracts WHERE proposal_id=?")
        .get(id);
      if (old) {
        if (old.funding_tx !== transactionHash)
          throw Error("Contract already funded by another receipt");
        return old;
      }
      if (
        !(p.buyer_agent
          ? settlement?.verifyAgentFunding
          : settlement?.verifyFunding)
      )
        throw Error("Testnet funding verifier unavailable");
      const receipt = await (
        p.buyer_agent ? settlement.verifyAgentFunding : settlement.verifyFunding
      )({
        proposal: p,
        transactionHash,
        customer,
      });
      if (
        receipt.network !== "testnet" ||
        receipt.signer !== (p.buyer_agent ? settlement.contract : customer) ||
        receipt.proposalId !== p.id ||
        receipt.agentId !== p.provider_id ||
        receipt.amount !== p.total_price ||
        !receipt.jobId ||
        receipt.hash !== transactionHash
      )
        throw Error("Funding receipt does not match the accepted proposal");
      return store.transaction(() => {
        const id = randomUUID();
        db.prepare("INSERT INTO receipts VALUES(?,?,?,?,?,?,?)").run(
          receipt.hash,
          "testnet",
          receipt.contract,
          p.buyer_agent ? "open_agent_service_job" : "post_service_job",
          receipt.signer,
          String(receipt.blockHeight),
          now(),
        );
        const contractIds = [];
        for (const a of p.allocations) {
          let proposalId = p.id;
          if (a.allocation_index !== 0) {
            proposalId = randomUUID();
            db.prepare(
              "INSERT INTO proposals VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            ).run(
              proposalId,
              null,
              customer,
              a.agent_id,
              a.service_id,
              a.scope,
              a.input_text,
              a.price,
              p.asset_id,
              p.network_id,
              "ACCEPTED",
              p.id,
              now(),
            );
          }
          const cid = a.allocation_index === 0 ? id : randomUUID();
          contractIds.push(cid);
          db.prepare("INSERT INTO contracts VALUES(?,?,?,?,?,NULL,NULL,?)").run(
            cid,
            proposalId,
            "FUNDED",
            a.allocation_index === 0 ? receipt.hash : null,
            a.allocation_index === 0 ? String(receipt.jobId) : null,
            now(),
          );
          db.prepare("INSERT INTO contract_allocations VALUES(?,?,?,?)").run(
            id,
            cid,
            a.allocation_index,
            a.parent_index === null ? null : contractIds[a.parent_index],
          );
        }
        for (const a of p.allocations)
          if (a.parent_index !== null)
            db.prepare("INSERT INTO task_dependencies VALUES(?,?)").run(
              contractIds[a.parent_index],
              contractIds[a.allocation_index],
            );
        db.prepare("UPDATE proposals SET state='ACCEPTED' WHERE id=?").run(
          p.id,
        );
        ledger.record({
          receiptHash: receipt.hash,
          debit: p.buyer_agent
            ? "agent:" + p.buyer_agent
            : "wallet:" + customer,
          credit: "escrow:" + id,
          amount: p.total_price,
        });
        for (const a of p.allocations)
          if (
            !db
              .prepare("SELECT task_id FROM task_dependencies WHERE task_id=?")
              .get(contractIds[a.allocation_index])
          )
            enqueue(a.agent_id, "EXECUTE", contractIds[a.allocation_index]);
        store.event(
          p.provider_id,
          "CONTRACT_FUNDED",
          id,
          "Testnet escrow funding verified; professional execution queued.",
        );
        return requireContract(id, customer);
      });
    },
    async requestRevision(id, customer, feedback) {
      const c = requireContract(id, customer);
      if (
        !["FUNDED", "WORKING"].includes(c.state) ||
        typeof feedback !== "string" ||
        feedback.length < 20 ||
        feedback.length > 2000 ||
        db.prepare("SELECT id FROM deliverables WHERE contract_id=?").get(c.id)
      )
        throw Error(
          "Only failed, undelivered funded work accepts a bounded revision request",
        );
      const last = db
        .prepare(
          "SELECT j.state FROM runtime_jobs j WHERE j.kind='EXECUTE' AND (j.reference_id=? OR j.reference_id IN (SELECT id FROM work_revisions WHERE contract_id=?)) ORDER BY rowid DESC LIMIT 1",
        )
        .get(c.id, c.id);
      if (
        last?.state !== "INTERRUPTED" ||
        db
          .prepare("SELECT count(*) n FROM work_revisions WHERE contract_id=?")
          .get(c.id).n >= 2
      )
        throw Error(
          "An interrupted execution and at most two explicit revisions are supported",
        );
      if (settlement?.view) {
        const root = db
          .prepare("SELECT chain_job_id FROM contracts WHERE id=?")
          .get(c.root_contract);
        const job = await settlement.view("get_service_job", {
          job_id: Number(root.chain_job_id),
        });
        if (job?.state !== "FUNDED")
          throw Error("Attested or settled work cannot be revised");
      }
      return store.transaction(() => {
        const revisionId = randomUUID();
        db.prepare("INSERT INTO work_revisions VALUES(?,?,?,?,?)").run(
          revisionId,
          c.id,
          customer,
          feedback,
          now(),
        );
        enqueue(c.provider_id, "EXECUTE", revisionId);
        return { id: revisionId, contractId: c.id };
      });
    },
    deliver(contractId, files, checks) {
      return store.transaction(() => {
        const c = db
          .prepare(
            "SELECT c.*,p.provider_id,p.customer_id FROM contracts c JOIN proposals p ON p.id=c.proposal_id WHERE c.id=?",
          )
          .get(contractId);
        if (
          !c ||
          !["FUNDED", "WORKING"].includes(c.state) ||
          !files.length ||
          !checks.length
        )
          throw Error("Funded contract and verified artifacts required");
        for (const f of files) {
          if (
            typeof f.content !== "string" ||
            f.content.length > 100000 ||
            createHash("sha256").update(f.content).digest("hex") !== f.sha256
          )
            throw Error("Artifact content or hash mismatch");
          db.prepare(
            "INSERT INTO deliverables VALUES(?,?,?,?,?,?,?,?,?,?)",
          ).run(
            randomUUID(),
            c.id,
            c.provider_id,
            f.contentType,
            f.filename,
            f.content,
            f.sha256,
            1,
            1,
            now(),
          );
        }
        const evidenceHash = createHash("sha256")
          .update(files.map((f) => f.sha256).join(":"))
          .digest("hex");
        db.prepare(
          "UPDATE contracts SET state='REVIEW_READY',delivery_hash=? WHERE id=?",
        ).run(evidenceHash, c.id);
        const root = db
          .prepare(
            "SELECT root_contract FROM contract_allocations WHERE contract_id=?",
          )
          .get(c.id)?.root_contract;
        if (root) {
          const project = db
            .prepare(
              "SELECT j.buyer_agent FROM contracts c JOIN agent_projects j ON j.proposal_id=c.proposal_id WHERE c.id=?",
            )
            .get(root);
          const pending = db
            .prepare(
              "SELECT c.id FROM contract_allocations a JOIN contracts c ON c.id=a.contract_id WHERE a.root_contract=? AND c.state NOT IN ('REVIEW_READY','SETTLED')",
            )
            .get(root);
          if (project && !pending)
            enqueue(project.buyer_agent, "REVIEW_DELIVERY", root);
        }
        const parents = db
          .prepare(
            "SELECT c.id,p.provider_id FROM task_dependencies d JOIN contracts c ON c.id=d.task_id JOIN proposals p ON p.id=c.proposal_id WHERE d.dependency_id=?",
          )
          .all(c.id);
        for (const parent of parents) {
          const pending = db
            .prepare(
              "SELECT c.id FROM task_dependencies d JOIN contracts c ON c.id=d.dependency_id WHERE d.task_id=? AND c.state NOT IN ('REVIEW_READY','SETTLED')",
            )
            .get(parent.id);
          if (!pending) enqueue(parent.provider_id, "EXECUTE", parent.id);
        }
        memory.remember({
          agentId: c.provider_id,
          visibility: "CLIENT",
          principal: c.customer_id,
          content: `Delivered checked ${files.map((f) => f.filename).join(", ")}. ${checks.join("; ")}`,
          sourceType: "contract",
          sourceId: c.id,
        });
        store.event(
          c.provider_id,
          "DELIVERABLE_SUBMITTED",
          c.id,
          "A checked professional deliverable is ready for customer review.",
        );
        return evidenceHash;
      });
    },
    artifacts(id, customer) {
      requireContract(id, customer);
      return db
        .prepare(
          "SELECT id,agent_id,filename,content_type,sha256,version,verified,created_at FROM deliverables WHERE contract_id=? OR contract_id IN (SELECT contract_id FROM contract_allocations WHERE root_contract=?) ORDER BY rowid",
        )
        .all(id, id);
    },
    artifact(id, customer) {
      const f = db
        .prepare(
          "SELECT d.*,p.customer_id FROM deliverables d JOIN contracts c ON c.id=d.contract_id JOIN proposals p ON p.id=c.proposal_id WHERE d.id=? AND p.customer_id=?",
        )
        .get(id, customer);
      if (!f) throw Object.assign(Error("Artifact not found"), { status: 404 });
      return f;
    },
    async acceptanceRequest(id, customer) {
      const c = requireContract(id, customer);
      if (
        c.state !== "REVIEW_READY" ||
        c.evidence.some((h) => !h) ||
        c.root_contract !== c.id
      )
        throw Error("All checked project deliveries required");
      if (!settlement?.prepareAcceptance)
        throw Error("Testnet acceptance adapter unavailable");
      return settlement.prepareAcceptance(c);
    },
    async confirmAcceptance(id, customer, transactionHash, operator = false) {
      const c = requireContract(id, customer);
      if (c.state === "SETTLED") {
        if (c.settlement_tx !== transactionHash) throw Error("Already settled");
        return c;
      }
      if (
        c.state !== "REVIEW_READY" ||
        c.evidence.some((h) => !h) ||
        c.root_contract !== c.id ||
        !settlement?.verifyAcceptance
      )
        throw Error(
          "Checked delivery and verified testnet settlement required",
        );
      const receipt = await settlement.verifyAcceptance({
        contract: c,
        customer: c.buyer_agent && operator ? settlement.contract : customer,
        transactionHash,
      });
      if (
        receipt.network !== "testnet" ||
        ![customer, ...(c.buyer_agent ? [settlement.contract] : [])].includes(
          receipt.signer,
        ) ||
        String(receipt.jobId) !== c.chain_job_id ||
        receipt.hash !== transactionHash
      )
        throw Error("Acceptance receipt mismatch");
      return store.transaction(() => {
        db.prepare("INSERT INTO receipts VALUES(?,?,?,?,?,?,?)").run(
          receipt.hash,
          "testnet",
          receipt.contract,
          "accept_service_job",
          receipt.signer,
          String(receipt.blockHeight),
          now(),
        );
        db.prepare(
          "UPDATE contracts SET state='SETTLED',settlement_tx=? WHERE id=?",
        ).run(receipt.hash, c.id);
        const totals = new Map();
        for (const a of c.allocations)
          totals.set(
            a.agent_id,
            (totals.get(a.agent_id) || 0n) + BigInt(a.price),
          );
        for (const [agent, amount] of totals)
          ledger.record({
            receiptHash: receipt.hash,
            debit: "escrow:" + c.id,
            credit: "agent:" + agent,
            amount: amount.toString(),
          });
        db.prepare(
          "UPDATE contracts SET state='SETTLED' WHERE id IN (SELECT contract_id FROM contract_allocations WHERE root_contract=?)",
        ).run(c.id);
        reconcileProfessionalHistory();
        if (c.buyer_agent)
          store.event(
            c.buyer_agent,
            "PROJECT_COMPLETED",
            c.id,
            "An authorized professional project completed and settled after checked delivery.",
          );
        for (const a of c.allocations)
          if (a.agent_id !== c.provider_id)
            store.event(
              a.agent_id,
              "PAYMENT_SETTLED",
              c.id,
              "Checked specialist work was accepted and settled in valueless testnet assets.",
            );
        store.event(
          c.provider_id,
          "PAYMENT_SETTLED",
          c.id,
          "Accepted work settled in valueless NEAR testnet assets.",
        );
        return requireContract(id, customer);
      });
    },
    evaluate(id, customer, { rating, feedback }) {
      const c = requireContract(id, customer);
      if (
        !["REVIEW_READY", "SETTLED"].includes(c.state) ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5 ||
        typeof feedback !== "string" ||
        feedback.length < 10 ||
        feedback.length > 2000
      )
        throw Error(
          "A checked deliverable, 1–5 rating and 10–2000 character feedback are required",
        );
      const old = db
        .prepare(
          "SELECT * FROM evaluations WHERE contract_id=? AND customer_id=?",
        )
        .get(id, customer);
      if (old) return old;
      return store.transaction(() => {
        const evaluationId = randomUUID();
        db.prepare("INSERT INTO evaluations VALUES(?,?,?,?,?,?)").run(
          evaluationId,
          id,
          customer,
          rating,
          feedback,
          now(),
        );
        enqueue(c.provider_id, "REFLECT", evaluationId);
        return db
          .prepare("SELECT * FROM evaluations WHERE id=?")
          .get(evaluationId);
      });
    },
  };
}
