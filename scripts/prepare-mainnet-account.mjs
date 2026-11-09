// Generates recovery material locally. Does not create/fund an onchain account.
import { generateSeedPhrase, parseSeedPhrase } from "near-seed-phrase";
import { KeyPair } from "near-api-js";
import { randomBytes } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
const path = ".private/near-mainnet-wallet.json";
mkdirSync(".private", { recursive: true });
if (!existsSync(path)) {
  const key = generateSeedPhrase(randomBytes(32));
  if (parseSeedPhrase(key.seedPhrase).publicKey !== key.publicKey)
    throw Error("Recovery check failed");
  const bytes = KeyPair.fromString(key.secretKey).getPublicKey().data;
  const accountId = Buffer.from(bytes).toString("hex");
  if (!/^[0-9a-f]{64}$/.test(accountId))
    throw Error("Invalid implicit address");
  writeFileSync(
    path,
    JSON.stringify(
      {
        network: "mainnet",
        accountId,
        ...key,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
}
const wallet = JSON.parse(readFileSync(path, "utf8"));
if (parseSeedPhrase(wallet.seedPhrase).publicKey !== wallet.publicKey)
  throw Error("Recovery mismatch");
console.log(
  JSON.stringify({
    network: wallet.network,
    accountId: wallet.accountId,
    prepared: true,
    onchainAccountCreated: false,
    recoveryVerified: true,
  }),
);
