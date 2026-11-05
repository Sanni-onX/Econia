import { NearTestnetEcoAdapter } from "../packages/shared/near.mjs";
import { openRepository } from "../packages/database/index.mjs";
const adapter = new NearTestnetEcoAdapter({
  ecoContract: process.env.ECO_CONTRACT,
  worldContract: process.env.WORLD_CONTRACT,
  rpcUrl: process.env.NEAR_RPC_URL,
});
const repo = await openRepository();
try {
  const w = await repo.load();
  if (!w) throw new Error("No world checkpoint");
  if (w.mode === "sandbox")
    throw new Error(
      "Local simulation units are not ECO. Commission a funded testnet genesis before reconciliation.",
    );
  const report = await adapter.reconcile(Object.values(w.entities));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.balanced ? 0 : 1;
} finally {
  await repo.close();
}
