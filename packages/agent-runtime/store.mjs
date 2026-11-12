import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { GENESIS_AGENTS, validateGenesis } from "./genesis.mjs";
export function openAgentStore({
  path = ".data/econia-2.sqlite",
  agents = GENESIS_AGENTS,
  now = () => new Date().toISOString(),
} = {}) {
  validateGenesis(agents);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  try {
    transaction(() => {
      db.prepare("INSERT OR IGNORE INTO runtime_migrations VALUES(1,?)").run(
        now(),
      );
      for (const a of agents) {
        const prior = db
          .prepare("SELECT profession FROM professionals WHERE id=?")
          .get(a.id);
        if (prior && prior.profession !== a.profession)
          throw Error(
            "Immutable profession mismatch; explicit identity migration required",
          );
        db.prepare(
          "INSERT OR IGNORE INTO professionals VALUES(?,?,?,?,?,?,?,?,?,?)",
        ).run(
          a.id,
          a.name,
          a.profession,
          a.specialization,
          a.biography,
          a.objective,
          a.approach,
          a.workplace,
          a.district,
          a.generation,
        );
        db.prepare(
          "INSERT OR IGNORE INTO runtime_states VALUES(?,?,NULL,?)",
        ).run(a.id, "AVAILABLE", now());
        for (const s of a.services)
          db.prepare(
            "INSERT OR IGNORE INTO professional_services VALUES(?,?)",
          ).run(a.id, s);
      }
      // A request may already have reached the provider. Recovery never repeats it.
      db.prepare(
        "UPDATE runtime_jobs SET state='INTERRUPTED',error='Process stopped after claim; review before requesting another inference',finished_at=? WHERE state='RUNNING'",
      ).run(now());
      db.prepare(
        "UPDATE runtime_states SET status='RECOVERING',active_job=NULL,updated_at=? WHERE active_job IS NOT NULL",
      ).run(now());
    });
  } catch (error) {
    db.close();
    throw error;
  }
  const event = (agent, type, reference, summary) =>
    db
      .prepare(
        "INSERT INTO world_events(id,agent_id,type,reference_id,summary,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(randomUUID(), agent, type, reference, summary, now());
  const professional = (id) => {
    const a = db.prepare("SELECT * FROM professionals WHERE id=?").get(id);
    if (!a) throw Object.assign(Error("Unknown professional"), { status: 404 });
    return {
      ...a,
      services: db
        .prepare(
          "SELECT service_id FROM professional_services WHERE agent_id=?",
        )
        .all(id)
        .map((x) => x.service_id),
      runtime: db
        .prepare(
          "SELECT status,active_job,updated_at FROM runtime_states WHERE agent_id=?",
        )
        .get(id),
    };
  };
  return {
    db,
    transaction,
    now,
    event,
    professional,
    agents: () =>
      db
        .prepare("SELECT id FROM professionals ORDER BY rowid")
        .all()
        .map((x) => professional(x.id)),
    close: () => db.close(),
  };
}
