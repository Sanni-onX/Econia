import { randomUUID, createHash } from "node:crypto";
import { SERVICES } from "./genesis.mjs";
export function createContractService(store, { settlement, enqueue, memory }) {
  const { db, now } = store;
  function requireProposal(id, customer) {
    const p = db
      .prepare("SELECT * FROM proposals WHERE id=? AND customer_id=?")
      .get(id, customer);
    if (!p) throw Object.assign(Error("Proposal not found"), { status: 404 });
    return p;
  }
  function requireContract(id, customer) {
    const c = db
      .prepare(
        "SELECT c.*,p.customer_id,p.provider_id,p.service_id,p.scope,p.input_text,p.price FROM contracts c JOIN proposals p ON p.id=c.proposal_id WHERE c.id=? AND p.customer_id=?",
      )
      .get(id, customer);
    if (!c) throw Object.assign(Error("Contract not found"), { status: 404 });
    return c;
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
        input.length < 40 ||
        input.length > 16000 ||
        !/^\d{1,30}$/.test(price) ||
        BigInt(price) < 1n ||
        BigInt(price) > BigInt(service.price)
      )
        throw Error(
          "Proposal violates professional scope or published price ceiling",
        );
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
          "SELECT p.*,c.id AS contract_id,c.state AS contract_state FROM proposals p LEFT JOIN contracts c ON c.proposal_id=p.id WHERE p.customer_id=? ORDER BY p.created_at DESC LIMIT 50",
        )
        .all(customer);
    },
    fundingRequest(id, customer) {
      const p = requireProposal(id, customer);
      if (p.state !== "PROPOSED")
        throw Error("Proposal is not available for funding");
      if (
        db
          .prepare("SELECT id FROM agent_threads WHERE parent_proposal=?")
          .get(p.id)
      )
        throw Error(
          "Collaborator quotes require subcontract approval and funding support before this proposal can be funded",
        );
      if (!settlement?.prepareFunding)
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
          .get(p.id)
      )
        throw Error("Collaborative funding is not yet enabled");
      const old = db
        .prepare("SELECT * FROM contracts WHERE proposal_id=?")
        .get(id);
      if (old) {
        if (old.funding_tx !== transactionHash)
          throw Error("Contract already funded by another receipt");
        return old;
      }
      if (!settlement?.verifyFunding)
        throw Error("Testnet funding verifier unavailable");
      const receipt = await settlement.verifyFunding({
        proposal: p,
        transactionHash,
        customer,
      });
      if (
        receipt.network !== "testnet" ||
        receipt.signer !== customer ||
        receipt.proposalId !== p.id ||
        receipt.agentId !== p.provider_id ||
        receipt.amount !== p.price ||
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
          "post_service_job",
          receipt.signer,
          String(receipt.blockHeight),
          now(),
        );
        db.prepare("INSERT INTO contracts VALUES(?,?,?, ?,?,NULL,NULL,?)").run(
          id,
          p.id,
          "FUNDED",
          receipt.hash,
          String(receipt.jobId),
          now(),
        );
        db.prepare("UPDATE proposals SET state='ACCEPTED' WHERE id=?").run(
          p.id,
        );
        enqueue(p.provider_id, "EXECUTE", id);
        store.event(
          p.provider_id,
          "CONTRACT_FUNDED",
          id,
          "Testnet escrow funding verified; professional execution queued.",
        );
        return requireContract(id, customer);
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
          "SELECT id,agent_id,filename,content_type,sha256,version,verified,created_at FROM deliverables WHERE contract_id=? ORDER BY rowid",
        )
        .all(id);
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
      if (c.state !== "REVIEW_READY") throw Error("Checked delivery required");
      if (!settlement?.prepareAcceptance)
        throw Error("Testnet acceptance adapter unavailable");
      return settlement.prepareAcceptance(c);
    },
    async confirmAcceptance(id, customer, transactionHash) {
      const c = requireContract(id, customer);
      if (c.state === "SETTLED") {
        if (c.settlement_tx !== transactionHash) throw Error("Already settled");
        return c;
      }
      if (c.state !== "REVIEW_READY" || !settlement?.verifyAcceptance)
        throw Error(
          "Checked delivery and verified testnet settlement required",
        );
      const receipt = await settlement.verifyAcceptance({
        contract: c,
        customer,
        transactionHash,
      });
      if (
        receipt.network !== "testnet" ||
        receipt.signer !== customer ||
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
