export const MAINNET_CONTRACT =
  "eb6dcf918cfef5feca6bb6ba7fbed6540a19b8d8a0112c69d6f996567f217d17";
export function formatNear(yocto) {
  const n = BigInt(yocto),
    fraction = (n % 10n ** 24n).toString().padStart(24, "0").replace(/0+$/, "");
  return `${n / 10n ** 24n}${fraction ? "." + fraction : ""}`;
}
export async function readNativeState({
  rpc,
  roster,
  contract = MAINNET_CONTRACT,
}) {
  const block = await rpc("block", { finality: "final" });
  const blockId = block.header.hash;
  const call = async (method_name, args) => {
    const answer = await rpc("query", {
      request_type: "call_function",
      block_id: blockId,
      account_id: contract,
      method_name,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    return JSON.parse(Buffer.from(answer.result).toString());
  };
  const custody = await call("custody", {});
  const tokens = await call("nft_tokens", { from_index: "0", limit: 100 });
  const records = await call("get_agents", {
    agent_ids: roster.map((a) => a.id),
  });
  const agents = roster.map((source) => {
    const token = tokens.find((t) => t.token_id === source.id);
    const state = records[source.id];
    if (Boolean(token) !== Boolean(state))
      throw Error("NFT identity reconciliation failed");
    return {
      ...source,
      legacyRole: source.role,
      role: "Unassigned",
      goal: "Awaiting a verified service capability and a funded task.",
      token,
      treasuryYocto: state?.treasury ?? "0",
      treasuryNear: formatNear(state?.treasury ?? "0"),
      paused: state?.paused ?? false,
      status: !token
        ? "Awaiting commissioning"
        : custody.paused
          ? "World paused"
          : state.paused
            ? "Owner paused"
            : "Ready for planning",
    };
  });
  const total = agents.reduce((n, a) => n + BigInt(a.treasuryYocto), 0n);
  if (total !== BigInt(custody.treasuries))
    throw Error("Treasury reconciliation failed");
  return {
    network: "mainnet",
    asset: "NEAR",
    contract,
    blockHeight: block.header.height,
    blockHash: blockId,
    verifiedAt: new Date().toISOString(),
    custody,
    agents,
  };
}
