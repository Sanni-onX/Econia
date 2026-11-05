import test from "node:test";
import assert from "node:assert/strict";
import { openRepository } from "../packages/database/index.mjs";
import { genesis, tick } from "../packages/simulation-core/index.mjs";
test(
  "PostgreSQL migration, journal, checkpoint and rollback integration",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const repo = await openRepository({ url: process.env.TEST_DATABASE_URL });
    try {
      const w = genesis("postgres-ci");
      tick(w);
      await repo.save(w);
      assert.deepEqual(await repo.load(), w);
      assert.ok((await repo.history("person_199", "decisions")).length);
      const bad = structuredClone(w);
      bad.entities.person_199.cash = -1;
      await assert.rejects(repo.save(bad));
      assert.deepEqual(await repo.load(), w);
    } finally {
      await repo.close();
    }
  },
);
