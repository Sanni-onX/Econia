import { randomUUID } from "node:crypto";
import { hashContent } from "./service-tools.mjs";
import {
  missionSources,
  planMission,
  validateMissionPlan,
} from "./mission-planner.mjs";
export function createMissionRuntime({
  db,
  transaction,
  now,
  date,
  apiKey,
  model,
  fetchImpl,
  planProvider = planMission,
  chooseWorker,
  requireAgent,
  emit,
  task,
  delegate,
  limits,
  probeAccount,
}) {
  let timer,
    stopping = false;
  const running = new Map(),
    controllers = new Set();
  const get = (id, customer) => {
    const r = customer
      ? db
          .prepare("SELECT body FROM missions WHERE id=? AND customer=?")
          .get(id, customer)
      : db.prepare("SELECT body FROM missions WHERE id=?").get(id);
    if (!r) throw Object.assign(Error("Mission not found"), { status: 404 });
    return JSON.parse(r.body);
  };
  const save = (m) =>
    db
      .prepare("UPDATE missions SET body=? WHERE id=?")
      .run(JSON.stringify(m), m.id);
  const lease = (agent, id) =>
    transaction(() => {
      if (
        db
          .prepare(
            "SELECT agent FROM worker_leases WHERE agent=? AND expires>?",
          )
          .get(agent, now())
      )
        return false;
      db.prepare(
        "INSERT INTO worker_leases VALUES(?,?,?) ON CONFLICT(agent) DO UPDATE SET task=excluded.task,expires=excluded.expires",
      ).run(agent, id, now() + 180000);
      return true;
    });
  const release = (id) =>
    db.prepare("DELETE FROM worker_leases WHERE task=?").run(id);
  async function submit(
    customer,
    { goal, inputs, requestId, maxAiCalls = 3, autonomy = false },
    origin = null,
  ) {
    if (
      typeof goal !== "string" ||
      goal.trim().length < 20 ||
      goal.length > 3000 ||
      typeof requestId !== "string" ||
      !/^[-a-zA-Z0-9_]{8,100}$/.test(requestId) ||
      !Number.isInteger(maxAiCalls) ||
      maxAiCalls < 1 ||
      maxAiCalls > 6 ||
      typeof autonomy !== "boolean"
    )
      throw Error(
        "Supply a 20–3000 character goal, stable request ID and 1–6 inference-call allowance",
      );
    const refs = missionSources(inputs);
    const minimum =
      1 +
      Object.values(refs).filter((r) =>
        r.services.every((s) => s === "source-brief" || s === "copy-edit"),
      ).length;
    if (maxAiCalls < minimum)
      throw Error(
        "This input needs at least " +
          minimum +
          " reserved inference calls for complete coverage",
      );
    if (!apiKey || !model)
      throw Error(
        "NEAR AI configuration is required for autonomous mission planning",
      );
    if (autonomy && (!inputs.accounts?.length || !probeAccount))
      throw Error(
        "Autonomous follow-up requires a supplied NEAR account target",
      );
    const fingerprint = hashContent(
      JSON.stringify({ goal, inputs, maxAiCalls, autonomy }),
    );
    const old = db
      .prepare("SELECT body FROM missions WHERE customer=? AND request_id=?")
      .get(customer, requestId);
    if (old) {
      const m = JSON.parse(old.body);
      if (m.fingerprint !== fingerprint)
        throw Error("Mission request ID was reused with different content");
      return m;
    }
    const coordinator = await chooseWorker("mission-coordination");
    return transaction(() => {
      const row = db
        .prepare("SELECT body FROM missions WHERE customer=? AND request_id=?")
        .get(customer, requestId);
      if (row) return JSON.parse(row.body);
      const day = date(),
        b = db.prepare("SELECT * FROM budget WHERE day=?").get(day) || {
          ai: 0,
          tasks: 0,
        },
        slots = 8;
      if (
        b.ai + maxAiCalls > limits.dailyAiLimit ||
        b.tasks + slots > limits.dailyTaskLimit
      )
        throw Error(
          "Mission would exceed the project trial allowance; no inference started",
        );
      const used =
        db
          .prepare(
            "SELECT count(*) AS n FROM missions WHERE customer=? AND day=?",
          )
          .get(customer, day).n +
        db
          .prepare(
            "SELECT count(*) AS n FROM tasks WHERE customer=? AND day=? AND parent_id IS NULL",
          )
          .get(customer, day).n;
      if (used >= limits.accountTaskLimit)
        throw Error("Your daily task and mission allowance is reached");
      if (
        autonomy &&
        (db
          .prepare(
            "SELECT count(*) AS n FROM missions WHERE json_extract(body,'$.watch.enabled')=1 AND json_extract(body,'$.watch.expiresAt')>?",
          )
          .get(now()).n >= 3 ||
          db
            .prepare(
              "SELECT count(*) AS n FROM missions WHERE customer=? AND json_extract(body,'$.watch.enabled')=1 AND json_extract(body,'$.watch.expiresAt')>?",
            )
            .get(customer, now()).n >= 1)
      )
        throw Error("Autonomous watch capacity is currently full");
      const m = {
        id: randomUUID(),
        customer,
        requestId,
        goal: goal.trim(),
        inputs,
        refs,
        fingerprint,
        maxAiCalls,
        coordinator,
        status: "QUEUED",
        children: {},
        createdAt: new Date(now()).toISOString(),
        reservedTaskSlots: slots,
        priceNear: "0",
        funding: "PROJECT_FUNDED_TRIAL",
        ...(origin
          ? { requestedByAgent: coordinator, parentMission: origin }
          : {}),
        ...(autonomy
          ? {
              watch: {
                enabled: true,
                expiresAt: now() + 86400000,
                nextCheckAt: now() + 1800000,
                runs: 1,
                maxRuns: 3,
                intervalMs: 1800000,
                status: "APPROVED",
              },
            }
          : {}),
      };
      db.prepare(
        "INSERT INTO budget VALUES(?,?,?) ON CONFLICT(day) DO UPDATE SET ai=excluded.ai,tasks=excluded.tasks",
      ).run(day, b.ai + maxAiCalls, b.tasks + slots);
      db.prepare("INSERT INTO missions VALUES(?,?,?,?,?)").run(
        m.id,
        customer,
        requestId,
        day,
        JSON.stringify(m),
      );
      return m;
    });
  }
  async function processMission(id) {
    let m = get(id);
    const key = "mission-" + id;
    if (m.status === "QUEUED") {
      if (!lease(m.coordinator, key)) return;
      m.status = "PLANNING";
      m.planningStartedAt = now();
      save(m);
      const controller = new AbortController();
      controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), 90000);
      try {
        await requireAgent(m.coordinator);
        const plan = await planProvider({
          goal: m.goal,
          refs: m.refs,
          maxAiCalls: m.maxAiCalls,
          availability:
            "Specialists work one task at a time. The dispatcher selects the least-loaded approved worker.",
          apiKey,
          model,
          fetchImpl,
          signal: controller.signal,
        });
        if (stopping || controller.signal.aborted)
          throw Error("Planning interrupted; no automatic inference retry");
        m.plan = {
          ...validateMissionPlan(plan, m.refs, m.maxAiCalls),
          model: plan.model || model,
          tokens: plan.tokens ?? 0,
        };
        m.status = "WORKING";
        save(m);
        emit(m.coordinator, m.coordinator, "mission-plan", "VALIDATED");
      } catch (e) {
        m.status = "INTERRUPTED";
        m.error = e.message;
        save(m);
      } finally {
        clearTimeout(timeout);
        controllers.delete(controller);
        release(key);
      }
      return;
    }
    if (m.status === "PLANNING") {
      if (now() - (m.planningStartedAt || 0) > 180000) {
        m.status = "INTERRUPTED";
        m.error =
          "Coordinator stopped before persisting a plan; no automatic inference retry";
        save(m);
        release(key);
      }
      return;
    }
    if (m.status === "WORKING") {
      for (const step of m.plan.steps) {
        if (m.children[step.key]) continue;
        const prior = db
          .prepare("SELECT id FROM tasks WHERE customer=? AND request_id=?")
          .get(m.customer, "delegate-" + m.id + "-" + step.key);
        if (prior) {
          m.children[step.key] = prior.id;
          save(m);
          continue;
        }
        const agentId = await chooseWorker(step.service),
          t = await delegate(
            m.customer,
            {
              agentId,
              input: m.refs[step.sourceRef].input,
              brief: m.goal.slice(0, 700) + "\n" + step.reason,
              requestId: "delegate-" + m.id + "-" + step.key,
            },
            { missionId: m.id, stepKey: step.key, fromAgent: m.coordinator },
          );
        m.children[step.key] = t.id;
        save(m);
      }
      const children = m.plan.steps.map((s) =>
        task(m.customer, m.children[s.key]),
      );
      if (
        children.some((t) =>
          ["FAILED_CHECKS", "INTERRUPTED"].includes(t.status),
        )
      ) {
        m.status = "NEEDS_ATTENTION";
        m.error =
          "A specialist could not release a checked output. Completed work is preserved; no automatic paid retry.";
        save(m);
        return;
      }
      if (
        !children.every((t) =>
          ["REVIEW_READY", "ACCEPTED_TRIAL"].includes(t.status),
        )
      )
        return;
      const assembler = await chooseWorker("report-assembly");
      if (!lease(assembler, key)) return;
      try {
        m.status = "ASSEMBLING";
        m.assembler = assembler;
        save(m);
        await requireAgent(assembler);
        for (const child of children)
          if (
            hashContent(child.input) !== child.sourceHash ||
            !child.output ||
            hashContent(child.output.artifact) !== child.output.sha256
          )
            throw Error(
              "Specialist source or artifact hash failed final verification",
            );
        const artifact =
          "# Econia team mission\n\n" +
          m.goal +
          "\n\n## Coordination\n\n" +
          m.plan.summary +
          "\n\n" +
          children
            .map(
              (child, i) =>
                `## Specialist ${i + 1}: ${child.service}\n\nAgent: ${child.agentId}. Task: ${child.id}. Source SHA-256: ${child.sourceHash}. Artifact SHA-256: ${child.output.sha256}.\n\n${child.output.artifact}\n\n${child.output.review}`,
            )
            .join("\n\n---\n\n");
        m.output = {
          artifact,
          sha256: hashContent(artifact),
          checks: [
            "Every specialist delivered a checked result",
            "Source and artifact hashes rechecked before assembly",
          ],
          review:
            "Review the combined specialist reports. Trial acceptance does not transfer NEAR.",
        };
        m.status = "REVIEW_READY";
        m.finishedAt = new Date(now()).toISOString();
        if (m.watch?.enabled && !m.watch.fingerprint) {
          const snapshot = children.find(
            (t) =>
              t.service === "near-account" &&
              t.output.result.data.accountId === m.inputs.accounts[0].trim(),
          );
          if (snapshot)
            m.watch.fingerprint = hashContent(
              JSON.stringify(snapshot.output.result.data),
            );
        }
        emit(m.coordinator, assembler, "report-assembly", "COMPLETED");
        for (const child of children)
          emit(child.agentId, assembler, "checked-result", "DELIVERED");
        save(m);
      } catch (e) {
        m.status = "NEEDS_ATTENTION";
        m.error = e.message;
        save(m);
      } finally {
        release(key);
      }
    }
    if (
      m.status === "ASSEMBLING" &&
      !db
        .prepare("SELECT agent FROM worker_leases WHERE task=? AND expires>?")
        .get(key, now())
    ) {
      m.status = "WORKING";
      save(m);
    }
  }
  async function watch(m) {
    if (
      !m.watch?.enabled ||
      !["REVIEW_READY", "ACCEPTED_TRIAL"].includes(m.status) ||
      now() < m.watch.nextCheckAt
    )
      return;
    if (now() > m.watch.expiresAt || m.watch.runs >= m.watch.maxRuns) {
      m.watch.enabled = false;
      m.watch.status = "FINISHED";
      save(m);
      return;
    }
    m.watch.nextCheckAt = now() + m.watch.intervalMs;
    save(m);
    try {
      const report = await probeAccount(m.inputs.accounts[0]),
        signature = hashContent(JSON.stringify(report.data));
      if (!m.watch.fingerprint) {
        m.watch.fingerprint = signature;
        m.watch.status = "WATCHING";
        save(m);
        return;
      }
      if (signature === m.watch.fingerprint) {
        m.watch.status = "NO_CHANGE";
        save(m);
        return;
      }
      const next = await submit(
        m.customer,
        {
          goal: m.goal,
          inputs: m.inputs,
          requestId: "followup-" + m.id + "-" + signature.slice(0, 20),
          maxAiCalls: m.maxAiCalls,
          autonomy: false,
        },
        m.id,
      );
      m.watch.fingerprint = signature;
      m.watch.runs++;
      m.watch.status = "FOLLOWUP_ASSIGNED";
      m.watch.latestMission = next.id;
      save(m);
      emit(m.coordinator, next.coordinator, "autonomous-followup", "ASSIGNED");
    } catch (e) {
      m.watch.status = "WAITING";
      m.watch.issue = e.message;
      save(m);
    }
  }
  async function tick() {
    if (stopping) return;
    for (const row of db
      .prepare("SELECT id FROM missions ORDER BY rowid DESC LIMIT 30")
      .all()) {
      if (running.has(row.id)) continue;
      const m = get(row.id),
        pending = ["QUEUED", "PLANNING", "WORKING", "ASSEMBLING"].includes(
          m.status,
        ),
        watchDue = m.watch?.enabled && now() >= m.watch.nextCheckAt;
      if (!pending && !watchDue) continue;
      const p = (pending ? processMission(row.id) : watch(m)).catch((e) => {
        const current = get(row.id);
        current.status = "NEEDS_ATTENTION";
        current.error = e.message;
        save(current);
      });
      running.set(row.id, p);
      p.finally(() => running.delete(row.id));
    }
  }
  return {
    submit,
    get: (customer, id) => get(id, customer),
    list: (customer) =>
      db
        .prepare(
          "SELECT body FROM missions WHERE customer=? ORDER BY rowid DESC LIMIT 20",
        )
        .all(customer)
        .map((r) => {
          const m = JSON.parse(r.body);
          return {
            ...m,
            taskSummaries: Object.values(m.children).map((id) => {
              const t = task(customer, id);
              return {
                id: t.id,
                agentId: t.agentId,
                service: t.service,
                status: t.status,
                reviewerId: t.reviewerId,
              };
            }),
          };
        }),
    children(customer, id) {
      const m = get(id, customer);
      return Object.values(m.children).map((id) => task(customer, id));
    },
    accept(customer, id) {
      const m = get(id, customer);
      if (m.status !== "REVIEW_READY")
        throw Error("A checked team report is required");
      m.status = "ACCEPTED_TRIAL";
      m.acceptedAt = new Date(now()).toISOString();
      save(m);
      return m;
    },
    stopWatch(customer, id) {
      const m = get(id, customer);
      if (m.watch) {
        m.watch.enabled = false;
        m.watch.status = "STOPPED_BY_CUSTOMER";
        save(m);
      }
      return m;
    },
    tick,
    async settle() {
      await tick();
      await Promise.allSettled([...running.values()]);
    },
    start() {
      stopping = false;
      timer = setInterval(() => tick(), 1500);
      timer.unref();
      tick();
    },
    async close() {
      stopping = true;
      clearInterval(timer);
      for (const c of controllers) c.abort();
      await Promise.allSettled([...running.values()]);
    },
  };
}
