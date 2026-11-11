import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { JsonRpcProvider } from "near-api-js";
import { createServiceAuth } from "../../packages/agent-sdk/service-auth.mjs";
import { createServiceWorkforce } from "../../packages/agent-sdk/service-workforce.mjs";
import { SERVICE_CATALOG } from "../../packages/agent-sdk/service-tools.mjs";
import { readNativeState } from "../../packages/shared/native-state.mjs";
import {
  operatingCapitalTransaction,
  nativeTransaction,
} from "../../packages/shared/native-near.mjs";

export async function createNativeApplication(options = {}) {
  const roster =
    options.roster ??
    JSON.parse(
      await readFile(new URL("../../docs/agent-roster.json", import.meta.url)),
    ).agents;
  const rpc =
    options.rpc ??
    (async (method, params) => {
      const r = await fetch(
        process.env.NEAR_MAINNET_RPC_URL || "https://free.rpc.fastnear.com",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "econia",
            method,
            params,
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!r.ok) throw Error("Mainnet RPC unavailable");
      const j = await r.json();
      if (j.error) throw Error("Mainnet read failed");
      return j.result;
    });
  let snapshot, pending, issue;
  const refresh = () =>
    (pending ??= (async () => {
      try {
        snapshot = await readNativeState({ rpc, roster });
        issue = null;
      } catch (e) {
        issue = e.message;
        if (!snapshot) throw e;
      } finally {
        pending = null;
      }
      return snapshot;
    })());
  await refresh();
  const callAt = async (method_name, args, block_id) => {
    const value = await rpc("query", {
      request_type: "call_function",
      account_id: snapshot.contract,
      block_id,
      method_name,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    return JSON.parse(Buffer.from(value.result).toString());
  };
  const workforce =
    options.workforce ??
    (options.services
      ? createServiceWorkforce({
          path: options.serviceDatabasePath,
          resolveAgent: async (agentId) => {
            const b = await rpc("block", { finality: "final" }),
              id = b.header.hash;
            const token = await callAt("nft_token", { token_id: agentId }, id),
              state = await callAt("get_agent", { agent_id: agentId }, id);
            return token && state
              ? { ownerId: token.owner_id, paused: state.paused }
              : null;
          },
        })
      : null);
  const auth =
    options.serviceAuth ??
    createServiceAuth({
      provider: new JsonRpcProvider({
        url:
          process.env.NEAR_MAINNET_RPC_URL || "https://free.rpc.fastnear.com",
      }),
    });
  const allowedOrigins = new Set(
    (
      process.env.ALLOWED_ORIGINS ||
      process.env.APP_ORIGIN ||
      (process.env.RAILWAY_PUBLIC_DOMAIN
        ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN
        : "")
    )
      .split(",")
      .filter(Boolean),
  );
  const limits = new Map();
  async function readBody(req) {
    let body = "";
    for await (const part of req) {
      body += part;
      if (Buffer.byteLength(body) > 70000)
        throw Object.assign(Error("Request too large"), { status: 413 });
    }
    try {
      return JSON.parse(body || "{}");
    } catch {
      throw Error("Invalid JSON request");
    }
  }
  const root = resolve(options.webRoot ?? "apps/web/dist");
  const json = (res, status, value) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  const publicState = () => ({
    ...snapshot,
    agents: workforce ? workforce.publicWorkers(snapshot) : snapshot.agents,
    services: workforce
      ? { ...workforce.status(), catalog: SERVICE_CATALOG }
      : null,
    stale: Boolean(issue),
    issue,
    intelligence: {
      mode: workforce ? "task-driven" : "idle",
      scope: workforce
        ? "Real service tools run on authenticated task requests; virtual-role planning retired"
        : "Awaiting a verified real-service workflow; virtual-role planning retired",
      ready: workforce?.status().ready ?? false,
    },
    plans: options.planner?.publicState() ?? {
      agents: {},
      issue: null,
      enabled: false,
      dailyLimit: 0,
      status: "Idle; no AI credits consumed by this worker",
    },
  });
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/services/")) {
        if (!workforce)
          return json(res, 404, { error: "Service workspace is unavailable" });
        if (req.method !== "GET") {
          const origin = req.headers.origin;
          if (
            origin &&
            !allowedOrigins.has(origin) &&
            !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)
          )
            return json(res, 403, { error: "Origin not allowed" });
          const key = req.socket.remoteAddress,
            now = Date.now(),
            bucket = limits.get(key);
          if (!bucket || now - bucket.at > 60000)
            limits.set(key, { at: now, n: 1 });
          else if (++bucket.n > 40)
            return json(res, 429, { error: "Too many workspace requests" });
        }
        if (url.pathname === "/api/services/challenge" && req.method === "POST")
          return json(
            res,
            200,
            auth.challenge((await readBody(req)).accountId),
          );
        if (url.pathname === "/api/services/login" && req.method === "POST")
          return json(res, 200, await auth.login(await readBody(req)));
        const account = auth.require(req.headers.authorization);
        if (url.pathname === "/api/services/logout" && req.method === "POST") {
          auth.logout(req.headers.authorization);
          return json(res, 200, { ok: true });
        }
        if (url.pathname === "/api/services/tasks" && req.method === "GET")
          return json(res, 200, workforce.list(account));
        if (url.pathname === "/api/services/tasks" && req.method === "POST")
          return json(
            res,
            202,
            await workforce.submit(account, await readBody(req)),
          );
        if (url.pathname === "/api/services/missions" && req.method === "GET")
          return json(res, 200, workforce.missions.list(account));
        if (url.pathname === "/api/services/missions" && req.method === "POST")
          return json(
            res,
            202,
            await workforce.missions.submit(account, await readBody(req)),
          );
        const missionMatch = url.pathname.match(
          /^\/api\/services\/missions\/([a-f0-9-]{36})(\/accept|\/artifact|\/stop-watch)?$/,
        );
        if (missionMatch) {
          const m = workforce.missions.get(account, missionMatch[1]);
          if (missionMatch[2] === "/accept" && req.method === "POST")
            return json(res, 200, workforce.missions.accept(account, m.id));
          if (missionMatch[2] === "/stop-watch" && req.method === "POST")
            return json(res, 200, workforce.missions.stopWatch(account, m.id));
          if (missionMatch[2] === "/artifact" && req.method === "GET") {
            if (
              !m.output ||
              !["REVIEW_READY", "ACCEPTED_TRIAL"].includes(m.status)
            )
              throw Error("A checked team report is not ready");
            res.writeHead(200, {
              "Content-Type": "text/markdown; charset=utf-8",
              "Content-Disposition": `attachment; filename="econia-team-${m.id}.md"`,
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            });
            return res.end(m.output.artifact);
          }
          if (!missionMatch[2] && req.method === "GET")
            return json(res, 200, {
              ...m,
              tasks: workforce.missions.children(account, m.id),
            });
        }
        if (url.pathname === "/api/services/profile" && req.method === "PUT")
          return json(
            res,
            200,
            await workforce.configure(account, await readBody(req)),
          );
        const match = url.pathname.match(
          /^\/api\/services\/tasks\/([a-f0-9-]{36})(\/accept|\/artifact)?$/,
        );
        if (match) {
          const t = workforce.task(account, match[1]);
          if (match[2] === "/accept" && req.method === "POST")
            return json(res, 200, workforce.accept(account, t.id));
          if (match[2] === "/artifact" && req.method === "GET") {
            if (
              !t.output ||
              !["REVIEW_READY", "ACCEPTED_TRIAL"].includes(t.status)
            )
              throw Error("No checked artifact is available");
            res.writeHead(200, {
              "Content-Type": "text/markdown; charset=utf-8",
              "Content-Disposition": `attachment; filename="econia-${t.id}.md"`,
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            });
            return res.end(t.output.artifact);
          }
          if (!match[2] && req.method === "GET") return json(res, 200, t);
        }
        return json(res, 404, { error: "Service route not found" });
      }
      if (url.pathname === "/api/config")
        return json(res, 200, { mode: "mainnet", asset: "NEAR" });
      if (url.pathname === "/api/health")
        return json(res, issue ? 503 : 200, {
          mode: "mainnet",
          asset: "NEAR",
          stale: Boolean(issue),
          verifiedAt: snapshot.verifiedAt,
        });
      if (url.pathname === "/api/native/world" && req.method === "GET")
        return json(res, 200, publicState());
      if (url.pathname === "/api/native/transfer" && req.method === "GET") {
        if (issue || Date.now() - Date.parse(snapshot.verifiedAt) > 120000)
          throw Error("Fresh mainnet verification required");
        const agent = snapshot.agents.find(
            (a) => a.id === url.searchParams.get("agent"),
          ),
          receiver = url.searchParams.get("receiver");
        if (
          !agent?.token ||
          !receiver ||
          !(
            /^[a-f0-9]{64}$/.test(receiver) ||
            /^[a-z0-9._-]+\.near$/.test(receiver)
          ) ||
          receiver.length > 64
        )
          throw Error("Choose an existing mainnet NEAR account");
        await rpc("query", {
          request_type: "view_account",
          finality: "final",
          account_id: receiver,
        });
        return json(
          res,
          200,
          nativeTransaction({
            network: "mainnet",
            contract: snapshot.contract,
            method: "nft_transfer",
            args: {
              receiver_id: receiver,
              token_id: agent.id,
              memo: "Agent identity and treasury control transfer together",
            },
            deposit: "0.000000000000000000000001",
          }),
        );
      }
      if (url.pathname === "/api/native/capital" && req.method === "GET") {
        if (issue || Date.now() - Date.parse(snapshot.verifiedAt) > 120000)
          throw Error("Fresh mainnet verification required");
        const agent = snapshot.agents.find(
          (a) => a.id === url.searchParams.get("agent"),
        );
        if (!agent?.token || agent.paused || snapshot.custody.paused)
          throw Error(
            "Agent capital is not open while paused or uncommissioned",
          );
        return json(
          res,
          200,
          operatingCapitalTransaction(
            { network: "mainnet", contract: snapshot.contract },
            agent.id,
            url.searchParams.get("amount"),
          ),
        );
      }
      if (url.pathname.startsWith("/api/"))
        return json(res, 404, {
          error: "This action is unavailable in the native NEAR release",
        });
      if (req.method !== "GET" && req.method !== "HEAD")
        return json(res, 405, { error: "Method not allowed" });
      let file = resolve(root, "." + decodeURIComponent(url.pathname));
      if (file !== root && !file.startsWith(root + sep))
        return json(res, 403, { error: "Forbidden" });
      try {
        if (!(await stat(file)).isFile()) file = resolve(root, "index.html");
      } catch {
        file = resolve(root, "index.html");
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".glb": "model/gltf-binary",
          }[extname(file)] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch (e) {
      json(res, e.status || 503, { error: e.message });
    }
  });
  const timer = setInterval(() => refresh().catch(() => {}), 30000);
  timer.unref();
  options.planner?.start(() => snapshot);
  workforce?.start();
  return {
    server,
    refresh,
    get world() {
      return publicState();
    },
    async close() {
      clearInterval(timer);
      options.planner?.stop();
      await workforce?.close();
      await new Promise((r) => server.close(r));
    },
  };
}
