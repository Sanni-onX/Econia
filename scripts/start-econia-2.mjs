process.env.PORT ||= "3005";
if (process.env.ECONIA_2_NETWORK && process.env.ECONIA_2_NETWORK !== "testnet")
  throw Error(
    "The Econia 2.0 prototype only supports valueless testnet settlement",
  );
if (process.env.RAILWAY_PROJECT_ID) {
  const { resolve, sep } = await import("node:path");
  if (!process.env.RAILWAY_VOLUME_MOUNT_PATH)
    throw Error("Persistent Railway volume required");
  const path =
    process.env.ECONIA_2_DATABASE_PATH || "/app/.data/econia-2.sqlite";
  if (
    !resolve(path).startsWith(
      resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH) + sep,
    )
  )
    throw Error("Econia 2.0 database must be inside the persistent volume");
  process.env.ECONIA_2_DATABASE_PATH = path;
}
const { createProfessionalApplication } =
  await import("../apps/api/professional-server.mjs");
const app = await createProfessionalApplication();
app.server.listen(
  Number(process.env.PORT),
  process.env.HOST ||
    (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  () =>
    console.log(
      `Econia 2.0 professional world: http://127.0.0.1:${process.env.PORT}`,
    ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => app.close().then(() => process.exit()));
