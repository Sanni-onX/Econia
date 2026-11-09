process.env.SETTLEMENT_MODE = "testnet";
process.env.AGENT_MODE ||= "near-ai";
process.env.ECONIA_DATA_PATH ||= ".data/econia-testnet.sqlite";
process.env.PORT ||= "3003";
process.env.SIMULATION_INTERVAL_MS ||= "30000";
const { readFileSync, writeFileSync, existsSync, mkdirSync } =
  await import("node:fs");
const { randomBytes } = await import("node:crypto");
const tokenPath = ".private/testnet-admin-token";
if (!process.env.ADMIN_TOKEN) {
  mkdirSync(".private", { recursive: true });
  if (!existsSync(tokenPath))
    writeFileSync(tokenPath, randomBytes(24).toString("hex"), { mode: 0o600 });
  process.env.ADMIN_TOKEN = readFileSync(tokenPath, "utf8").trim();
}
const { createApplication } = await import("../apps/api/server.mjs");
const app = await createApplication();
app.server.listen(
  Number(process.env.PORT),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Econia real ECO testnet world: http://127.0.0.1:${process.env.PORT}`,
    ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => app.close().then(() => process.exit()));
