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
export async function createProfessionalApplication(options = {}) {
  const store =
    options.store ||
    openAgentStore({
      path: process.env.ECONIA_2_DATABASE_PATH || ".data/econia-2.sqlite",
    });
  const provider =
    options.provider ||
    new JsonRpcProvider({
      url: process.env.NEAR_TESTNET_RPC_URL || "https://rpc.testnet.near.org",
    });
  const contract = process.env.ECONIA_2_TESTNET_CONTRACT;
  if (contract && !contract.endsWith(".testnet"))
    throw Error("Econia 2.0 only accepts an explicit testnet contract");
  const resolveOwnership =
    options.resolveOwnership ||
    (contract
      ? async (agentId) => {
          const result = await provider.callFunction({
            contractId: contract,
            method: "nft_token",
            args: { token_id: agentId },
          });
          if (!result || result.token_id !== agentId) return null;
          return {
            ownerId: result.owner_id,
            reference: `${contract}:${agentId}:${result.owner_id}`,
            network: "testnet",
          };
        }
      : undefined);
  const runtime =
    options.runtime ||
    createProfessionalRuntime({
      store,
      resolveOwnership,
      settlement: options.settlement,
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
    const agents = store
      .agents()
      .map((a) => ({
        ...a,
        professionName: PROFESSIONS[a.profession].name,
        serviceCatalog: a.services.map((id) => ({ id, ...SERVICES[id] })),
        nft: contract
          ? {
              contract,
              tokenId: a.id,
              network: "testnet",
              status: "OWNERSHIP_CHECK_REQUIRED",
            }
          : { status: "NOT_DEPLOYED" },
        owner:
          store.db
            .prepare(
              "SELECT owner_id,verified_at FROM ownership WHERE agent_id=?",
            )
            .get(a.id) || null,
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
      settlementReady: Boolean(options.settlement),
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
        return json(res, 200, {
          mode: "econia-2",
          network: "testnet",
          inferenceReady: runtime.ready(),
          settlementReady: Boolean(options.settlement),
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
          /^\/api\/society\/contracts\/([-a-f0-9]{36})(\/artifacts|\/acceptance|\/confirm-acceptance|\/feedback)?$/,
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
  return {
    server,
    store,
    runtime,
    publicWorld,
    async close() {
      for (const p of peers) p.end();
      await new Promise((r) => server.close(r));
      await runtime.close();
      if (!options.store) store.close();
    },
  };
}
