process.env.SETTLEMENT_MODE = "mainnet";
process.env.PORT = process.env.MAINNET_PORT || "3004";
const { createApplication } = await import("../apps/api/server.mjs");
const app = await createApplication();
app.server.listen(
  Number(process.env.PORT),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Econia native NEAR mainnet: http://127.0.0.1:${process.env.PORT}`,
    ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => app.close().then(() => process.exit()));
