export function validateProfessionalConfig(config) {
  if (
    config?.mode !== "professional" ||
    !["mainnet", "testnet"].includes(config.network)
  )
    throw Error(
      "A professional Econia service with an explicit NEAR network is required",
    );
  return config;
}
