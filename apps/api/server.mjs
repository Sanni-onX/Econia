import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  genesis,
  tick,
  view,
  triggerEvent,
  sponsorSandbox,
  assertInvariants,
  emit,
  catalog,
} from "../../packages/simulation-core/index.mjs";
import { openRepository } from "../../packages/database/index.mjs";
import {
  listSandbox,
  buySandbox,
  offerSandbox,
} from "../../packages/economy/marketplace.mjs";
export async function createApplication(options = {}) {
  const mode = process.env.SETTLEMENT_MODE || "sandbox";
  if (!["sandbox", "testnet"].includes(mode))
    throw new Error("Unsupported settlement mode");
  const repo = options.repository || (await openRepository());
  let world = await repo.load();
  if (!world && mode === "testnet")
    throw new Error(
      "A funded testnet genesis is required. Refusing database-only ECO.",
    );
  world ||= genesis(
    process.env.WORLD_SEED,
    Number(process.env.POPULATION || 64),
  );
  if (world.mode !== mode)
    throw new Error(
      "World and settlement modes differ. Use a separate testnet database.",
    );
  const runtime =
    options.runtime ??
    (mode === "testnet"
      ? await (
          await import("../../packages/shared/chain-runtime.mjs")
        ).createChainRuntime(repo, world.chain)
      : null);
  let settlementDelayed = false;
  if (runtime) {
    try {
      world = await runtime.recover(world);
    } catch (error) {
      if (!(await repo.loadStage())) throw error;
      settlementDelayed = true;
      console.error(
        JSON.stringify({
          level: "error",
          message:
            "Pending settlement delayed; serving the last confirmed checkpoint",
          error: error.message,
        }),
      );
    }
    const report = await runtime.reconcile(world);
    if (!settlementDelayed && !report.balanced)
      throw new Error(
        "Onchain reconciliation failed: " + JSON.stringify(report),
      );
  }
  await repo.save(world);
  const adminToken =
    options.adminToken ||
    process.env.ADMIN_TOKEN ||
    randomBytes(24).toString("hex");
  if (!options.quiet && process.env.NODE_ENV !== "production")
    console.log(
      JSON.stringify({
        level: "info",
        message: "Local development admin token",
        adminToken,
        storage: repo.kind,
      }),
    );
  const publicWorld = () => ({ ...view(world), settlementDelayed });
  let busy = false,
    intervalMs = Number(process.env.SIMULATION_INTERVAL_MS || 5000),
    timer;
  const clients = new Set(),
    limits = new Map(),
    challenges = new Map();
  const allowedOrigins = new Set(
    (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean),
  );
  const broadcast = () => {
    const data = `data: ${JSON.stringify(publicWorld())}\n\n`;
    for (const client of clients) client.write(data);
  };
  async function mutate(fn) {
    if (busy)
      throw Object.assign(new Error("World is settling; retry shortly"), {
        status: 409,
      });
    busy = true;
    const before = structuredClone(world);
    try {
      if (runtime && (await repo.loadStage()))
        throw Object.assign(
          new Error("A pending onchain cycle must finish settling first"),
          { status: 409 },
        );
      const result = await fn();
      assertInvariants(world);
      await repo.save(world);
      broadcast();
      return result;
    } catch (error) {
      world = before;
      throw error;
    } finally {
      busy = false;
    }
  }
  async function advance(count = 1) {
    if (runtime) {
      if (busy) throw new Error("Settlement is already in progress");
      busy = true;
      try {
        world = await runtime.advance(world, count);
        settlementDelayed = false;
        broadcast();
      } catch (error) {
        world = await repo.load();
        settlementDelayed = true;
        broadcast();
        throw error;
      } finally {
        busy = false;
      }
      return;
    }
    return mutate(() => {
      for (let i = 0; i < count; i++) tick(world);
    });
  }
  const schedule = () => {
    clearInterval(timer);
    timer = setInterval(() => {
      if (!world.paused && !busy)
        advance().catch((error) =>
          console.error(
            JSON.stringify({
              level: "error",
              cycle: world.cycle,
              error: error.message,
            }),
          ),
        );
    }, intervalMs);
    timer.unref();
  };
  if (options.autoTick !== false) schedule();
  const json = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };
  const readBody = async (req) => {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16384)
        throw Object.assign(new Error("Body too large"), { status: 413 });
    }
    try {
      return JSON.parse(body || "{}");
    } catch {
      throw new Error("Invalid JSON");
    }
  };
  const isAdmin = (req) => {
    const supplied = Buffer.from(
        (req.headers.authorization || "").replace(/^Bearer /, ""),
      ),
      expected = Buffer.from(adminToken);
    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost"),
        path = url.pathname;
      if (req.method !== "GET") {
        if (
          req.headers.origin &&
          !allowedOrigins.has(req.headers.origin) &&
          !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin)
        )
          return json(res, 403, { error: "Origin not allowed" });
        const ip = req.socket.remoteAddress,
          now = Date.now(),
          bucket = limits.get(ip) || { start: now, count: 0 };
        if (now - bucket.start > 60000) {
          bucket.start = now;
          bucket.count = 0;
        }
        bucket.count++;
        limits.set(ip, bucket);
        if (bucket.count > 60)
          return json(res, 429, { error: "Too many requests" });
      }
      if (path === "/api/health")
        return json(res, 200, {
          status: settlementDelayed ? "settlement_delayed" : "ok",
          cycle: world.cycle,
          storage: repo.kind,
          mode: world.mode,
          invariants: assertInvariants(world),
        });
      if (path === "/api/world" && req.method === "GET")
        return json(res, 200, publicWorld());
      if (path === "/api/config")
        return json(res, 200, {
          mode,
          network: "testnet",
          ecoContract: world.chain?.eco || process.env.ECO_CONTRACT || null,
          worldContract:
            world.chain?.world || process.env.WORLD_CONTRACT || null,
          chainEnabled: Boolean(runtime),
          storage: repo.kind,
        });
      if (path === "/api/events" && req.method === "GET") {
        if (clients.size >= 30)
          return json(res, 503, { error: "Live connection limit" });
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(`data: ${JSON.stringify(publicWorld())}\n\n`);
        clients.add(res);
        const heartbeat = setInterval(
          () => res.write(": heartbeat\n\n"),
          20000,
        );
        req.on("close", () => {
          clients.delete(res);
          clearInterval(heartbeat);
        });
        return;
      }
      if (path === "/api/token/prepare" && req.method === "POST") {
        if (!runtime) throw new Error("Testnet is not enabled");
        const body = await readBody(req);
        return json(res, 200, { transactions: await runtime.prepare(body) });
      }
      if (path === "/api/token/balance" && req.method === "GET") {
        if (!runtime) throw new Error("Testnet is not enabled");
        const account = url.searchParams.get("account");
        if (!/^[a-z0-9_.-]{2,64}$/.test(account || ""))
          throw new Error("Invalid account");
        return json(res, 200, {
          amount: await runtime.adapter.view(world.chain.eco, "ft_balance_of", {
            account_id: account,
          }),
          escrowCredit: await runtime.adapter.view(
            world.chain.world,
            "wallet_balance",
            { account_id: account },
          ),
        });
      }
      if (path === "/api/auth/challenge" && req.method === "POST") {
        if (!runtime) throw new Error("Wallet proofs apply to testnet mode");
        const body = await readBody(req);
        if (!world.entities[body.entityId]) throw new Error("Unknown entity");
        for (const [k, c] of challenges)
          if (c.expires < Date.now()) challenges.delete(k);
        if (challenges.size > 1000) throw new Error("Challenge limit");
        const challenge = {
          id: randomBytes(16).toString("hex"),
          nonce: randomBytes(32).toString("base64"),
          recipient: process.env.AUTH_RECIPIENT || "econia.local",
          message: `Econia policy for ${body.entityId}: ${JSON.stringify(body.policy)}`,
          entityId: body.entityId,
          expires: Date.now() + 300000,
        };
        challenges.set(challenge.id, challenge);
        return json(res, 200, challenge);
      }
      if (path === "/api/chronicle" && req.method === "GET")
        return json(
          res,
          200,
          repo.chronicle ? await repo.chronicle() : view(world).chronicle,
        );
      const entityMatch = path.match(
        /^\/api\/entities\/([^/]+)(?:\/(history|decisions|sponsor|policy))?$/,
      );
      if (entityMatch) {
        const [, id, action] = entityMatch,
          e = world.entities[id];
        if (!e) return json(res, 404, { error: "Entity not found" });
        if (req.method === "GET") {
          if (action === "history" || action === "decisions")
            return json(
              res,
              200,
              await repo.history(
                id,
                action,
                url.searchParams.get("important") === "1",
              ),
            );
          return json(
            res,
            200,
            view(world).entities.find((x) => x.id === id),
          );
        }
        const body = await readBody(req);
        if (action === "sponsor" && req.method === "POST") {
          if (runtime) {
            await mutate(() =>
              runtime.sponsor(world, id, body.hash, body.sender),
            );
            return json(res, 200, {
              ok: true,
              mode: "testnet",
              hash: body.hash,
            });
          }
          await mutate(() =>
            sponsorSandbox(
              world,
              id,
              body.amount,
              req.headers["idempotency-key"],
            ),
          );
          return json(res, 200, { ok: true, mode: "sandbox", hash: null });
        }
        if (action === "policy" && req.method === "PUT") {
          if (!runtime && e.owner !== "demo.local")
            return json(res, 403, {
              error: "Only local demo-owned entities can be configured",
            });
          if (
            !["LOW", "MEDIUM", "HIGH"].includes(body.risk) ||
            !["CONSERVATIVE", "BALANCED", "AGGRESSIVE"].includes(body.growth) ||
            !Number.isSafeInteger(body.reserve) ||
            body.reserve < 0 ||
            body.reserve > 500000 ||
            typeof body.mayCreate !== "boolean" ||
            typeof body.mayInvest !== "boolean"
          )
            return json(res, 400, { error: "Invalid policy" });
          if (runtime) {
            const challenge = challenges.get(body.proof?.challengeId);
            if (
              !challenge ||
              challenge.expires < Date.now() ||
              challenge.entityId !== id ||
              challenge.message !==
                `Econia policy for ${id}: ${JSON.stringify(body.policyPayload)}`
            )
              throw new Error("Valid policy challenge required");
            for (const key of [
              "risk",
              "growth",
              "reserve",
              "mayCreate",
              "mayInvest",
            ])
              if (body[key] !== body.policyPayload[key])
                throw new Error("Signed policy differs from request");
            challenges.delete(challenge.id);
            await runtime.verifyPolicy(challenge, body.proof, world);
          }
          await mutate(() => {
            Object.assign(world.entities[id].policy, {
              risk: body.risk,
              growth: body.growth,
              reserve: body.reserve,
              mayCreate: body.mayCreate,
              mayInvest: body.mayInvest,
            });
            emit(
              world,
              "POLICY_UPDATED",
              id,
              `${e.name} receives new strategy constraints`,
              runtime
                ? "Updated with an NFT owner wallet proof."
                : "Updated by the local demo owner.",
            );
          });
          return json(res, 200, { ok: true });
        }
      }
      if (path === "/api/marketplace" && req.method === "POST") {
        const body = await readBody(req),
          key = req.headers["idempotency-key"];
        if (runtime) {
          await mutate(() => runtime.market(world, body.hash, body.sender));
          return json(res, 200, { ok: true });
        }
        if (typeof key !== "string" || key.length < 8 || key.length > 128)
          throw new Error("Idempotency key required");
        const result = await mutate(() => {
          if (body.action === "LIST")
            return listSandbox(world, body.entityId, body.amount);
          if (body.action === "BUY")
            return buySandbox(world, body.listingId, key);
          if (body.action === "OFFER")
            return offerSandbox(world, body.listingId, body.amount, key);
          throw new Error("Unknown marketplace action");
        });
        return json(res, 200, { ok: true, result });
      }
      if (path.startsWith("/api/admin/")) {
        if (!isAdmin(req))
          return json(res, 403, { error: "Development admin token required" });
        const body = await readBody(req);
        if (path.endsWith("/reconcile") && req.method === "POST") {
          if (!runtime) throw new Error("Testnet not enabled");
          const report = await mutate(() => runtime.reconcile(world));
          return json(res, report.balanced ? 200 : 409, report);
        }
        if (path.endsWith("/tick") && req.method === "POST") {
          if (
            !Number.isInteger(body.count) ||
            body.count < 1 ||
            body.count > 100
          )
            return json(res, 400, { error: "Count must be 1–100" });
          await advance(body.count);
        } else if (path.endsWith("/control") && req.method === "POST") {
          await mutate(() => {
            if (typeof body.paused === "boolean") world.paused = body.paused;
            if (body.speed !== undefined) {
              if (![1000, 5000, 15000].includes(body.speed))
                throw new Error("Invalid speed");
              intervalMs = body.speed;
            }
          });
          if (options.autoTick !== false) schedule();
        } else if (path.endsWith("/event") && req.method === "POST") {
          await mutate(() => triggerEvent(world, body.type));
        } else return json(res, 404, { error: "Unknown admin operation" });
        return json(res, 200, { ok: true, cycle: world.cycle });
      }
      if (path.startsWith("/api/"))
        return json(res, 404, { error: "Endpoint not found" });
      if (req.method !== "GET")
        return json(res, 405, { error: "Method not allowed" });
      const root = resolve("apps/web/dist"),
        requested = resolve(root, "." + decodeURIComponent(path));
      if (
        !requested.startsWith(
          root + String.fromCharCode(process.platform === "win32" ? 92 : 47),
        ) &&
        requested !== root
      )
        return json(res, 403, { error: "Forbidden" });
      let file = requested;
      try {
        if (!(await stat(file)).isFile()) file = resolve(root, "index.html");
      } catch {
        file = resolve(root, "index.html");
      }
      const content = await readFile(file);
      const mime = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      };
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      });
      res.end(content);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          cycle: world.cycle,
          error: error.message,
        }),
      );
      json(res, error.status || 400, { error: error.message });
    }
  });
  return {
    server,
    advance,
    get world() {
      return world;
    },
    adminToken,
    async close() {
      clearInterval(timer);
      for (const client of clients) client.end();
      await new Promise((r) => server.close(r));
      await repo.close();
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const app = await createApplication();
  const port = Number(process.env.PORT || 3001);
  app.server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(`Econia API and built app: http://127.0.0.1:${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => app.close().then(() => process.exit()));
}
