import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
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
    stale: Boolean(issue),
    issue,
    intelligence: {
      mode: "near-ai",
      scope: "Planning only; no paid service executor is enabled",
      ready: Boolean(process.env.NEAR_AI_API_KEY),
    },
    plans: options.planner?.publicState() ?? {
      agents: {},
      issue: "Planning worker is not running",
    },
  });
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
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
      json(res, 503, { error: e.message });
    }
  });
  const timer = setInterval(() => refresh().catch(() => {}), 30000);
  timer.unref();
  options.planner?.start(() => snapshot);
  return {
    server,
    refresh,
    get world() {
      return publicState();
    },
    async close() {
      clearInterval(timer);
      options.planner?.stop();
      await new Promise((r) => server.close(r));
    },
  };
}
