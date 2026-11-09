import test from "node:test";
import assert from "node:assert/strict";
import {
  walletChoices,
  connectionFromState,
  connectWallet,
  walletErrorMessage,
  nonceFromChallenge,
} from "../apps/web/src/wallets.mjs";

test("wallet session uses the selected provider and its active account", () => {
  const state = {
    selectedWalletId: "nightly",
    accounts: [
      { accountId: "one.testnet", active: false },
      { accountId: "two.testnet", active: true },
    ],
  };
  assert.equal(connectionFromState(state).account, "two.testnet");
  assert.equal(
    connectionFromState({ ...state, selectedWalletId: null }).account,
    null,
  );
  assert.equal(
    connectionFromState({
      selectedWalletId: "nightly",
      accounts: [{ accountId: "" }],
    }).account,
    null,
  );
  assert.ok(walletChoices.some((w) => w.id === "nightly"));
  assert.equal(new Set(walletChoices.map((w) => w.id)).size, 5);
});
test("already exposed extension accounts still complete Selector sign-in", async () => {
  let signedIn = false;
  const state = { selectedWalletId: null, accounts: [] };
  const selector = {
    wallet: async (id) => ({
      getAccounts: async () => [{ accountId: "existing.testnet" }],
      signIn: async () => {
        signedIn = true;
        state.selectedWalletId = id;
        state.accounts = [{ accountId: "existing.testnet", active: true }];
      },
    }),
    store: { getState: () => state },
  };
  const result = await connectWallet(selector, "nightly");
  assert.equal(signedIn, true);
  assert.equal(result.walletId, "nightly");
  assert.equal(result.account, "existing.testnet");
});
test("cancelled or redirecting connections never fabricate a connected account", async () => {
  const selector = {
    wallet: async () => ({ signIn: async () => [] }),
    store: { getState: () => ({ selectedWalletId: null, accounts: [] }) },
  };
  assert.equal(await connectWallet(selector, "my-near-wallet"), null);
  await assert.rejects(connectWallet(selector, "unsupported"), /supported/);
  selector.wallet = async () => ({
    signIn: async () => {
      throw new Error("User rejected request");
    },
  });
  await assert.rejects(connectWallet(selector, "nightly"), /rejected/);
  assert.match(
    walletErrorMessage(
      new Error("Nightly wallet not injected within timeout"),
      "nightly",
    ),
    /NEAR Testnet/,
  );
  assert.match(
    walletErrorMessage(new Error("User rejected request"), "nightly"),
    /cancelled/,
  );
});
test("NEP-413 nonce is a Buffer of exactly 32 bytes", () => {
  const bytes = Uint8Array.from({ length: 32 }, (_, i) => i),
    base64 = Buffer.from(bytes).toString("base64");
  const nonce = nonceFromChallenge(base64);
  assert.deepEqual([...nonce], [...bytes]);
  assert.equal(nonce.constructor.isBuffer(nonce), true);
  assert.throws(() => nonceFromChallenge("abcd"), /Invalid strategy challenge/);
});
