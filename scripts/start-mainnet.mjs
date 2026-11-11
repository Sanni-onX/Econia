process.env.SETTLEMENT_MODE = "mainnet";
if (process.env.RAILWAY_PROJECT_ID && process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  const { resolve, sep } = await import("node:path");
  if (
    !resolve(
      process.env.SERVICE_DATABASE_PATH || ".data/econia-services.sqlite",
    ).startsWith(resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH) + sep)
  )
    throw Error(
      "SERVICE_DATABASE_PATH must be inside the attached Railway volume.",
    );
}
if (process.env.RAILWAY_PROJECT_ID && !process.env.RAILWAY_VOLUME_MOUNT_PATH)
  throw Error(
    "Attach a Railway persistent volume at /app/.data before starting Econia. Jobs and spending reservations must survive redeployments.",
  );
process.env.PORT ||= process.env.MAINNET_PORT || "3004";
const { createApplication } = await import("../apps/api/server.mjs");
const app = await createApplication();
app.server.listen(
  Number(process.env.PORT),
  process.env.HOST ||
    (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  () =>
    console.log(
      `Econia native NEAR mainnet: http://127.0.0.1:${process.env.PORT}`,
    ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => app.close().then(() => process.exit()));
