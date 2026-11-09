const YOCTO = 10n ** 24n;
export function parseNear(value) {
  if (
    typeof value !== "string" ||
    !/^\d+(\.\d{1,24})?$/.test(value) ||
    value.length > 60
  )
    throw Error("Use an exact NEAR decimal string");
  const [whole, fraction = ""] = value.split(".");
  return (BigInt(whole) * YOCTO + BigInt(fraction.padEnd(24, "0"))).toString();
}
export function nativeTransaction({
  contract,
  method,
  args = {},
  deposit = "0",
  network,
}) {
  if (
    !["mainnet", "testnet"].includes(network) ||
    typeof contract !== "string" ||
    !/^[a-z0-9._-]{2,64}$/.test(contract)
  )
    throw Error("Explicit network and valid contract required");
  if (network === "mainnet" && contract.endsWith(".testnet"))
    throw Error("Testnet contract cannot receive mainnet funds");
  return {
    receiverId: contract,
    actions: [
      {
        type: "FunctionCall",
        params: {
          methodName: method,
          args,
          gas: "80000000000000",
          deposit: parseNear(deposit),
        },
      },
    ],
  };
}
export function operatingCapitalTransaction(config, agentId, amount) {
  if (
    typeof agentId !== "string" ||
    !agentId ||
    agentId.length > 64 ||
    BigInt(parseNear(amount)) === 0n
  )
    throw Error("Agent and positive capital required");
  return nativeTransaction({
    ...config,
    method: "provide_capital",
    args: { agent_id: agentId },
    deposit: amount,
  });
}
