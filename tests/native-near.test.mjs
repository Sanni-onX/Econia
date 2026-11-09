import test from "node:test";
import assert from "node:assert/strict";
import {
  parseNear,
  nativeTransaction,
  operatingCapitalTransaction,
} from "../packages/shared/native-near.mjs";
test("native NEAR amounts preserve all 24 decimals without floating point", () => {
  assert.equal(
    parseNear("1.000000000000000000000001"),
    "1000000000000000000000001",
  );
  for (const value of [0.1, "-1", "1e3", "0.0000000000000000000000001"])
    assert.throws(() => parseNear(value));
});
test("operating capital is a native deposit and rejects cross-network recipients", () => {
  const tx = operatingCapitalTransaction(
    { network: "mainnet", contract: "econia.near" },
    "mira",
    "0.1",
  );
  assert.equal(tx.actions[0].params.methodName, "provide_capital");
  assert.equal(tx.actions[0].params.deposit, "100000000000000000000000");
  assert.throws(() =>
    nativeTransaction({
      network: "mainnet",
      contract: "world.econia.testnet",
      method: "provide_capital",
    }),
  );
});
