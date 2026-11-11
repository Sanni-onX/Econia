import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { Account, KeyPair } from "near-api-js";
import { signMessage } from "near-api-js/nep413";
import { createServiceAuth } from "../packages/agent-sdk/service-auth.mjs";
import { createServiceWorkforce } from "../packages/agent-sdk/service-workforce.mjs";
import {
  analyseCsv,
  indexSource,
  validateEvidence,
  validateEdit,
} from "../packages/agent-sdk/service-tools.mjs";
import { MAINNET_CONTRACT } from "../packages/shared/native-state.mjs";
const source =
  "The pilot delivered 12 reports in October. Customers reviewed each report before accepting the result. No task ran without a specific customer request.";
const csv = "product,quantity,price\nNotebook,4,0.10\nPen,2,0.20\nFolder,,0.30";
const resolveAgent = async () => ({ ownerId: MAINNET_CONTRACT, paused: false });
test("A paused NFT owner can still define its future purpose without inference", async () => {
  const w = createServiceWorkforce({
    path: ":memory:",
    resolveAgent: async () => ({ ownerId: MAINNET_CONTRACT, paused: true }),
  });
  try {
    const p = await w.configure(MAINNET_CONTRACT, {
      agentId: "person_103",
      service: "custom",
      purpose: "A future customer-facing specialist service.",
    });
    assert.equal(p.status, "PENDING_CAPABILITY_REVIEW");
    assert.equal(w.status().aiCallsReserved, 0);
  } finally {
    await w.close();
  }
});
test("Interrupted in-flight work recovers without another inference request", async () => {
  const dir = await mkdtemp(join(tmpdir(), "econia-interrupted-")),
    path = join(dir, "jobs.sqlite");
  let calls = 0;
  const opts = {
    path,
    resolveAgent,
    apiKey: "test",
    model: "test",
    fetchImpl: async () => {
      calls++;
      throw Error("Must not retry");
    },
  };
  let w = createServiceWorkforce(opts);
  try {
    const task = await w.submit("customer.near", {
      agentId: "person_199",
      input: source,
      requestId: "interrupted-001",
    });
    await w.close();
    const db = new DatabaseSync(path);
    task.status = "RUNNING";
    db.prepare("UPDATE tasks SET state=?,lease=?,body=? WHERE id=?").run(
      "RUNNING",
      0,
      JSON.stringify(task),
      task.id,
    );
    db.close();
    w = createServiceWorkforce(opts);
    await w.execute(task.id);
    assert.equal(w.task("customer.near", task.id).status, "INTERRUPTED");
    assert.equal(calls, 0);
    assert.equal(w.status().aiCallsReserved, 1);
  } finally {
    await w.close();
    await rm(dir, { recursive: true, force: true });
  }
});
const response = (candidate) => ({
  ok: true,
  text: async () =>
    JSON.stringify({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(candidate) },
        },
      ],
      usage: { total_tokens: 100 },
    }),
});
test("CSV tools handle quoted cells, missing rows, mixed columns and decimal sums exactly", () => {
  const r = analyseCsv(
    'name,amount\n"A, B",0.10\n"Multi\nline",0.20\n,\nFormula,=1+1',
  );
  assert.equal(r.rowCount, 4);
  assert.equal(r.columns[1].sum, "0.3");
  assert.equal(r.columns[1].mean, "0.15");
  assert.equal(r.columns[1].missing, 1);
  assert.equal(r.columns[1].numericCount, 2);
  assert.match(r.columns[1].scope, /numeric cells only/);
  assert.throws(() => analyseCsv("a,b\n1,2,3"), /width/);
  assert.throws(() => analyseCsv('a,b\n"x,y'), /unclosed/);
});
test("Output gates reject invented evidence, changed negative numbers and added links", () => {
  const sources = indexSource(source);
  assert.throws(
    () =>
      validateEvidence(
        {
          findings: [
            {
              heading: "Claim",
              sourceId: "S1",
              quote: "This is a completely invented claim.",
            },
          ],
        },
        sources,
      ),
    /unsupported/,
  );
  const original =
    "Results changed by -12 percent. Contact team@example.com for details.";
  assert.throws(
    () =>
      validateEdit(
        { text: original.replace("-12", "12"), notes: [] },
        original,
      ),
    /changed/,
  );
  assert.throws(
    () =>
      validateEdit(
        { text: original + " Visit https://example.com.", notes: [] },
        original,
      ),
    /changed/,
  );
});
test("Tool-only CSV delivery is idempotent, private, reviewed by another agent and accepted explicitly", async () => {
  let calls = 0;
  const w = createServiceWorkforce({
    path: ":memory:",
    resolveAgent,
    fetchImpl: async () => {
      calls++;
      throw Error("Unexpected inference");
    },
  });
  try {
    const body = {
      agentId: "person_101",
      input: csv,
      requestId: "csv-request-001",
    };
    const t = await w.submit("customer.near", body);
    assert.equal((await w.submit("customer.near", body)).id, t.id);
    await w.execute(t.id);
    const out = w.task("customer.near", t.id);
    assert.equal(out.status, "REVIEW_READY");
    assert.equal(calls, 0);
    assert.match(out.output.artifact, /0.6/);
    assert.equal(out.trace.at(-1).agentId, "person_102");
    assert.throws(() => w.task("stranger.near", t.id), /not found/);
    assert.equal(w.accept("customer.near", t.id).status, "ACCEPTED_TRIAL");
    assert.equal(w.status().tasksReserved, 1);
    await assert.rejects(
      w.submit("customer.near", { ...body, input: csv + "\nBag,1,1" }),
      /different content/,
    );
  } finally {
    await w.close();
  }
});
test("Invalid model output is held, inference is bounded, and a duplicate execution cannot bill again", async () => {
  let calls = 0;
  const w = createServiceWorkforce({
    path: ":memory:",
    resolveAgent,
    apiKey: "test",
    model: "test",
    fetchImpl: async () => {
      calls++;
      return response({
        findings: [
          {
            heading: "Invented",
            sourceId: "missing",
            quote: "An invented report that has no source.",
          },
        ],
      });
    },
  });
  try {
    const t = await w.submit("customer.near", {
      agentId: "person_199",
      input: source,
      requestId: "evidence-001",
    });
    await Promise.all([w.execute(t.id), w.execute(t.id)]);
    const out = w.task("customer.near", t.id);
    assert.equal(calls, 1);
    assert.equal(out.status, "FAILED_CHECKS");
    assert.equal(out.output, undefined);
    assert.throws(() => w.accept("customer.near", t.id), /checked deliverable/);
  } finally {
    await w.close();
  }
});
test("Owner-defined custom purpose stays pending and former owners cannot reconfigure", async () => {
  let owner = MAINNET_CONTRACT;
  const w = createServiceWorkforce({
    path: ":memory:",
    resolveAgent: async () => ({ ownerId: owner, paused: false }),
  });
  try {
    await assert.rejects(
      w.configure("stranger.near", {
        agentId: "person_103",
        service: "custom",
        purpose: "A tailored real customer service.",
      }),
      /current NFT owner/,
    );
    const p = await w.configure(owner, {
      agentId: "person_103",
      service: "custom",
      purpose: "Help customers with a tailored service.",
    });
    assert.equal(p.active, false);
    assert.equal(p.status, "PENDING_CAPABILITY_REVIEW");
    await assert.rejects(
      w.submit("customer.near", {
        agentId: "person_103",
        input: source,
        requestId: "pending-001",
      }),
      /no activated/,
    );
    owner = "new-owner.near";
    await assert.rejects(
      w.configure(MAINNET_CONTRACT, {
        agentId: "person_103",
        service: "custom",
        purpose: "Change the new owner instructions.",
      }),
      /current NFT owner/,
    );
  } finally {
    await w.close();
  }
});
test("Daily inference reservations and ready artifacts survive restart without another request", async () => {
  const dir = await mkdtemp(join(tmpdir(), "econia-services-"));
  let calls = 0;
  const opts = {
    path: join(dir, "services.sqlite"),
    resolveAgent,
    apiKey: "test",
    model: "test",
    dailyAiLimit: 1,
    fetchImpl: async () => {
      calls++;
      return response({
        findings: [
          { heading: "Requested work", sourceId: "S1", quote: source },
        ],
      });
    },
  };
  let w = createServiceWorkforce(opts);
  try {
    const t = await w.submit("customer.near", {
      agentId: "person_199",
      input: source,
      requestId: "durable-001",
    });
    await w.execute(t.id);
    assert.equal(w.task("customer.near", t.id).status, "REVIEW_READY");
    await w.close();
    w = createServiceWorkforce(opts);
    await w.execute(t.id);
    assert.equal(calls, 1);
    await assert.rejects(
      w.submit("other.near", {
        agentId: "person_199",
        input: source,
        requestId: "durable-002",
      }),
      /allowance reached/,
    );
  } finally {
    await w.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("Owner transfers before execution block old instructions without inference", async () => {
  let owner = MAINNET_CONTRACT,
    calls = 0;
  const w = createServiceWorkforce({
    path: ":memory:",
    resolveAgent: async () => ({ ownerId: owner, paused: false }),
    apiKey: "test",
    model: "test",
    fetchImpl: async () => {
      calls++;
    },
  });
  try {
    const t = await w.submit("customer.near", {
      agentId: "person_199",
      input: source,
      requestId: "transfer-001",
    });
    owner = "buyer.near";
    await w.execute(t.id);
    assert.equal(calls, 0);
    assert.equal(w.task("customer.near", t.id).status, "FAILED_CHECKS");
  } finally {
    await w.close();
  }
});
test("Signed service login checks a real NEP-413 signature and rejects replay and a wrong account", async () => {
  const key = KeyPair.fromRandom("ed25519"),
    provider = { viewAccessKey: async () => ({ permission: "FullAccess" }) };
  const auth = createServiceAuth({ provider });
  const challenge = auth.challenge("customer.near");
  const account = new Account("customer.near", provider, key.toString());
  const signed = await signMessage({
    signerAccount: account,
    payload: {
      message: challenge.message,
      recipient: challenge.recipient,
      nonce: Buffer.from(challenge.nonce, "base64"),
    },
  });
  const proof = {
    challengeId: challenge.id,
    accountId: "customer.near",
    publicKey: key.getPublicKey().toString(),
    signature: Buffer.from(signed.signature).toString("base64"),
  };
  const session = await auth.login(proof);
  assert.equal(auth.require("Bearer " + session.token), "customer.near");
  await assert.rejects(auth.login(proof), /Expired/);
  auth.logout("Bearer " + session.token);
  assert.throws(() => auth.require("Bearer " + session.token), /Sign in/);
});
