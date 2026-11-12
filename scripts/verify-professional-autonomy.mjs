import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Account, JsonRpcProvider, actions } from "near-api-js";
import { signMessage } from "near-api-js/nep413";
import { openAgentStore } from "../packages/agent-runtime/store.mjs";
import { createProfessionalApplication } from "../apps/api/professional-server.mjs";
import { createProfessionalTestnet } from "../packages/near/professional-testnet.mjs";
process.env.SERVICE_DAILY_AI_CALL_LIMIT ||= "18";
if (!process.argv.includes("--testnet"))
  throw Error("Explicit testnet required");
const wallet = JSON.parse(
    readFileSync(".private/econia-2-testnet-wallet.json", "utf8"),
  ),
  owner = JSON.parse(readFileSync(".private/near-testnet-wallet.json", "utf8"));
if (wallet.network !== "testnet" || owner.network !== "testnet")
  throw Error("Testnet only");
const provider = new JsonRpcProvider({
  url: process.env.NEAR_TESTNET_RPC_URL || "https://test.rpc.fastnear.com",
});
if ((await provider.getNetworkId()) !== "testnet") throw Error("RPC mismatch");
const account = new Account(owner.accountId, provider, owner.secretKey);
const store = openAgentStore({
  path: ".data/professional-autonomy-commissioning.sqlite",
});
const chain = await createProfessionalTestnet({
  contract: wallet.accountId,
  operatorKey: wallet.operatorSecretKey,
  provider,
  store,
});
const app = await createProfessionalApplication({
  store,
  provider,
  contract: wallet.accountId,
  settlement: chain,
});
await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + app.server.address().port;
let token;
const api = async (path, body) => {
  const r = await fetch(base + "/api/society/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = await r.json();
  if (!r.ok) throw Error(value.error || "API error");
  return value;
};
const transactions = [];
async function sign(tx, method) {
  const p = tx.actions?.[0]?.params;
  if (
    tx.receiverId !== wallet.accountId ||
    tx.actions?.length !== 1 ||
    p?.methodName !== method ||
    BigInt(p.deposit) > 12n * 10n ** 22n
  )
    throw Error("Testnet commissioning scope exceeded");
  const r = await account.signAndSendTransaction({
    receiverId: tx.receiverId,
    actions: [
      actions.functionCall(method, p.args, BigInt(p.gas), BigInt(p.deposit)),
    ],
    waitUntil: "FINAL",
  });
  if (!Object.hasOwn(r.status || {}, "SuccessValue"))
    throw Error("Owner testnet setup failed");
  transactions.push({ method, hash: r.transaction.hash });
  console.log(JSON.stringify(transactions.at(-1)));
  return r.transaction.hash;
}
async function drain() {
  for (let i = 0; i < 25; i++) {
    await app.runtime.settle();
    if (
      !app.runtime.jobs().some((j) => ["QUEUED", "RUNNING"].includes(j.state))
    )
      return;
  }
  throw Error("Queue did not settle within bounded commissioning run");
}
try {
  if (
    store.db.prepare("SELECT id FROM opportunities").get() &&
    !process.argv.includes("--new-budget") &&
    !process.argv.includes("--resume-decision") &&
    !process.argv.includes("--clarify") &&
    !process.argv.includes("--continue") &&
    !process.argv.includes("--revise")
  )
    throw Error(
      "Existing autonomous commissioning exists; inspect its evidence before rerunning funding",
    );
  const challenge = await api("auth/challenge", { accountId: owner.accountId }),
    signed = await signMessage({
      signerAccount: account,
      payload: {
        message: challenge.message,
        recipient: challenge.recipient,
        nonce: Buffer.from(challenge.nonce, "base64"),
      },
    });
  token = (
    await api("auth/login", {
      challengeId: challenge.id,
      accountId: owner.accountId,
      publicKey: owner.publicKey,
      signature: Buffer.from(signed.signature).toString("base64"),
    })
  ).token;
  if (process.argv.includes("--revise")) {
    const failures = store.db
      .prepare(
        "SELECT c.id,p.service_id FROM contracts c JOIN proposals p ON p.id=c.proposal_id WHERE c.state IN ('FUNDED','WORKING') AND EXISTS(SELECT j.id FROM runtime_jobs j WHERE j.reference_id=c.id AND j.kind='EXECUTE' AND j.state='INTERRUPTED') AND NOT EXISTS(SELECT d.id FROM deliverables d WHERE d.contract_id=c.id)",
      )
      .all();
    for (const c of failures)
      await api("contracts/" + c.id + "/revision", {
        feedback:
          c.service_id === "evidence-brief"
            ? "Customer requests a corrected evidence brief. Copy only continuous exact substrings from the provided numbered source texts, with the matching source ID. Do not unescape embedded JSON, paraphrase, shorten with ellipses or invent quotes. Prefer the plain-text project facts. One to three grounded findings suffice."
            : "Customer requests a corrected design specification. Palette must contain actual six-digit hex codes (for example #304B3B), never color names. Keep typography under 500 characters and use two to five concise principles. Deliver final original design content rather than a transcript or completion report.",
      });
  } else if (process.argv.includes("--continue")) {
    // Reconcile persisted financial continuations without repeating inference.
  } else if (process.argv.includes("--clarify")) {
    for (const t of store.db
      .prepare(
        "SELECT t.* FROM agent_threads t WHERE t.is_prime=0 AND (t.state='DECLINED' OR EXISTS(SELECT id FROM runtime_jobs j WHERE j.reference_id=t.id AND j.state='INTERRUPTED'))",
      )
      .all()) {
      app.runtime.collaboration.clarify(
        t.id,
        owner.accountId,
        "Customer clarification: your assignment is only " +
          t.service_id +
          " for the supplied Hearth & Grain facts. You are not responsible for the complete website, hiring the other professions, deployment or physical fulfillment. The trusted service tools can produce your catalogued downloadable files from structured content. The project already has its software lead and other specialists; do not request extra collaborators. Independently quote only your own supported deliverable, or explain an actual remaining blocker.",
      );
    }
  } else if (process.argv.includes("--resume-decision")) {
    const interrupted = store.db
      .prepare(
        "SELECT j.id FROM runtime_jobs j JOIN inference_outputs o ON o.job_id=j.id WHERE j.kind IN ('OPPORTUNITY','NEGOTIATE','REVIEW_DELIVERY') AND j.state='INTERRUPTED' ORDER BY j.rowid DESC LIMIT 1",
      )
      .get();
    if (!interrupted) throw Error("No stored decision to resume");
    app.runtime.resumeStoredDecision(interrupted.id);
  } else if (!process.argv.includes("--resume")) {
    if (!process.argv.includes("--new-budget")) {
      const thread = await api("conversations", {
        agentId: "person_199",
        kind: "OWNER",
      });
      const brief =
        "Owner strategy for this testnet commissioning: Mira, develop your hospitality practice by commissioning a useful self-contained static website. Your operating budget will be granted separately. Prefer Dev #042 for the software engagement. Ask him to commission a research professional for a source-grounded evidence brief and a design professional for a coherent styleboard, then use their actual checked files in the website. The brief facts are: Hearth & Grain is Mira’s proposed neighborhood catering practice. It offers menu planning and supplied-supplier procurement comparison. Visitors first share guest count, event date and dietary constraints. There is no public address, email, checkout or physical fulfillment. Do not invent customers, income, ingredients or prices. Website sections: About, Catering Services, How It Works; warm restrained colors, accessible contrast. This is explicitly a digital planning commission. Research must quote these supplied facts exactly; no web browsing is required. Work must be a real downloadable website, SVG styleboard and evidence brief. Total allowed spend is at most 0.08 valueless testnet NEAR; actual authority will be onchain. Please acknowledge this strategy only now, without proposing a paid hospitality service or starting work. Preserve your hospitality profession.";
      await api("conversations/" + thread.id + "/messages", {
        content: brief,
        requestId: "autonomy-owner-" + randomUUID(),
      });
      await drain();
    }
    const treasury = BigInt(
      (await chain.view("get_professional", { agent_id: "person_199" }))
        .treasury,
    );
    if (treasury < 12n * 10n ** 22n) {
      const tx = await api("agents/person_199/capital", { amount: "0.12" });
      const h = await sign(tx, "provide_capital");
      await api("agents/person_199/confirm-capital", { transactionHash: h });
    }
    const budget = await api("agents/person_199/budget", {
      remaining: "0.08",
      perJob: "0.08",
      allowedServices: ["website-build", "design-spec", "evidence-brief"],
      autoAccept: true,
    });
    const h = await sign(budget, "authorize_budget");
    await api("agents/person_199/confirm-budget", { transactionHash: h });
  } else {
    const prior = store.db
      .prepare(
        "SELECT tx_hash FROM receipts WHERE method='authorize_budget' AND signer=? ORDER BY rowid DESC LIMIT 1",
      )
      .get(owner.accountId);
    if (!prior) throw Error("No verified setup budget to resume");
    await api("agents/person_199/confirm-budget", {
      transactionHash: prior.tx_hash,
    });
  }
  await drain();
  const project = store.db.prepare("SELECT * FROM agent_projects").get();
  if (!project)
    throw Error(
      "Mira did not initiate a professional purchase; inspect persisted reasoning without inventing a project",
    );
  const p = app.runtime.contracts.requireProposal(
      project.proposal_id,
      owner.accountId,
    ),
    row = store.db
      .prepare("SELECT id FROM contracts WHERE proposal_id=?")
      .get(p.id);
  const jobs = app.runtime
    .jobs()
    .map(({ id, agent_id, kind, state, error }) => ({
      id,
      agent_id,
      kind,
      state,
      error,
    }));
  if (!row)
    throw Error("Project has no verified funding: " + JSON.stringify(jobs));
  const c = app.runtime.contracts.requireContract(row.id, owner.accountId),
    live = await chain.view("get_service_job", {
      job_id: Number(c.chain_job_id),
    });
  const files = app.runtime.contracts.artifacts(c.id, owner.accountId);
  const verified =
    c.state === "SETTLED" &&
    live.state === "SETTLED" &&
    p.provider_id === "person_042" &&
    p.allocations.some((a) => a.service_id === "design-spec") &&
    p.allocations.some((a) => a.service_id === "evidence-brief");
  const report = {
    verified,
    network: "testnet",
    verifiedAt: store.now(),
    buyer: "person_199",
    owner: owner.accountId,
    project,
    proposal: p,
    contract: c,
    onchainJob: live,
    jobs,
    transactions,
    quotations: app.runtime.collaboration.quotes(p.id),
    decisions: store.db
      .prepare("SELECT * FROM project_decisions WHERE proposal_id=?")
      .all(p.id),
    ledger: store.db.prepare("SELECT * FROM ledger_transfers").all(),
    artifacts: files,
  };
  mkdirSync("docs/service-examples/autonomous", { recursive: true });
  for (const f of files)
    writeFileSync(
      "docs/service-examples/autonomous/" + f.agent_id + "-" + f.filename,
      app.runtime.contracts.artifact(f.id, owner.accountId).content,
    );
  writeFileSync(
    "docs/professional-autonomy-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      verified,
      state: c.state,
      allocations: p.allocations.map((a) => ({
        agent: a.agent_id,
        service: a.service_id,
      })),
      files: files.map((f) => f.filename),
      interrupted: jobs.filter((j) => j.state === "INTERRUPTED"),
    }),
  );
  if (!verified)
    throw Error(
      "Autonomous acceptance journey remains incomplete; real evidence saved",
    );
} finally {
  await app.close();
  store.close();
}
