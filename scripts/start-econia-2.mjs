process.env.PORT ||= "3005";
const network = process.env.ECONIA_2_NETWORK || "testnet";
if (!["testnet", "mainnet"].includes(network))
  throw Error("Explicit NEAR network required");
if (!process.env.RAILWAY_PROJECT_ID) {
  const { existsSync, readFileSync } = await import("node:fs");
  const path =
    network === "mainnet"
      ? ".private/econia-2-mainnet-operator.json"
      : ".private/econia-2-operator.json";
  if (existsSync(path)) {
    const operator = JSON.parse(readFileSync(path, "utf8"));
    if (
      operator.network !== network ||
      (network === "mainnet" && operator.contract.endsWith(".testnet"))
    )
      throw Error("Local operator network mismatch");
    process.env[
      network === "mainnet"
        ? "ECONIA_2_MAINNET_CONTRACT"
        : "ECONIA_2_TESTNET_CONTRACT"
    ] ||= operator.contract;
    process.env.ECONIA_2_OPERATOR_KEY ||= operator.secretKey;
  }
}
if (process.env.RAILWAY_PROJECT_ID) {
  const { resolve, sep } = await import("node:path");
  if (!process.env.RAILWAY_VOLUME_MOUNT_PATH)
    throw Error("Persistent Railway volume required");
  const path =
    process.env.ECONIA_2_DATABASE_PATH ||
    `/app/.data/econia-2-${network}.sqlite`;
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
