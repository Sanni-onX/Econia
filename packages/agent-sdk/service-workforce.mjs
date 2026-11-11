import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import {
  SERVICE_CATALOG,
  validateTaskInput,
  indexSource,
  validateEvidence,
  validateEdit,
  analyseCsv,
  inferService,
  renderArtifact,
  hashContent,
} from "./service-tools.mjs";
import { MAINNET_CONTRACT } from "../shared/native-state.mjs";

export function createServiceWorkforce({
  path = process.env.SERVICE_DATABASE_PATH || ".data/econia-services.sqlite",
  resolveAgent,
  apiKey = process.env.NEAR_AI_API_KEY,
  model = process.env.NEAR_AI_MODEL,
  fetchImpl = fetch,
  dailyAiLimit = Number(process.env.SERVICE_DAILY_AI_CALL_LIMIT ?? 12),
  dailyTaskLimit = Number(process.env.SERVICE_DAILY_TASK_LIMIT ?? 24),
  accountTaskLimit = Number(process.env.SERVICE_ACCOUNT_TASK_LIMIT ?? 3),
  now = Date.now,
} = {}) {
  if (typeof resolveAgent !== "function")
    throw Error("Fresh onchain ownership resolver required");
  if (
    [dailyAiLimit, dailyTaskLimit, accountTaskLimit].some(
      (n) => !Number.isInteger(n) || n < 0 || n > 100,
    )
  )
    throw Error("Service limits must be integers between 0 and 100");
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS profiles(agent TEXT PRIMARY KEY, owner TEXT NOT NULL, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, customer TEXT NOT NULL, request_id TEXT NOT NULL, day TEXT NOT NULL, state TEXT NOT NULL, lease INTEGER NOT NULL DEFAULT 0, body TEXT NOT NULL, UNIQUE(customer,request_id));
    CREATE TABLE IF NOT EXISTS budget(day TEXT PRIMARY KEY, ai INTEGER NOT NULL, tasks INTEGER NOT NULL);`);
  let timer,
    stopping = false;
  const running = new Set(),
    controllers = new Set();
  const date = () => new Date(now()).toISOString().slice(0, 10);
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const v = fn();
      db.exec("COMMIT");
      return v;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const getProfile = (agentId, owner) => {
    const row = db.prepare("SELECT * FROM profiles WHERE agent=?").get(agentId),
      seed = SERVICE_CATALOG.find((s) => s.agentId === agentId);
    if (row && row.owner === owner) {
      const p = JSON.parse(row.body);
      return {
        ...p,
        active: Boolean(seed && p.service === seed.id),
        status:
          seed && p.service === seed.id
            ? "AVAILABLE"
            : "PENDING_CAPABILITY_REVIEW",
      };
    }
    if (seed && owner === MAINNET_CONTRACT)
      return {
        agentId,
        owner,
        service: seed.id,
        purpose: seed.description,
        active: true,
        status: "AVAILABLE",
      };
    return {
      agentId,
      owner,
      service: null,
      purpose: "Awaiting owner-defined purpose and capability review.",
      active: false,
      status: row ? "NEW_OWNER_APPROVAL_REQUIRED" : "UNASSIGNED",
    };
  };
  const saveTask = (task) =>
    db
      .prepare("UPDATE tasks SET state=?,body=? WHERE id=?")
      .run(task.status, JSON.stringify(task), task.id);
  const requireAgent = async (id, allowPaused = false) => {
    if (typeof id !== "string" || !/^person_\d{1,8}$/.test(id))
      throw Error("A valid agent identity is required");
    const a = await resolveAgent(id);
    if (!a?.ownerId || (a.paused && !allowPaused))
      throw Error(
        "Agent is unavailable, paused, or ownership cannot be verified",
      );
    return a;
  };
  const recover = () => {
    for (const row of db
      .prepare("SELECT * FROM tasks WHERE state='RUNNING' AND lease<?")
      .all(now())) {
      const t = JSON.parse(row.body);
      t.status = "INTERRUPTED";
      t.error =
        "Worker stopped before completion. No automatic paid inference retry.";
      saveTask(t);
    }
  };
  recover();
  function publicWorkers(world) {
    return world.agents.map((a) => {
      const p = getProfile(a.id, a.token?.owner_id),
        service = SERVICE_CATALOG.find((s) => s.id === p.service);
      return {
        ...a,
        role: p.active ? service.label : "Unassigned",
        goal: p.purpose,
        serviceProfile: {
          ...p,
          active: p.active && Boolean(a.token) && !a.paused,
        },
        service: service || null,
      };
    });
  }
  async function configure(accountId, { agentId, service, purpose }) {
    if (
      typeof purpose !== "string" ||
      purpose.trim().length < 15 ||
      purpose.length > 1000 ||
      !["custom", ...SERVICE_CATALOG.map((s) => s.id)].includes(service)
    )
      throw Error(
        "Select a capability and supply a 15–1000 character owner brief",
      );
    const a = await requireAgent(agentId, true);
    if (a.ownerId !== accountId)
      throw Error("Only the current NFT owner can define this agent");
    const p = {
      agentId,
      owner: accountId,
      service,
      purpose: purpose.trim(),
      updatedAt: new Date(now()).toISOString(),
    };
    db.prepare(
      "INSERT INTO profiles VALUES(?,?,?) ON CONFLICT(agent) DO UPDATE SET owner=excluded.owner,body=excluded.body",
    ).run(agentId, accountId, JSON.stringify(p));
    return getProfile(agentId, accountId);
  }
  async function submit(customer, { agentId, input, brief = "", requestId }) {
    if (
      typeof requestId !== "string" ||
      !/^[-a-zA-Z0-9_]{8,80}$/.test(requestId)
    )
      throw Error("A stable request ID is required");
    const a = await requireAgent(agentId),
      profile = getProfile(agentId, a.ownerId),
      service = SERVICE_CATALOG.find((s) => s.id === profile.service);
    if (!profile.active || !service)
      throw Error("This agent has no activated service workflow");
    validateTaskInput(service.id, input, brief);
    if (service.aiCalls && (!apiKey || !model))
      throw Error("NEAR AI service configuration is unavailable");
    const fingerprint = hashContent(
      JSON.stringify({ agentId, input, brief, service: service.id }),
    );
    return transaction(() => {
      const old = db
        .prepare("SELECT body FROM tasks WHERE customer=? AND request_id=?")
        .get(customer, requestId);
      if (old) {
        const t = JSON.parse(old.body);
        if (t.fingerprint !== fingerprint)
          throw Error("Request ID already used with different content");
        return t;
      }
      const day = date(),
        b = db.prepare("SELECT * FROM budget WHERE day=?").get(day) || {
          ai: 0,
          tasks: 0,
        };
      if (b.ai + service.aiCalls > dailyAiLimit || b.tasks >= dailyTaskLimit)
        throw Error("Project-funded trial allowance reached for today");
      if (
        db
          .prepare("SELECT count(*) AS n FROM tasks WHERE customer=? AND day=?")
          .get(customer, day).n >= accountTaskLimit
      )
        throw Error("Your daily trial task allowance is reached");
      const t = {
        id: randomUUID(),
        customer,
        requestId,
        agentId,
        service: service.id,
        input,
        brief,
        profile,
        sourceHash: hashContent(input),
        fingerprint,
        status: "QUEUED",
        funding: "PROJECT_FUNDED_TRIAL",
        priceNear: "0",
        reservedAiCalls: service.aiCalls,
        createdAt: new Date(now()).toISOString(),
        trace: [],
      };
      db.prepare(
        "INSERT INTO budget VALUES(?,?,?) ON CONFLICT(day) DO UPDATE SET ai=excluded.ai,tasks=excluded.tasks",
      ).run(day, b.ai + service.aiCalls, b.tasks + 1);
      db.prepare(
        "INSERT INTO tasks(id,customer,request_id,day,state,body) VALUES(?,?,?,?,?,?)",
      ).run(t.id, customer, requestId, day, t.status, JSON.stringify(t));
      return t;
    });
  }
  async function execute(id) {
    const t = transaction(() => {
      const row = db
        .prepare("SELECT * FROM tasks WHERE id=? AND state='QUEUED'")
        .get(id);
      if (!row) return null;
      const t = JSON.parse(row.body);
      t.status = "RUNNING";
      db.prepare("UPDATE tasks SET state=?,lease=?,body=? WHERE id=?").run(
        t.status,
        now() + 180000,
        JSON.stringify(t),
        id,
      );
      return t;
    });
    if (!t) return;
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const a = await requireAgent(t.agentId),
        p = getProfile(t.agentId, a.ownerId);
      if (
        a.ownerId !== t.profile.owner ||
        !p.active ||
        p.purpose !== t.profile.purpose ||
        p.service !== t.profile.service
      )
        throw Error(
          "Owner or service instructions changed; request needs review",
        );
      const source = indexSource(t.input);
      const reviewerAtStart = await requireAgent("person_102");
      if (
        getProfile("person_102", reviewerAtStart.ownerId).service !==
          "copy-edit" ||
        !getProfile("person_102", reviewerAtStart.ownerId).active
      )
        throw Error("Quality-check agent unavailable; no inference started");
      let result, inference;
      t.trace.push({
        agentId: t.agentId,
        tool: t.service === "csv-audit" ? "csv-parser" : "source-index",
        status: "PASSED",
      });
      if (t.service === "csv-audit") {
        result = analyseCsv(t.input);
        t.trace.push({
          agentId: t.agentId,
          tool: "decimal-statistics",
          status: "PASSED",
        });
      } else {
        inference = await inferService({
          service: t.service,
          input: t.input,
          brief: t.brief,
          ownerBrief: p.purpose,
          sources: t.service === "source-brief" ? source : undefined,
          apiKey,
          model,
          fetchImpl,
          signal: controller.signal,
        });
        t.trace.push({
          agentId: t.agentId,
          tool: "near-ai-" + t.service,
          status: "RESPONDED",
          model: inference.model,
          tokens: inference.tokens,
        });
        result =
          t.service === "source-brief"
            ? validateEvidence(inference.candidate, source)
            : validateEdit(inference.candidate, t.input);
      }
      const reviewer = await requireAgent("person_102"),
        reviewProfile = getProfile("person_102", reviewer.ownerId);
      if (!reviewProfile.active || reviewProfile.service !== "copy-edit")
        throw Error("Quality-check agent unavailable; output held");
      if (
        t.service === "csv-audit" &&
        JSON.stringify(result) !== JSON.stringify(analyseCsv(t.input))
      )
        throw Error("CSV result recheck failed");
      const latest = await requireAgent(t.agentId);
      if (latest.ownerId !== t.profile.owner)
        throw Error("NFT owner changed during execution; output held");
      t.trace.push({
        agentId: "person_102",
        tool:
          t.service === "source-brief"
            ? "quote-check"
            : t.service === "csv-audit"
              ? "table-check"
              : "fact-preservation-check",
        status: "PASSED",
        inferenceCalls: 0,
      });
      if (controller.signal.aborted || stopping)
        throw Error("Worker interrupted; output held");
      const artifact = renderArtifact(t.service, result);
      t.output = {
        artifact,
        sha256: hashContent(artifact),
        result,
        checks: SERVICE_CATALOG.find((s) => s.id === t.service).checks,
        review: SERVICE_CATALOG.find((s) => s.id === t.service).review,
      };
      t.status = "REVIEW_READY";
      t.finishedAt = new Date(now()).toISOString();
    } catch (e) {
      t.status = controller.signal.aborted ? "INTERRUPTED" : "FAILED_CHECKS";
      t.error = e.message;
      t.trace.push({ tool: "release-gate", status: "BLOCKED" });
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
      saveTask(t);
    }
  }
  function poll() {
    if (stopping) return;
    recover();
    const slots = 2 - running.size;
    for (const row of db
      .prepare(
        "SELECT id FROM tasks WHERE state='QUEUED' ORDER BY rowid LIMIT ?",
      )
      .all(Math.max(0, slots))) {
      const p = execute(row.id);
      running.add(p);
      p.finally(() => running.delete(p)).catch(() => {});
    }
  }
  const task = (customer, id) => {
    const row = db
      .prepare("SELECT body FROM tasks WHERE id=? AND customer=?")
      .get(id, customer);
    if (!row) throw Object.assign(Error("Task not found"), { status: 404 });
    return JSON.parse(row.body);
  };
  return {
    publicWorkers,
    configure,
    submit,
    execute,
    task,
    list: (customer) =>
      db
        .prepare(
          "SELECT body FROM tasks WHERE customer=? ORDER BY rowid DESC LIMIT 30",
        )
        .all(customer)
        .map((r) => JSON.parse(r.body)),
    accept(customer, id) {
      const t = task(customer, id);
      if (t.status !== "REVIEW_READY")
        throw Error("A checked deliverable is required");
      t.status = "ACCEPTED_TRIAL";
      t.acceptedAt = new Date(now()).toISOString();
      saveTask(t);
      return t;
    },
    status() {
      const b = db.prepare("SELECT * FROM budget WHERE day=?").get(date()) || {
        ai: 0,
        tasks: 0,
      };
      return {
        mode: "project-funded-trial",
        activeCapacity: 3,
        backgroundInference: false,
        dailyAiLimit,
        aiCallsReserved: b.ai,
        dailyTaskLimit,
        tasksReserved: b.tasks,
        accountTaskLimit,
        ready: Boolean(apiKey && model),
        settlement: "No NEAR charged or paid in trial mode",
      };
    },
    start() {
      stopping = false;
      timer = setInterval(poll, 1000);
      timer.unref();
      poll();
    },
    async close() {
      stopping = true;
      clearInterval(timer);
      for (const c of controllers) c.abort();
      await Promise.allSettled([...running]);
      db.close();
    },
  };
}
