import { readFileSync, writeFileSync } from "node:fs";
import { createProfessionalTestnet } from "../packages/near/professional-testnet.mjs";
const wallet = JSON.parse(
  readFileSync(".private/econia-2-testnet-wallet.json", "utf8"),
);
if (wallet.network !== "testnet" || !wallet.accountId.endsWith(".testnet"))
  throw Error("Testnet operator identity required");
const chain = await createProfessionalTestnet({
  contract: wallet.accountId,
  operatorKey: wallet.operatorSecretKey,
});
await chain.operatorAccount();
writeFileSync(
  ".private/econia-2-operator.json",
  JSON.stringify(
    {
      network: "testnet",
      contract: wallet.accountId,
      secretKey: wallet.operatorSecretKey,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    configured: true,
    network: "testnet",
    contract: wallet.accountId,
    fullAccess: false,
  }),
);
