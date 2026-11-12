export function assertNetwork(network) {
  if (!["testnet", "mainnet"].includes(network))
    throw Error("Explicit NEAR mainnet or testnet network required");
  return network;
}
export const assetId = (network) => `near:${assertNetwork(network)}:NEAR`;
