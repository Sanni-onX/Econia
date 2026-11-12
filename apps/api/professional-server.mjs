import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { JsonRpcProvider } from "near-api-js";
import { openAgentStore } from "../../packages/agent-runtime/store.mjs";
import { createProfessionalRuntime } from "../../packages/agent-runtime/runtime.mjs";
import {
  SERVICES,
  PROFESSIONS,
} from "../../packages/agent-runtime/genesis.mjs";
import { createServiceAuth } from "../../packages/agent-sdk/service-auth.mjs";
import { createProfessionalTestnet } from "../../packages/near/professional-testnet.mjs";
import { createVerifiedLedger } from "../../packages/agent-runtime/ledger.mjs";
export async function createProfessionalApplication(options = {}) {
  const store =
    options.store ||
    openAgentStore({
      path: process.env.ECONIA_2_DATABASE_PATH || ".data/econia-2.sqlite",
    });
  const provider =
    options.provider ||
    new JsonRpcProvider(
      {
        url:
          process.env.NEAR_TESTNET_RPC_URL || "https://test.rpc.fastnear.com",
      },
      { retries: 3, wait: 500, backoff: 1.5 },
    );
  const contract = options.contract || process.env.ECONIA_2_TESTNET_CONTRACT;
  if (contract && !contract.endsWith(".testnet"))
    throw Error("Econia 2.0 only accepts an explicit testnet contract");
  const chain =
    options.settlement ||
    (contract
      ? await createProfessionalTestnet({
          contract,
          provider,
          operatorKey: process.env.ECONIA_2_OPERATOR_KEY,
        })
      : undefined);
  chain?.setOperationStore?.(store);
  let historyIndexing = false,
    historyIssue = null;
  async function refreshPublicHistory() {
    if (!chain?.readJobPage || historyIndexing) return;
    historyIndexing = true;
    try {
      const from =
        (store.db
          .prepare(
            "SELECT max(job_id) n FROM chain_job_observations WHERE contract_id=?",
          )
          .get(chain.contract).n ?? -1) + 1;
      const rows = await chain.readJobPage(from);
      const unsettled = store.db
        .prepare(
          "SELECT job_id FROM chain_job_observations WHERE contract_id=? AND state NOT IN ('SETTLED','REFUNDED') ORDER BY job_id LIMIT 8",
        )
        .all(chain.contract);
      for (const old of unsettled) {
        const page = await chain.readJobPage(old.job_id, 1);
        rows.push(...page);
      }
      for (const row of rows) {
        const j = row.job;
        if (
          !["FUNDED", "DELIVERED", "SETTLED", "REFUNDED"].includes(j.state) ||
          !Array.isArray(j.allocations) ||
          j.allocations.length > 8
        )
          throw Error("Unsupported onchain history record");
        for (const a of j.allocations)
          if (!store.professional(a.agent_id).services.includes(a.service_id))
            throw Error("Onchain history capability mismatch");
        store.transaction(() => {
          const prior = store.db
            .prepare(
              "SELECT state FROM chain_job_observations WHERE contract_id=? AND job_id=?",
            )
            .get(chain.contract, row.id);
          store.db
            .prepare(
              "INSERT INTO chain_job_observations VALUES(?,?,?,?,?,?) ON CONFLICT(contract_id,job_id) DO UPDATE SET state=excluded.state,public_json=excluded.public_json,block_hash=excluded.block_hash,observed_at=excluded.observed_at",
            )
            .run(
              chain.contract,
              row.id,
              j.state,
              JSON.stringify({
                state: j.state,
                buyerAgent: j.buyer_agent,
                providers: j.allocations.map((a) => ({
                  agentId: a.agent_id,
                  serviceId: a.service_id,
                  evidence: a.evidence,
                })),
              }),
              row.blockHash,
              store.now(),
            );
          if (j.state === "SETTLED" && prior?.state !== "SETTLED") {
            for (const id of new Set([
              ...j.allocations.map((a) => a.agent_id),
              ...(j.buyer_agent ? [j.buyer_agent] : []),
            ]))
              store.event(
                id,
                "ONCHAIN_WORK_COMPLETED",
                chain.contract + ":" + row.id,
                "Completed professional work and settlement were observed on finalized NEAR testnet.",
              );
          }
        });
      }
      historyIssue = null;
    } catch {
      historyIssue =
        "Finalized work-history indexing is temporarily unavailable";
    } finally {
      historyIndexing = false;
    }
  }
  let registry = null,
    chainIssue = null;
  async function refreshRegistry() {
    if (!chain?.readRegistry) return;
    try {
      registry = await chain.readRegistry(store.agents());
      chainIssue = null;
    } catch (e) {
      chainIssue = "Finalized testnet identity reconciliation is unavailable";
    }
  }
  await refreshRegistry();
  await refreshPublicHistory();
  const ledger = createVerifiedLedger(store);
  const resolveOwnership = options.resolveOwnership || chain?.resolveOwnership;
  const runtime =
    options.runtime ||
    createProfessionalRuntime({
      store,
      resolveOwnership,
      settlement: chain,
      verifyAgent: chain?.view
        ? (id) => chain.view("get_professional", { agent_id: id })
        : undefined,
      inference: options.inference,
    });
  const auth =
    options.auth || createServiceAuth({ network: "testnet", provider });
  const allowedOrigins = new Set(
    [
      ...(process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean),
      process.env.APP_ORIGIN,
      process.env.RAILWAY_PUBLIC_DOMAIN &&
        "https://" + process.env.RAILWAY_PUBLIC_DOMAIN,
    ].filter(Boolean),
  );
  const json = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };
  async function body(req) {
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (Buffer.byteLength(text) > 64000)
        throw Object.assign(Error("Request too large"), { status: 413 });
    }
    return JSON.parse(text || "{}");
  }
  const peers = new Set(),
    limits = new Map();
  function publicWorld() {
    const agents = store.agents().map((a) => ({
      ...a,
      professionName: PROFESSIONS[a.profession].name,
      publicHistory: store.db
        .prepare(
          "SELECT type,summary,created_at FROM world_events WHERE agent_id=? AND type IN ('PAYMENT_SETTLED','DELIVERABLE_SUBMITTED','PROJECT_COMPLETED','ONCHAIN_WORK_COMPLETED') ORDER BY sequence DESC LIMIT 6",
        )
        .all(a.id),
      serviceCatalog: a.services.map((id) => ({ id, ...SERVICES[id] })),
      nft: contract
        ? {
            contract,
            tokenId: a.id,
            network: "testnet",
            status:
              registry && !chainIssue ? "VERIFIED" : "OWNERSHIP_CHECK_REQUIRED",
          }
        : { status: "NOT_DEPLOYED" },
      owner: registry?.identities.find((x) => x.id === a.id)
        ? {
            owner_id: registry.identities.find((x) => x.id === a.id).ownerId,
            verified_at: registry.verifiedAt,
          }
        : null,
    }));
    return {
      network: "testnet",
      generation: "genesis-2",
      agents,
      places: agents.map((a) => ({
        id: "workplace:" + a.id,
        name: a.workplace,
        agentId: a.id,
        district: a.district,
        profession: a.profession,
      })),
      inferenceReady: runtime.ready(),
      settlementReady: Boolean(chain?.ready && !chainIssue),
      chainIssue,
      historyIssue,
      contract: contract || null,
      events: store.db
        .prepare(
          "SELECT sequence,agent_id,type,reference_id,summary,created_at FROM world_events ORDER BY sequence DESC LIMIT 40",
        )
        .all(),
    };
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/api/config")
        return json(res, 200, { mode: "professional", network: "testnet" });
      if (url.pathname === "/api/health")
        return json(res, chainIssue ? 503 : 200, {
          mode: "econia-2",
          revision: process.env.RAILWAY_GIT_COMMIT_SHA || null,
          network: "testnet",
          inferenceReady: runtime.ready(),
          settlementReady: Boolean(chain?.ready && !chainIssue),
        });
      if (url.pathname === "/api/society/world" && req.method === "GET")
        return json(res, 200, publicWorld());
      if (url.pathname === "/api/society/events" && req.method === "GET") {
        const origin = req.headers.origin;
        if (
          origin &&
          !allowedOrigins.has(origin) &&
          !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        )
          return json(res, 403, { error: "Origin not allowed" });
        if (peers.size >= 50)
          return json(res, 429, { error: "Live connection limit reached" });
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        let cursor = Number(
          req.headers["last-event-id"] || url.searchParams.get("after") || 0,
        );
        if (!Number.isSafeInteger(cursor) || cursor < 0) cursor = 0;
        peers.add(res);
        const emit = () => {
          for (const e of store.db
            .prepare(
              "SELECT sequence,agent_id,type,reference_id,summary,created_at FROM world_events WHERE sequence>? ORDER BY sequence LIMIT 100",
            )
            .all(cursor)) {
            res.write(
              `id: ${e.sequence}\nevent: world\ndata: ${JSON.stringify(e)}\n\n`,
            );
            cursor = e.sequence;
          }
        };
        emit();
        res.write(": connected\n\n");
        const timer = setInterval(() => {
          emit();
          res.write(": heartbeat\n\n");
        }, 1500);
        timer.unref();
        req.on("close", () => {
          clearInterval(timer);
          peers.delete(res);
        });
        return;
      }
      if (url.pathname.startsWith("/api/society/")) {
        if (chainIssue && req.method !== "GET")
          return json(res, 503, { error: chainIssue });
        if (req.method !== "GET") {
          const origin = req.headers.origin;
          if (
            origin &&
            !allowedOrigins.has(origin) &&
            !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
          )
            return json(res, 403, { error: "Origin not allowed" });
          const key = req.socket.remoteAddress,
            bucket = limits.get(key),
            now = Date.now();
          if (!bucket || now - bucket.at > 60000)
            limits.set(key, { at: now, n: 1 });
          else if (++bucket.n > 40)
            return json(res, 429, { error: "Too many requests" });
        }
        if (
          url.pathname === "/api/society/auth/challenge" &&
          req.method === "POST"
        )
          return json(res, 200, auth.challenge((await body(req)).accountId));
        if (url.pathname === "/api/society/auth/login" && req.method === "POST")
          return json(res, 200, await auth.login(await body(req)));
        const customer = auth.require(req.headers.authorization);
        const ownerRoute = url.pathname.match(
          /^\/api\/society\/agents\/([a-zA-Z0-9_-]{1,64})\/(owner|capital|confirm-capital|budget|confirm-budget|transfer|confirm-transfer)$/,
        );
        if (ownerRoute) {
          const id = ownerRoute[1],
            action = ownerRoute[2];
          if (!chain || chainIssue)
            throw Object.assign(
              Error("Verified testnet infrastructure is unavailable"),
              { status: 503 },
            );
          if (action !== "confirm-transfer")
            await runtime.ownership.requireOwner(id, customer);
          if (action === "owner" && req.method === "GET")
            return json(res, 200, {
              professional: await chain.view("get_professional", {
                agent_id: id,
              }),
              policy: await chain.view("get_policy", { agent_id: id }),
              ledger: ledger.history("agent:" + id),
              strategy: runtime.memory.strategy(id, customer),
            });
          if (req.method === "POST") {
            const b = await body(req);
            if (action === "capital")
              return json(res, 200, chain.prepareCapital(id, b.amount));
            if (action === "budget")
              return json(res, 200, await chain.prepareBudget(id, b));
            if (action === "transfer")
              return json(
                res,
                200,
                await chain.prepareTransfer(id, b.receiver),
              );
            if (action === "confirm-capital" || action === "confirm-budget") {
              const receipt =
                action === "confirm-capital"
                  ? await chain.verifyCapital({
                      agentId: id,
                      customer,
                      transactionHash: b.transactionHash,
                    })
                  : await chain.verifyBudget({
                      agentId: id,
                      customer,
                      transactionHash: b.transactionHash,
                    });
              store.transaction(() => {
                const prior = store.db
                  .prepare("SELECT tx_hash FROM receipts WHERE tx_hash=?")
                  .get(receipt.hash);
                if (!prior) {
                  store.db
                    .prepare("INSERT INTO receipts VALUES(?,?,?,?,?,?,?)")
                    .run(
                      receipt.hash,
                      "testnet",
                      receipt.contract,
                      receipt.method,
                      receipt.signer,
                      String(receipt.blockHeight),
                      store.now(),
                    );
                  if (action === "confirm-capital")
                    ledger.record({
                      receiptHash: receipt.hash,
                      debit: "wallet:" + customer,
                      credit: "agent:" + id,
                      amount: receipt.amount,
                    });
                  store.event(
                    id,
                    action === "confirm-capital"
                      ? "AGENT_RECEIVED_FUNDING"
                      : "OWNER_AUTHORIZED_BUDGET",
                    receipt.hash,
                    action === "confirm-capital"
                      ? "Owner-provided testnet working capital was verified."
                      : "The current owner approved an enforceable testnet operating budget.",
                  );
                }
              });
              if (action === "confirm-budget")
                runtime.ownerBudgetEvent({
                  agentId: id,
                  ownerId: customer,
                  receiptHash: receipt.hash,
                });
              await refreshRegistry();
              return json(res, 200, {
                verified: true,
                transactionHash: receipt.hash,
              });
            }
            if (action === "confirm-transfer") {
              const receipt = await chain.receipt(
                b.transactionHash,
                customer,
                "nft_transfer",
              );
              if (receipt.args.token_id !== id)
                throw Error("Transfer receipt identity mismatch");
              const current = await runtime.ownership.observe(id);
              await refreshRegistry();
              return json(res, 200, { verified: true, owner: current.ownerId });
            }
          }
        }
        if (
          url.pathname === "/api/society/auth/logout" &&
          req.method === "POST"
        ) {
          auth.logout(req.headers.authorization);
          return json(res, 200, { ok: true });
        }
        if (url.pathname === "/api/society/conversations") {
          if (req.method === "GET")
            return json(res, 200, await runtime.conversations.list(customer));
          if (req.method === "POST") {
            const b = await body(req);
            return json(
              res,
              201,
              await runtime.conversations.open(b.agentId, customer, b.kind),
            );
          }
        }
        const conversation = url.pathname.match(
          /^\/api\/society\/conversations\/([-a-f0-9]{36})(\/messages)?$/,
        );
        if (conversation) {
          if (req.method === "GET" && !conversation[2])
            return json(res, 200, {
              conversation: await runtime.conversations.require(
                conversation[1],
                customer,
              ),
              messages: await runtime.conversations.messages(
                conversation[1],
                customer,
              ),
              proposals: runtime.contracts
                .list(customer)
                .filter((p) => p.conversation_id === conversation[1]),
              jobs: store.db
                .prepare(
                  "SELECT j.id,j.state,j.error FROM runtime_jobs j JOIN messages m ON m.id=j.reference_id WHERE m.conversation_id=?",
                )
                .all(conversation[1]),
            });
          if (req.method === "POST" && conversation[2])
            return json(
              res,
              202,
              await runtime.conversations.send(
                conversation[1],
                customer,
                await body(req),
              ),
            );
        }
        if (url.pathname === "/api/society/proposals" && req.method === "GET")
          return json(res, 200, runtime.contracts.list(customer));
        const peerClarification = url.pathname.match(
          /^\/api\/society\/agent-threads\/([-a-f0-9]{36})\/clarify$/,
        );
        if (peerClarification && req.method === "POST")
          return json(res, 202, {
            id: runtime.collaboration.clarify(
              peerClarification[1],
              customer,
              (await body(req)).content,
            ),
          });
        const proposal = url.pathname.match(
          /^\/api\/society\/proposals\/([-a-f0-9]{36})(\/funding|\/confirm-funding|\/collaboration)$/,
        );
        if (proposal) {
          const p = runtime.contracts.requireProposal(proposal[1], customer);
          if (proposal[2] === "/funding" && req.method === "POST")
            return json(
              res,
              200,
              runtime.contracts.fundingRequest(p.id, customer),
            );
          if (proposal[2] === "/confirm-funding" && req.method === "POST")
            return json(
              res,
              200,
              await runtime.contracts.confirmFunding(
                p.id,
                customer,
                (await body(req)).transactionHash,
              ),
            );
          if (proposal[2] === "/collaboration" && req.method === "GET")
            return json(
              res,
              200,
              store.db
                .prepare(
                  "SELECT t.id,t.buyer_agent,t.provider_agent,t.service_id,t.state,m.sender,m.recipient,m.type,m.content FROM agent_threads t JOIN agent_messages m ON m.thread_id=t.id WHERE t.parent_proposal=? ORDER BY m.rowid",
                )
                .all(p.id),
            );
        }
        const contractRoute = url.pathname.match(
          /^\/api\/society\/contracts\/([-a-f0-9]{36})(\/artifacts|\/acceptance|\/confirm-acceptance|\/feedback|\/revision)?$/,
        );
        if (contractRoute) {
          const c = runtime.contracts.requireContract(
            contractRoute[1],
            customer,
          );
          if (!contractRoute[2] && req.method === "GET")
            return json(res, 200, c);
          if (contractRoute[2] === "/artifacts" && req.method === "GET")
            return json(res, 200, runtime.contracts.artifacts(c.id, customer));
          if (contractRoute[2] === "/acceptance" && req.method === "POST")
            return json(
              res,
              200,
              await runtime.contracts.acceptanceRequest(c.id, customer),
            );
          if (
            contractRoute[2] === "/confirm-acceptance" &&
            req.method === "POST"
          )
            return json(
              res,
              200,
              await runtime.contracts.confirmAcceptance(
                c.id,
                customer,
                (await body(req)).transactionHash,
              ),
            );
          if (contractRoute[2] === "/revision" && req.method === "POST")
            return json(
              res,
              202,
              await runtime.contracts.requestRevision(
                c.id,
                customer,
                (await body(req)).feedback,
              ),
            );
          if (contractRoute[2] === "/feedback" && req.method === "POST")
            return json(
              res,
              201,
              runtime.contracts.evaluate(c.id, customer, await body(req)),
            );
        }
        const artifact = url.pathname.match(
          /^\/api\/society\/artifacts\/([-a-f0-9]{36})$/,
        );
        if (artifact && req.method === "GET") {
          const f = runtime.contracts.artifact(artifact[1], customer);
          res.writeHead(200, {
            "Content-Type": f.content_type,
            "Content-Disposition": `attachment; filename="${f.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
            "Content-Security-Policy":
              "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
          });
          res.end(f.content);
          return;
        }
        return json(res, 404, { error: "Unknown society route" });
      }
      if (url.pathname.startsWith("/api/"))
        return json(res, 404, { error: "Unknown API route" });
      if (!["GET", "HEAD"].includes(req.method))
        return json(res, 405, { error: "Method not allowed" });
      const root = resolve("apps/web/dist");
      let file = resolve(root, "." + decodeURIComponent(url.pathname));
      if (file !== root && !file.startsWith(root + sep))
        return json(res, 403, { error: "Forbidden" });
      try {
        if (!(await stat(file)).isFile()) file = resolve(root, "index.html");
      } catch {
        file = resolve(root, "index.html");
      }
      const content = await readFile(file);
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".glb": "model/gltf-binary",
          }[extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (e) {
      json(res, e.status || 400, { error: String(e.message).slice(0, 1000) });
    }
  });
  runtime.start();
  const registryTimer = setInterval(async () => {
    await refreshRegistry();
    await refreshPublicHistory();
  }, 30000);
  registryTimer.unref();
  return {
    server,
    store,
    runtime,
    publicWorld,
    async close() {
      clearInterval(registryTimer);
      for (const p of peers) p.end();
      await new Promise((r) => server.close(r));
      await runtime.close();
      if (!options.store) store.close();
    },
  };
}
