import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  base58,
  parseWeb3Input,
  runWeb3Service,
  validateWeb3Report,
  WEB3_SERVICES,
} from "../packages/agent-sdk/web3-tools.mjs";
import { createServiceWorkforce } from "../packages/agent-sdk/service-workforce.mjs";
import { MAINNET_CONTRACT } from "../packages/shared/native-state.mjs";
const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]),
  codeHash = base58(createHash("sha256").update(wasm).digest());
function chain({ mismatch = false, wrongCode = false, badToken = false } = {}) {
  return async (method, p) => {
    if (method === "block")
      return { header: { hash: "final-block", height: 99 } };
    assert.equal(p.block_id, "final-block");
    if (method === "EXPERIMENTAL_protocol_config")
      return {
        runtime_config: { storage_amount_per_byte: "10000000000000000000" },
      };
    const block = {
      block_hash: mismatch ? "other-block" : "final-block",
      block_height: 99,
    };
    if (p.request_type === "view_account")
      return {
        ...block,
        amount: "2000000000000000000000000",
        locked: "1000000000000000000000000",
        storage_usage: 100,
        code_hash: wrongCode ? "wrong" : codeHash,
      };
    if (p.request_type === "view_access_key_list")
      return {
        ...block,
        keys: [
          {
            public_key: "ed25519:example",
            access_key: { permission: "FullAccess" },
          },
          {
            public_key: "ed25519:limited",
            access_key: {
              permission: {
                FunctionCall: {
                  receiver_id: "contract.near",
                  method_names: [],
                  allowance: null,
                },
              },
            },
          },
        ],
      };
    if (p.request_type === "view_code")
      return { ...block, code_base64: wasm.toString("base64"), hash: codeHash };
    const args = JSON.parse(Buffer.from(p.args_base64, "base64"));
    const value =
      p.method_name === "nft_token"
        ? {
            token_id: badToken ? "different" : args.token_id,
            owner_id: "owner.near",
            approved_account_ids: { "market.near": 3 },
          }
        : p.method_name === "ft_metadata"
          ? { name: "Example", symbol: "EX", decimals: 24 }
          : "1000000000000000000000001";
    return { ...block, result: [...Buffer.from(JSON.stringify(value))] };
  };
}
test("Web3 input rejects arbitrary URLs, network overrides and testnet targets", () => {
  assert.throws(
    () => parseWeb3Input("near-account", "http://localhost/admin"),
    /mainnet/,
  );
  assert.throws(
    () => parseWeb3Input("near-contract", "contract.testnet"),
    /mainnet/,
  );
  assert.throws(
    () =>
      parseWeb3Input(
        "near-token",
        '{"contract":"token.near","accountId":"owner.near","rpc":"https://evil.example"}',
      ),
    /Unknown/,
  );
  assert.deepEqual(parseWeb3Input("near-account", "near"), {
    accountId: "near",
  });
});
test("Account report reconciles native storage and locked stake without subtracting storage twice", async () => {
  const r = await runWeb3Service("near-account", "account.near", {
    rpc: chain(),
  });
  assert.equal(r.data.totalNear, "3");
  assert.equal(r.data.availableEstimateNear, "2");
  assert.equal(r.data.permissions[1].type, "FunctionCall");
  assert.equal(r.blockHash, "final-block");
  r.data.availableEstimateYocto = "0";
  assert.throws(() => validateWeb3Report("near-account", r), /reconciliation/);
});
test("Code inspector validates the downloaded hash and never executes WASM", async () => {
  const r = await runWeb3Service("near-contract", "contract.near", {
    rpc: chain(),
  });
  assert.equal(r.data.codeHash, codeHash);
  assert.equal(r.data.executionPerformed, false);
  assert.deepEqual(r.data.exports, []);
  await assert.rejects(
    runWeb3Service("near-contract", "contract.near", {
      rpc: chain({ wrongCode: true }),
    }),
    /hash does not match/,
  );
});
test("NFT verifier matches actual owner, validates token identity and reports a mismatched claim honestly", async () => {
  const input =
    '{"contract":"collection.near","tokenId":"1","claimedOwner":"buyer.near"}';
  const r = await runWeb3Service("near-nft", input, { rpc: chain() });
  assert.equal(r.data.ownerId, "owner.near");
  assert.equal(r.data.ownerMatchesClaim, false);
  await assert.rejects(
    runWeb3Service("near-nft", input, { rpc: chain({ badToken: true }) }),
    /identity mismatch/,
  );
});
test("Token balances preserve yocto precision, and cross-block responses are rejected", async () => {
  const r = await runWeb3Service(
    "near-token",
    '{"contract":"token.near","accountId":"owner.near"}',
    { rpc: chain() },
  );
  assert.equal(r.data.balanceFormatted, "1.000000000000000000000001");
  await assert.rejects(
    runWeb3Service("near-account", "account.near", {
      rpc: chain({ mismatch: true }),
    }),
    /not pinned/,
  );
});
test("Every Web3 worker completes the durable checked-artifact workflow with zero inference", async () => {
  let aiCalls = 0;
  const w = createServiceWorkforce({
    path: ":memory:",
    resolveAgent: async () => ({ ownerId: MAINNET_CONTRACT, paused: false }),
    web3Rpc: chain(),
    fetchImpl: async () => {
      aiCalls++;
      throw Error("No AI expected");
    },
    accountTaskLimit: 4,
  });
  const inputs = [
    "account.near",
    "contract.near",
    '{"contract":"collection.near","tokenId":"1"}',
    '{"contract":"token.near","accountId":"owner.near"}',
  ];
  try {
    for (let i = 0; i < 4; i++) {
      const t = await w.submit("customer.near", {
        agentId: WEB3_SERVICES[i].agentId,
        input: inputs[i],
        requestId: "web3-task-" + i,
      });
      await w.execute(t.id);
      const done = w.task("customer.near", t.id);
      assert.equal(done.status, "REVIEW_READY", done.error);
      assert.equal(done.trace.at(-1).tool, "chain-report-check");
      assert.match(done.output.artifact, /final-block/);
    }
    assert.equal(aiCalls, 0);
    assert.equal(w.status().aiCallsReserved, 0);
    assert.equal(w.status().activeCapacity, 7);
  } finally {
    await w.close();
  }
});
