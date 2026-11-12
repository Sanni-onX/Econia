import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KeyPair } from "near-api-js";
import { validateProfessionalConfig } from "../packages/shared/professional-config.mjs";
import { createProfessionalApplication } from "../apps/api/professional-server.mjs";
import { openAgentStore } from "../packages/agent-runtime/store.mjs";
import { createVerifiedLedger } from "../packages/agent-runtime/ledger.mjs";
import { createProfessionalRuntime } from "../packages/agent-runtime/runtime.mjs";
import {
  createProfessionalChain,
  proposalCommitment,
} from "../packages/near/professional-testnet.mjs";

test("Browser launch accepts mainnet and testnet professional services and rejects unknown configuration", () => {
  for (const network of ["mainnet", "testnet"])
    assert.equal(
      validateProfessionalConfig({ mode: "professional", network }).network,
      network,
    );
  for (const c of [
    { mode: "mainnet", network: "mainnet" },
    { mode: "professional", network: "unknown" },
    null,
  ])
    assert.throws(() => validateProfessionalConfig(c), /explicit NEAR network/);
});

test("Network/contract binding survives restart and rejects reuse of a testnet database on mainnet", () => {
  const dir = mkdtempSync(join(tmpdir(), "econia-chain-"));
  const path = join(dir, "state.sqlite");
  try {
    openAgentStore({
      path,
      network: "testnet",
      contract: "fixture.testnet",
    }).close();
    assert.throws(
      () =>
        openAgentStore({ path, network: "mainnet", contract: "fixture.near" }),
      /another network or contract/,
    );
    assert.throws(
      () =>
        openAgentStore({ path, network: "testnet", contract: "other.testnet" }),
      /another network or contract/,
    );
    openAgentStore({
      path,
      network: "testnet",
      contract: "fixture.testnet",
    }).close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Mainnet adapter rejects mixed RPC/contracts and full-access or oversized worker keys", async () => {
  const provider = { getNetworkId: async () => "testnet" };
  await assert.rejects(
    createProfessionalChain({
      network: "mainnet",
      contract: "fixture.near",
      provider,
    }),
    /matching NEAR/,
  );
  provider.getNetworkId = async () => "mainnet";
  await assert.rejects(
    createProfessionalChain({
      network: "mainnet",
      contract: "fixture.testnet",
      provider,
    }),
    /matching NEAR/,
  );
  const operatorKey = KeyPair.fromRandom("ed25519").toString();
  provider.viewAccessKey = async () => ({ permission: "FullAccess" });
  await assert.rejects(
    createProfessionalChain({
      network: "mainnet",
      contract: "fixture.near",
      provider,
      operatorKey,
    }),
    /method-restricted/,
  );
  provider.viewAccessKey = async () => ({
    permission: {
      FunctionCall: {
        receiver_id: "fixture.near",
        method_names: [
          "deliver_service_job",
          "open_agent_service_job",
          "accept_service_job",
        ],
        allowance: (2n * 10n ** 23n).toString(),
      },
    },
  });
  await assert.rejects(
    createProfessionalChain({
      network: "mainnet",
      contract: "fixture.near",
      provider,
      operatorKey,
    }),
    /allowance-capped/,
  );
  provider.viewAccessKey = async () => ({
    permission: {
      FunctionCall: {
        receiver_id: "fixture.near",
        method_names: [
          "deliver_service_job",
          "open_agent_service_job",
          "accept_service_job",
        ],
        allowance: (2n * 10n ** 22n).toString(),
      },
    },
  });
  const chain = await createProfessionalChain({
    network: "mainnet",
    contract: "fixture.near",
    provider,
    operatorKey,
  });
  assert.equal(chain.network, "mainnet");
  const refund = chain.prepareRefundWithdrawal();
  assert.equal(refund.receiverId, "fixture.near");
  assert.equal(refund.actions[0].params.methodName, "withdraw_refund");
  assert.equal(refund.actions[0].params.deposit, "1");
  const p = {
    id: "sample-proposal",
    provider_id: "person_017",
    service_id: "csv-audit",
    scope: "Audit supplied CSV",
    input_text: "a,b\n1,2",
    price: "1000000000000000000000",
  };
  assert.notEqual(
    proposalCommitment(p, "mainnet"),
    proposalCommitment(p, "testnet"),
  );
  assert.equal(chain.prepareFunding(p).receiverId, "fixture.near");
  assert.equal(
    chain.prepareFunding(p).actions[0].params.args.scope_hash,
    proposalCommitment(p, "mainnet"),
  );
});

test("Mainnet proposals and ledger use real NEAR and reject testnet receipts", async () => {
  const store = openAgentStore({
    path: ":memory:",
    network: "mainnet",
    contract: "fixture.near",
  });
  const runtime = createProfessionalRuntime({
    store,
    inference: { ready: false },
  });
  try {
    const p = runtime.contracts.propose({
      customerId: "client.near",
      providerId: "person_017",
      serviceId: "csv-audit",
      scope:
        "Compute exact decimal statistics for the supplied operational dataset.",
      input: "product,amount\nNotebook,0.10\nPen,0.20",
      price: "1000000000000000000000",
    });
    assert.equal(p.network_id, "mainnet");
    assert.equal(p.asset_id, "near:mainnet:NEAR");
    store.db
      .prepare("INSERT INTO receipts VALUES(?,?,?,?,?,?,?)")
      .run(
        "wrong-chain",
        "testnet",
        "fixture.testnet",
        "post_service_job",
        "client.near",
        "1",
        store.now(),
      );
    assert.throws(
      () =>
        createVerifiedLedger(store).record({
          receiptHash: "wrong-chain",
          debit: "wallet:client.near",
          credit: "escrow:job",
          amount: "1",
        }),
      /verified mainnet receipt/,
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

test("Refund API reads only the signed-in wallet and verifies withdrawals before confirmation", async () => {
  const store = openAgentStore({
    path: ":memory:",
    network: "mainnet",
    contract: "fixture.near",
  });
  const reads = [],
    confirmations = [];
  const chain = {
    refundableBalance: async (account) => {
      reads.push(account);
      return "100";
    },
    prepareRefundWithdrawal: () => ({
      receiverId: "fixture.near",
      actions: [
        {
          type: "FunctionCall",
          params: { methodName: "withdraw_refund", deposit: "1" },
        },
      ],
    }),
    receipt: async (hash, signer, method) => {
      confirmations.push({ hash, signer, method });
      return { deposit: "1", args: {} };
    },
  };
  const auth = {
    require: (header) => {
      if (header !== "Bearer verified-client")
        throw Object.assign(Error("Sign in required"), { status: 401 });
      return "client.near";
    },
  };
  const app = await createProfessionalApplication({
    network: "mainnet",
    contract: "fixture.near",
    store,
    settlement: chain,
    auth,
    inference: { ready: false },
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + app.server.address().port;
  const call = (path, body, signed = true) =>
    fetch(base + "/api/society/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        ...(signed ? { Authorization: "Bearer verified-client" } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    assert.equal((await call("wallet/refunds", null, false)).status, 401);
    assert.deepEqual(
      await (await call("wallet/refunds?account=someone-else.near")).json(),
      { network: "mainnet", amount: "100" },
    );
    assert.equal(
      (await (await call("wallet/refunds/withdraw", {})).json()).receiverId,
      "fixture.near",
    );
    assert.equal(
      (
        await (
          await call("wallet/refunds/confirm", {
            transactionHash: "verified-withdrawal",
          })
        ).json()
      ).verified,
      true,
    );
    assert.ok(reads.length >= 3 && reads.every((a) => a === "client.near"));
    assert.deepEqual(confirmations, [
      {
        hash: "verified-withdrawal",
        signer: "client.near",
        method: "withdraw_refund",
      },
    ]);
  } finally {
    await app.close();
    store.close();
  }
});
