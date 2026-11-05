import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openRepository } from "../packages/database/index.mjs";
import {
  genesis,
  tick,
  sponsorSandbox,
} from "../packages/simulation-core/index.mjs";
test("normalized SQLite checkpoint survives restart without duplicate journal events", async () => {
  const dir = await mkdtemp(join(tmpdir(), "econia-test-")),
    path = join(dir, "test.sqlite");
  try {
    let repo = await openRepository({ path, url: "" });
    const w = genesis();
    sponsorSandbox(w, "person_199", 100000, "durable-sponsor");
    for (let i = 0; i < 5; i++) tick(w);
    await repo.save(w);
    await repo.save(w);
    await repo.close();
    repo = await openRepository({ path, url: "" });
    assert.deepEqual(await repo.load(), w);
    assert.ok((await repo.history("person_199", "decisions")).length >= 5);
    await repo.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
