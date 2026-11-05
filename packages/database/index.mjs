import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
export async function openRepository({
  url = process.env.DATABASE_URL,
  path = resolve(process.env.ECONIA_DATA_PATH || ".data/econia.sqlite"),
} = {}) {
  let db,
    pg,
    connection,
    lockOwned = false;
  if (url) {
    const { Pool } = await import("pg");
    pg = new Pool({ connectionString: url, max: 3 });
    connection = await pg.connect();
    const result = await connection.query(
      "SELECT pg_try_advisory_lock(314159265) AS locked",
    );
    if (!result.rows[0].locked) {
      connection.release();
      await pg.end();
      throw new Error("Another worker owns this world");
    }
    await connection.query(schema);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    const lock = path + ".lock";
    try {
      const fd = openSync(lock, "wx");
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      lockOwned = true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const pid = Number(readFileSync(lock, "utf8"));
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error.code === "ESRCH") alive = false;
      }
      if (alive) throw new Error("Another worker owns this local world");
      unlinkSync(lock);
      const fd = openSync(lock, "wx");
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      lockOwned = true;
    }
    db = new DatabaseSync(path);
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    db.exec(schema);
  }
  const run = async (sql, args = []) =>
    connection
      ? connection.query(
          sql.replaceAll(
            "?",
            (() => {
              let n = 0;
              return () => `$${++n}`;
            })(),
          ),
          args,
        )
      : db.prepare(sql).run(...args);
  const get = async (sql, args = []) =>
    connection
      ? (
          await connection.query(
            sql.replaceAll(
              "?",
              (() => {
                let n = 0;
                return () => `$${++n}`;
              })(),
            ),
            args,
          )
        ).rows[0]
      : db.prepare(sql).get(...args);
  const digest = (state) => createHash("sha256").update(state).digest("hex");
  let persistedCycle = -1;
  return {
    kind: url ? "PostgreSQL" : "SQLite (local)",
    async loadStage() {
      const row = await get(
        "SELECT payload FROM settlement_batches WHERE id=?",
        ["pending-cycle"],
      );
      return row ? JSON.parse(row.payload) : null;
    },
    async saveStage(stage) {
      await run(
        "INSERT INTO settlement_batches(id,cycle,status,payload) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET cycle=excluded.cycle,status=excluded.status,payload=excluded.payload",
        [
          "pending-cycle",
          stage.candidate.cycle,
          "PREPARED",
          JSON.stringify(stage),
        ],
      );
    },
    async clearStage() {
      await run("DELETE FROM settlement_batches WHERE id=?", ["pending-cycle"]);
    },
    async load() {
      const row = await get(
        "SELECT state,digest FROM checkpoints WHERE world_id=?",
        ["econia"],
      );
      if (!row) return null;
      if (digest(row.state) !== row.digest)
        throw new Error("Checkpoint integrity failure");
      const state = JSON.parse(row.state);
      persistedCycle = state.cycle;
      return state;
    },
    async save(w) {
      await run("BEGIN");
      try {
        await run(
          "INSERT INTO schema_migrations(version,applied_at) VALUES(1,?) ON CONFLICT(version) DO NOTHING",
          [new Date().toISOString()],
        );
        await run(
          "INSERT INTO worlds(id,seed,cycle,mode) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET cycle=excluded.cycle",
          ["econia", w.seed, w.cycle, w.mode],
        );
        for (const e of Object.values(w.entities))
          await run(
            "INSERT INTO entities(id,world_id,name,type,owner,cash,state) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,cash=excluded.cash,state=excluded.state",
            [
              e.id,
              "econia",
              e.name,
              e.type,
              e.owner,
              e.cash,
              JSON.stringify(e),
            ],
          );
        for (const e of Object.values(w.entities))
          for (const [g, q] of Object.entries(e.inventory))
            await run(
              "INSERT INTO inventories(entity_id,good,quantity) VALUES(?,?,?) ON CONFLICT(entity_id,good) DO UPDATE SET quantity=excluded.quantity",
              [e.id, g, q],
            );
        for (const l of w.ledger.filter((l) => l.cycle >= persistedCycle))
          await run(
            "INSERT INTO economic_transactions(id,world_id,cycle,debit,credit,amount,asset,reason) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
            [
              l.id,
              "econia",
              l.cycle,
              l.debit,
              l.credit,
              l.amount,
              l.asset,
              l.reason,
            ],
          );
        for (const e of w.events.filter((e) => e.cycle >= persistedCycle))
          await run(
            "INSERT INTO events(id,world_id,sequence,cycle,type,entity_id,data) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
            [
              e.id,
              "econia",
              e.sequence,
              e.cycle,
              e.type,
              e.entityId,
              JSON.stringify(e),
            ],
          );
        for (const d of w.decisions.filter((d) => d.cycle >= persistedCycle))
          await run(
            "INSERT INTO agent_decisions(id,entity_id,cycle,status,context) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
            [d.id, d.entityId, d.cycle, d.status, JSON.stringify(d)],
          );
        await run("DELETE FROM employment");
        for (const j of w.jobs)
          await run(
            "INSERT INTO employment(id,business,person,wage,state) VALUES(?,?,?,?,?)",
            [j.id, j.business, j.person, j.wage, JSON.stringify(j)],
          );
        await run("DELETE FROM business_ownership");
        for (const h of w.holdings)
          await run(
            "INSERT INTO business_ownership(owner,entity,bps) VALUES(?,?,?)",
            [h.owner, h.entity, h.bps],
          );
        for (const s of w.sponsorships)
          await run(
            "INSERT INTO sponsorships(id,entity_id,amount,sender,tx_hash,state) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
            [s.id, s.entity, s.amount, s.sender, s.hash, JSON.stringify(s)],
          );
        await run("DELETE FROM marketplace_listings");
        for (const l of w.listings)
          await run(
            "INSERT INTO marketplace_listings(id,entity_id,seller,ask,status,state) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,state=excluded.state",
            [l.id, l.entity, l.seller, l.ask, l.status, JSON.stringify(l)],
          );
        for (const o of w.offers) {
          const entityId =
            o.entity || w.listings.find((l) => l.id === o.listingId)?.entity;
          if (entityId)
            await run(
              "INSERT INTO marketplace_offers(id,entity_id,buyer,amount,status,state) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,state=excluded.state",
              [o.id, entityId, o.buyer, o.amount, o.status, JSON.stringify(o)],
            );
        }
        for (const h of w.priceHistory.filter((h) => h.cycle >= persistedCycle))
          for (const [g, p] of Object.entries(h))
            if (g !== "cycle")
              await run(
                "INSERT INTO market_prices(world_id,cycle,good,price) VALUES(?,?,?,?) ON CONFLICT(world_id,cycle,good) DO NOTHING",
                ["econia", h.cycle, g, p],
              );
        if (w.chain)
          for (const e of Object.values(w.entities).filter(
            (e) => e.id !== "external_capital",
          ))
            await run(
              "INSERT INTO nft_mappings(entity_id,contract,token_id,owner) VALUES(?,?,?,?) ON CONFLICT(entity_id) DO UPDATE SET owner=excluded.owner",
              [e.id, w.chain.world, e.id, e.owner],
            );
        const state = JSON.stringify(w);
        await run(
          "INSERT INTO checkpoints(world_id,cycle,state,digest) VALUES(?,?,?,?) ON CONFLICT(world_id) DO UPDATE SET cycle=excluded.cycle,state=excluded.state,digest=excluded.digest",
          ["econia", w.cycle, state, digest(state)],
        );
        await run("COMMIT");
        persistedCycle = w.cycle;
      } catch (error) {
        await run("ROLLBACK");
        throw error;
      }
    },
    async history(id, kind = "events") {
      const table = kind === "decisions" ? "agent_decisions" : "events",
        field = kind === "decisions" ? "context" : "data";
      const sql = `SELECT ${field} FROM ${table} WHERE entity_id=? ORDER BY cycle DESC LIMIT 250`;
      return connection
        ? (await connection.query(sql.replace("?", "$1"), [id])).rows.map((x) =>
            JSON.parse(x[field]),
          )
        : db
            .prepare(sql)
            .all(id)
            .map((x) => JSON.parse(x[field]));
    },
    async close() {
      if (db) db.close();
      if (lockOwned) unlinkSync(path + ".lock");
      if (connection) {
        await connection.query("SELECT pg_advisory_unlock(314159265)");
        connection.release();
      }
      if (pg) await pg.end();
    },
  };
}
