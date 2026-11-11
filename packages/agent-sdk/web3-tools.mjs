import { createHash } from "node:crypto";
export const WEB3_SERVICES = Object.freeze([
  {
    id: "near-account",
    agentId: "person_103",
    label: "NEAR account analyst",
    description:
      "Inspect native balances, storage backing and access-key permissions at a finalized block.",
    aiCalls: 0,
    inputLabel: "NEAR mainnet account",
    placeholder: "account.near",
    minInputLength: 2,
    tools: ["finalized-account", "storage-backing", "access-key-inventory"],
    checks: [
      "All reads pinned to one finalized block",
      "Balance arithmetic reconciled using protocol storage cost",
    ],
    review:
      "A point-in-time account inventory, not a complete portfolio, security verdict or investment recommendation.",
  },
  {
    id: "near-contract",
    agentId: "person_104",
    label: "Contract interface inspector",
    description:
      "Verify deployed code hashes and list WASM exports without executing the contract.",
    aiCalls: 0,
    inputLabel: "NEAR mainnet contract",
    placeholder: "contract.near",
    minInputLength: 2,
    tools: [
      "finalized-contract-code",
      "code-hash-match",
      "wasm-export-inspection",
    ],
    checks: [
      "Local WASM hash matches the account hash when local code is present",
      "Code is never instantiated or executed",
    ],
    review:
      "Interface inspection only. Export names do not establish permissions, mutability, source equivalence or freedom from vulnerabilities.",
  },
  {
    id: "near-nft",
    agentId: "person_105",
    label: "NFT ownership verifier",
    description:
      "Verify a specific NFT owner and its approval records from the collection contract.",
    aiCalls: 0,
    inputLabel: "NFT request as JSON",
    placeholder:
      '{"contract":"collection.near","tokenId":"1","claimedOwner":"owner.near"}',
    minInputLength: 2,
    tools: ["nep171-token-view", "nft-owner-comparison", "approval-inventory"],
    checks: [
      "Token ID matches the requested identity",
      "Owner and approval data validated at the same finalized block",
    ],
    review:
      "The queried collection reports this ownership. This does not authenticate artwork, issuer legitimacy, provenance history or sale value.",
  },
  {
    id: "near-token",
    agentId: "person_106",
    label: "Token balance verifier",
    description:
      "Read NEP-141 token balances and metadata with exact decimal formatting.",
    aiCalls: 0,
    inputLabel: "Token request as JSON",
    placeholder: '{"contract":"wrap.near","accountId":"account.near"}',
    minInputLength: 2,
    tools: ["nep141-balance-view", "token-metadata", "exact-token-decimals"],
    checks: [
      "Balance is a valid unsigned 128-bit integer",
      "Metadata and balance read at the same finalized block",
    ],
    review:
      "Balance reported by the specified contract; no price, issuer legitimacy, liquidity or transferability is established.",
  },
]);
export const isWeb3Service = (service) =>
  WEB3_SERVICES.some((s) => s.id === service);
function account(value, allowTestnetLabel = false) {
  if (
    typeof value !== "string" ||
    value.length < 2 ||
    value.length > 64 ||
    !/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(value) ||
    (!allowTestnetLabel && value.endsWith(".testnet"))
  )
    throw Error(
      "Use a valid NEAR mainnet account ID, not a URL or testnet account",
    );
  return value;
}
export function parseWeb3Input(service, input) {
  if (
    !isWeb3Service(service) ||
    typeof input !== "string" ||
    input.length > 2000
  )
    throw Error("Invalid Web3 request");
  if (service === "near-account" || service === "near-contract")
    return { accountId: account(input.trim()) };
  let value;
  try {
    value = JSON.parse(input);
  } catch {
    throw Error(
      "Provide the requested JSON object with contract and tokenId or accountId",
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Provide a JSON object");
  const allowed =
    service === "near-nft"
      ? ["contract", "tokenId", "claimedOwner"]
      : ["contract", "accountId"];
  if (Object.keys(value).some((k) => !allowed.includes(k)))
    throw Error("Unknown Web3 request field");
  const contract = account(value.contract);
  if (service === "near-token")
    return { contract, accountId: account(value.accountId) };
  if (
    typeof value.tokenId !== "string" ||
    !value.tokenId ||
    value.tokenId.length > 128
  )
    throw Error("NFT tokenId must contain 1–128 characters");
  return {
    contract,
    tokenId: value.tokenId,
    ...(value.claimedOwner
      ? { claimedOwner: account(value.claimedOwner) }
      : {}),
  };
}
function uint(value) {
  if (
    typeof value !== "string" ||
    !/^\d{1,39}$/.test(value) ||
    BigInt(value) > (1n << 128n) - 1n
  )
    throw Error("Invalid onchain unsigned integer");
  return BigInt(value);
}
function units(value, decimals) {
  const s = value.toString().padStart(decimals + 1, "0");
  return decimals
    ? (s.slice(0, -decimals) + "." + s.slice(-decimals)).replace(/\.?0+$/, "")
    : s;
}
export function base58(bytes) {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = BigInt("0x" + Buffer.from(bytes).toString("hex")),
    out = "";
  while (n) {
    out = chars[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}
export async function web3Rpc(
  method,
  params,
  { signal, fetchImpl = fetch } = {},
) {
  if (!["block", "query", "EXPERIMENTAL_protocol_config"].includes(method))
    throw Error("Read-only RPC methods required");
  const response = await fetchImpl(
    process.env.NEAR_MAINNET_RPC_URL || "https://free.rpc.fastnear.com",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "econia-web3",
        method,
        params,
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw Error("Mainnet RPC unavailable");
  const reader = response.body.getReader();
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 4000000)
        throw Error("RPC report response exceeded size limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (result.error || !result.result)
    throw Error(
      "Chain query failed; check the account, contract and token identity",
    );
  return result.result;
}
export async function runWeb3Service(
  service,
  input,
  { rpc = web3Rpc, signal } = {},
) {
  const target = parseWeb3Input(service, input),
    block = await rpc("block", { finality: "final" }, { signal });
  if (
    typeof block.header?.hash !== "string" ||
    !Number.isSafeInteger(block.header.height)
  )
    throw Error("Invalid finalized block");
  const blockHash = block.header.hash;
  const query = async (params) => {
    const result = await rpc(
      "query",
      { ...params, block_id: blockHash },
      { signal },
    );
    if (
      result.block_hash !== blockHash ||
      result.block_height !== block.header.height
    )
      throw Error(
        "Chain response is not pinned to the requested finalized block",
      );
    return result;
  };
  const call = async (contract, method_name, args) => {
    const value = await query({
      request_type: "call_function",
      account_id: contract,
      method_name,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    if (!Array.isArray(value.result) || value.result.length > 1000000)
      throw Error("Invalid view response");
    return JSON.parse(Buffer.from(value.result).toString("utf8"));
  };
  let data;
  if (service === "near-account") {
    const state = await query({
      request_type: "view_account",
      account_id: target.accountId,
    });
    const config = await rpc(
      "EXPERIMENTAL_protocol_config",
      { block_id: blockHash },
      { signal },
    );
    const amount = uint(state.amount),
      locked = uint(state.locked),
      price = uint(config.runtime_config?.storage_amount_per_byte);
    if (!Number.isSafeInteger(state.storage_usage) || state.storage_usage < 0)
      throw Error("Invalid account storage size");
    const storage = BigInt(state.storage_usage) * price,
      total = amount + locked,
      required = locked > storage ? locked : storage;
    const keys = await query({
      request_type: "view_access_key_list",
      account_id: target.accountId,
      limit: 100,
    });
    if (!Array.isArray(keys.keys) || keys.keys.length > 100)
      throw Error("Access-key inventory exceeded bounds");
    const permissions = keys.keys.map((k) => {
      if (typeof k.public_key !== "string" || k.public_key.length > 10000)
        throw Error("Invalid access key");
      const p = k.access_key?.permission;
      if (p === "FullAccess" || p?.GasKeyFullAccess)
        return { publicKey: k.public_key, type: "FullAccess" };
      const fn = p?.FunctionCall || p?.GasKeyFunctionCall;
      if (fn) {
        account(fn.receiver_id, true);
        if (
          !Array.isArray(fn.method_names) ||
          fn.method_names.length > 100 ||
          fn.method_names.some((m) => typeof m !== "string" || m.length > 128)
        )
          throw Error("Invalid function-key permissions");
        return {
          publicKey: k.public_key,
          type: "FunctionCall",
          receiver: fn.receiver_id,
          methods: fn.method_names,
          allowanceYocto:
            fn.allowance === null ? null : uint(fn.allowance).toString(),
        };
      }
      return {
        publicKey: k.public_key,
        type: "Unrecognized permission; review raw chain data",
      };
    });
    data = {
      accountId: target.accountId,
      amountYocto: amount.toString(),
      amountNear: units(amount, 24),
      lockedYocto: locked.toString(),
      lockedNear: units(locked, 24),
      totalYocto: total.toString(),
      totalNear: units(total, 24),
      storageBytes: state.storage_usage,
      storageCostPerByteYocto: price.toString(),
      storageBackingYocto: storage.toString(),
      availableEstimateYocto: (total > required
        ? total - required
        : 0n
      ).toString(),
      availableEstimateNear: units(
        total > required ? total - required : 0n,
        24,
      ),
      codeHash: state.code_hash,
      permissions,
      keyListMayBePartial: permissions.length === 100,
      note: "Available estimate excludes in-flight transactions, gas-key balances and application-held treasury liabilities. Token holdings require a specified token contract.",
    };
  } else if (service === "near-contract") {
    const state = await query({
      request_type: "view_account",
      account_id: target.accountId,
    });
    if (state.code_hash === "11111111111111111111111111111111")
      data = {
        contract: target.accountId,
        hasContract: Object.keys(state).some((k) =>
          k.startsWith("global_contract"),
        )
          ? null
          : false,
        exports: [],
        note: "A global contract reference, if present, is not resolved by this inspector.",
      };
    else {
      const code = await query({
        request_type: "view_code",
        account_id: target.accountId,
      });
      if (
        typeof code.code_base64 !== "string" ||
        code.code_base64.length > 2800000
      )
        throw Error("Contract exceeds the 2 MB inspection limit");
      const bytes = Buffer.from(code.code_base64, "base64");
      if (bytes.length > 2000000 || bytes.length < 8)
        throw Error("Invalid or oversized WASM");
      const digest = createHash("sha256").update(bytes).digest(),
        codeHash = base58(digest);
      if (codeHash !== state.code_hash || (code.hash && code.hash !== codeHash))
        throw Error("Downloaded code hash does not match onchain account code");
      const module = new WebAssembly.Module(bytes);
      data = {
        contract: target.accountId,
        hasContract: true,
        codeHash,
        sha256: digest.toString("hex"),
        wasmBytes: bytes.length,
        exports: WebAssembly.Module.exports(module),
        executionPerformed: false,
      };
    }
  } else if (service === "near-nft") {
    const token = await call(target.contract, "nft_token", {
      token_id: target.tokenId,
    });
    if (!token || token.token_id !== target.tokenId)
      throw Error("NFT not found or token identity mismatch");
    account(token.owner_id);
    const approvals = token.approved_account_ids || {};
    if (
      typeof approvals !== "object" ||
      Array.isArray(approvals) ||
      Object.keys(approvals).length > 100
    )
      throw Error("Invalid NFT approval inventory");
    for (const [id, value] of Object.entries(approvals)) {
      account(id);
      if (!Number.isSafeInteger(value) || value < 0)
        throw Error("Invalid approval ID");
    }
    data = {
      contract: target.contract,
      tokenId: target.tokenId,
      ownerId: token.owner_id,
      approvals,
      ...(target.claimedOwner
        ? {
            claimedOwner: target.claimedOwner,
            ownerMatchesClaim: token.owner_id === target.claimedOwner,
          }
        : {}),
    };
  } else {
    const metadata = await call(target.contract, "ft_metadata", {}),
      balance = uint(
        await call(target.contract, "ft_balance_of", {
          account_id: target.accountId,
        }),
      );
    if (
      !metadata ||
      typeof metadata.name !== "string" ||
      metadata.name.length > 200 ||
      typeof metadata.symbol !== "string" ||
      metadata.symbol.length > 50 ||
      !Number.isInteger(metadata.decimals) ||
      metadata.decimals < 0 ||
      metadata.decimals > 255
    )
      throw Error("Invalid token metadata");
    data = {
      contract: target.contract,
      accountId: target.accountId,
      tokenName: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      balanceRaw: balance.toString(),
      balanceFormatted:
        metadata.decimals <= 38 ? units(balance, metadata.decimals) : null,
      note:
        metadata.decimals > 38
          ? "Formatted display omitted above 38 decimals; raw balance preserved."
          : "Metadata and balance are claims of the queried contract.",
    };
  }
  const report = {
    network: "mainnet",
    service,
    blockHeight: block.header.height,
    blockHash,
    generatedAt: new Date().toISOString(),
    data,
  };
  validateWeb3Report(service, report);
  return report;
}
export function validateWeb3Report(service, report) {
  if (
    report.network !== "mainnet" ||
    report.service !== service ||
    !report.blockHash ||
    !Number.isSafeInteger(report.blockHeight)
  )
    throw Error("Web3 report provenance check failed");
  const d = report.data;
  if (service === "near-account") {
    const total = uint(d.amountYocto) + uint(d.lockedYocto),
      storage = BigInt(d.storageBytes) * uint(d.storageCostPerByteYocto),
      required = uint(d.lockedYocto) > storage ? uint(d.lockedYocto) : storage;
    if (
      total.toString() !== d.totalYocto ||
      storage.toString() !== d.storageBackingYocto ||
      (total > required ? total - required : 0n).toString() !==
        d.availableEstimateYocto ||
      units(BigInt(d.availableEstimateYocto), 24) !== d.availableEstimateNear
    )
      throw Error("Account balance reconciliation failed");
  } else if (service === "near-token") {
    if (
      d.decimals <= 38 &&
      units(uint(d.balanceRaw), d.decimals) !== d.balanceFormatted
    )
      throw Error("Token decimal check failed");
  } else if (service === "near-nft") {
    account(d.ownerId);
    if (
      d.claimedOwner &&
      d.ownerMatchesClaim !== (d.claimedOwner === d.ownerId)
    )
      throw Error("NFT owner comparison failed");
  } else if (
    service === "near-contract" &&
    d.hasContract &&
    (!d.codeHash || d.executionPerformed !== false || !Array.isArray(d.exports))
  )
    throw Error("Contract inspection check failed");
  return true;
}
