import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openAgentStore } from "../packages/agent-runtime/store.mjs";
import { createProfessionalRuntime } from "../packages/agent-runtime/runtime.mjs";
const csv = "item,amount\nNotebook,0.10\nPen,0.20\nFolder,0.30\nTape,1.40";
const source = {
  filename: "records.csv",
  contentType: "text/csv",
  content: csv,
};
test("Source attachment bytes, hash and proposal input remain exact when the model rewrites the CSV", async () => {
  const store = openAgentStore({ path: ":memory:" });
  let calls = 0;
  const runtime = createProfessionalRuntime({
    store,
    inference: {
      ready: true,
      name: "explicit-source-fixture",
      infer: async ({ context }) => {
        calls++;
        assert.equal(context.sourceAttachments[0].content, csv);
        return {
          value: {
            action: "PROPOSE",
            message: "I can audit the attached exact source.",
            serviceId: "csv-audit",
            scope:
              "Compute exact numeric statistics and report missing cells from the supplied CSV.",
            input: csv.replaceAll("\n", "<br>"),
            priceYocto: "1",
            collaborators: [],
            sourceAttachmentId: context.sourceAttachments[0].id,
          },
        };
      },
    },
  });
  try {
    const c = await runtime.conversations.open("person_017", "client.testnet");
    const request = {
      content: "Please audit the attached source data.",
      requestId: "exact-source-001",
      attachments: [source],
    };
    const m = await runtime.conversations.send(c.id, "client.testnet", request);
    assert.equal(
      (await runtime.conversations.send(c.id, "client.testnet", request)).id,
      m.id,
    );
    await assert.rejects(
      () =>
        runtime.conversations.send(c.id, "client.testnet", {
          ...request,
          attachments: [{ ...source, content: csv + "\nChanged,99" }],
        }),
      /changed content or sources/,
    );
    await runtime.settle();
    const p = runtime.contracts.list("client.testnet")[0];
    assert.equal(calls, 1);
    assert.equal(p.input_text, csv);
    assert.equal(
      p.source.sha256,
      createHash("sha256").update(csv).digest("hex"),
    );
    const messages = await runtime.conversations.messages(
      c.id,
      "client.testnet",
    );
    assert.equal(messages[0].attachments.length, 1);
    assert.ok(!Object.hasOwn(messages[0].attachments[0], "content"));
    await assert.rejects(
      () => runtime.conversations.messages(c.id, "other.testnet"),
      /not found/,
    );
    await assert.rejects(
      () =>
        runtime.conversations.send(c.id, "client.testnet", {
          ...request,
          requestId: "oversized-source-001",
          attachments: [{ ...source, content: "x".repeat(16001) }],
        }),
      /16 KB/,
    );
  } finally {
    await runtime.close();
    store.close();
  }
});
test("Malformed CSV proposals are rejected before any payment request", async () => {
  const store = openAgentStore({ path: ":memory:" }),
    runtime = createProfessionalRuntime({ store, inference: { ready: false } });
  try {
    assert.throws(
      () =>
        runtime.contracts.propose({
          customerId: "client.testnet",
          providerId: "person_017",
          serviceId: "csv-audit",
          scope: "Compute exact statistics from the supplied customer CSV.",
          input: csv.replaceAll("\n", "<br>"),
          price: "1",
        }),
      /CSV/,
    );
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM proposals").get().n,
      0,
    );
    assert.equal(
      store.db.prepare("SELECT count(*) n FROM ledger_transfers").get().n,
      0,
    );
  } finally {
    await runtime.close();
    store.close();
  }
});
