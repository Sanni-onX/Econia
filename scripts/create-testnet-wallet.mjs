import { generateSeedPhrase, parseSeedPhrase } from "near-seed-phrase";
import { randomBytes } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const path = resolve(".private/near-testnet-wallet.json");
mkdirSync(resolve(".private"), { recursive: true });
let wallet;
if (existsSync(path)) wallet = JSON.parse(readFileSync(path, "utf8"));
else {
  const key = generateSeedPhrase(randomBytes(32));
  const recovered = parseSeedPhrase(key.seedPhrase);
  if (recovered.publicKey !== key.publicKey)
    throw new Error("Recovery verification failed");
  wallet = {
    network: "testnet",
    accountId: `econia-${randomBytes(5).toString("hex")}.testnet`,
    ...key,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(path, JSON.stringify(wallet, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
}
console.log(
  JSON.stringify({
    accountId: wallet.accountId,
    publicKey: wallet.publicKey,
    recoveryFile: path,
    recoveryVerified: true,
  }),
);
const rpc = async (method, params) => {
  const r = await fetch("https://test.rpc.fastnear.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  return r.json();
};
try {
  let state = await rpc("query", {
    request_type: "view_account",
    finality: "final",
    account_id: wallet.accountId,
  });
  if (state.error) {
    const response = await fetch("https://helper.testnet.near.org/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newAccountId: wallet.accountId,
        newAccountPublicKey: wallet.publicKey,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const result = await response.text();
    console.log(
      JSON.stringify({
        faucetStatus: response.status,
        result: result.slice(0, 350),
      }),
    );
  }
  state = await rpc("query", {
    request_type: "view_account",
    finality: "final",
    account_id: wallet.accountId,
  });
  if (state.error)
    throw new Error(
      "Wallet keys saved, but funded account is not yet visible on testnet",
    );
  console.log(
    JSON.stringify({
      accountId: wallet.accountId,
      funded: true,
      amountYocto: state.result.amount,
    }),
  );
} catch (error) {
  console.log(JSON.stringify({ funded: false, error: error.message }));
  process.exitCode = 2;
}
