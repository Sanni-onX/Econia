import { createDurableOperator } from "./durable-operator.mjs";
import { createHash } from "node:crypto";
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  actions,
  teraToGas,
} from "near-api-js";
import { nativeTransaction, parseNear } from "../shared/native-near.mjs";
import { formatNear } from "../shared/native-state.mjs";
const hash = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export function proposalCommitment(p, network = "testnet") {
  if (!["testnet", "mainnet"].includes(network))
    throw Error("Explicit network required");
  return hash({
    ...(p.buyer_agent ? { buyer: p.buyer_agent, owner: p.customer_id } : {}),
    ...(p.allocations?.length > 1
      ? {
          allocations: p.allocations.map((a) => ({
            agent: a.agent_id,
            service: a.service_id,
            scope: a.scope,
            inputHash: hash(a.input_text),
            price: a.price,
            parent: a.parent_index,
          })),
        }
      : {}),
    id: p.id,
    provider: p.provider_id,
    service: p.service_id,
    scope: p.scope,
    inputHash: hash(p.input_text),
    price: p.price,
    network,
    asset: "NEAR",
  });
}
function allocationArgs(p) {
  return (
    p.allocations || [
      {
        agent_id: p.provider_id,
        service_id: p.service_id,
        price: p.price,
        parent_index: null,
      },
    ]
  ).map((a) => ({
    agent_id: a.agent_id,
    service_id: a.service_id,
    amount: a.price,
    parent_index: a.parent_index,
    evidence: null,
  }));
}
const methods = [
  "deliver_service_job",
  "open_agent_service_job",
  "accept_service_job",
];
export async function createProfessionalChain({
  network = "testnet",
  contract,
  operatorKey,
  store,
  provider = new JsonRpcProvider(
    {
      url:
        network === "mainnet"
          ? process.env.NEAR_MAINNET_RPC_URL ||
            "https://rpc.mainnet.fastnear.com"
          : process.env.NEAR_TESTNET_RPC_URL || "https://test.rpc.fastnear.com",
    },
    { retries: 3, wait: 500, backoff: 1.5 },
  ),
} = {}) {
  if (
    typeof contract !== "string" ||
    !["testnet", "mainnet"].includes(network) ||
    !/^[a-z0-9._-]{2,64}$/.test(contract) ||
    (network === "testnet" && !contract.endsWith(".testnet")) ||
    (network === "mainnet" && contract.endsWith(".testnet")) ||
    contract.length > 64 ||
    (await provider.getNetworkId()) !== network
  )
    throw Error("Explicit matching NEAR contract, network and RPC required");
  const view = (method, args = {}, blockQuery = { finality: "final" }) =>
    provider.callFunction({ contractId: contract, method, args, blockQuery });
  async function operator() {
    if (!operatorKey)
      throw Error("Restricted operator credential is not configured");
    const publicKey = KeyPair.fromString(operatorKey).getPublicKey();
    const access = await provider.viewAccessKey({
      accountId: contract,
      publicKey,
      finalityQuery: { finality: "final" },
    });
    const p = access.permission?.FunctionCall;
    if (
      !p ||
      p.receiver_id !== contract ||
      !Array.isArray(p.method_names) ||
      p.method_names.length !== methods.length ||
      methods.some((m) => !p.method_names.includes(m)) ||
      p.allowance === null ||
      BigInt(p.allowance) >
        (network === "mainnet" ? 2n * 10n ** 22n : 2n * 10n ** 23n)
    )
      throw Error(
        "Operator must use the reviewed receiver-bound, method-restricted, allowance-capped function key",
      );
    return new Account(contract, provider, operatorKey);
  }
  async function receipt(transactionHash, signer, method) {
    if (
      typeof transactionHash !== "string" ||
      !/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(transactionHash) ||
      typeof signer !== "string"
    )
      throw Error("Valid transaction hash and signer required");
    const r = await provider.viewTransactionStatus({
      txHash: transactionHash,
      accountId: signer,
      waitUntil: "FINAL",
    });
    if (r.final_execution_status && r.final_execution_status !== "FINAL")
      throw Error("Finalized receipt required");
    if (
      r.transaction?.hash !== transactionHash ||
      r.transaction?.signer_id !== signer ||
      r.transaction?.receiver_id !== contract ||
      r.transaction.actions?.length !== 1 ||
      !Object.hasOwn(r.status || {}, "SuccessValue") ||
      [r.transaction_outcome, ...(r.receipts_outcome || [])].some(
        (x) => x?.outcome?.status?.Failure,
      )
    )
      throw Error("Successful contract-bound transaction required");
    const action = r.transaction.actions[0].FunctionCall;
    if (action?.method_name !== method)
      throw Error("Unexpected contract method");
    const args = JSON.parse(
      Buffer.from(action.args, "base64").toString("utf8"),
    );
    const block = await provider.viewBlock({
      blockId: r.transaction_outcome.block_hash,
    });
    return {
      network,
      contract,
      hash: transactionHash,
      signer,
      method,
      args,
      deposit: String(action.deposit),
      blockHeight: block.header.height,
      result: JSON.parse(
        Buffer.from(r.status.SuccessValue, "base64").toString("utf8") || "null",
      ),
    };
  }
  if (operatorKey) await operator();
  let journal = store
    ? createDurableOperator({
        store,
        provider,
        account: operator,
        receiver: contract,
      })
    : null;
  return {
    contract,
    setOperationStore(s) {
      if (s.network !== network || (s.contract && s.contract !== contract))
        throw Error("Operator journal belongs to another network or contract");
      journal = createDurableOperator({
        store: s,
        provider,
        account: operator,
        receiver: contract,
      });
    },
    network,
    ready: Boolean(operatorKey),
    view,
    receipt,
    async readRegistry(agents) {
      const block = await provider.viewBlock({ finality: "final" }),
        query = { blockId: block.header.hash };
      const [tokens, custody] = await Promise.all([
        view("nft_tokens", { from_index: "0", limit: 100 }, query),
        view("custody", {}, query),
      ]);
      // Include preserved inactive NFTs in custody reconciliation, even though
      // only the commissioned professional roster runs inference.
      const records = await view(
        "get_professionals",
        { agent_ids: tokens.map((t) => t.token_id) },
        query,
      );
      // Uncommissioned legacy NFTs have no professional treasury and cannot
      // receive capital. Reconcile every stored professional, including any
      // commissioned identities outside the active inference roster.
      const total = Object.values(records).reduce(
        (sum, r) => sum + BigInt(r.treasury),
        0n,
      );
      const identities = agents.map((a) => {
        const token = tokens.find((t) => t.token_id === a.id),
          record = records[a.id];
        if (
          !token ||
          !record ||
          record.profession !== a.profession ||
          JSON.stringify(record.services) !== JSON.stringify(a.services)
        )
          throw Error("Genesis professional/NFT reconciliation failed");
        return {
          id: a.id,
          ownerId: token.owner_id,
          treasury: record.treasury,
          paused: record.paused,
        };
      });
      if (custody.network !== network || total !== BigInt(custody.treasuries))
        throw Error("Treasury reconciliation failed");
      return {
        identities,
        custody,
        blockHeight: block.header.height,
        blockHash: block.header.hash,
        verifiedAt: new Date().toISOString(),
      };
    },
    async readJobPage(from = 0, limit = 8) {
      if (
        !Number.isSafeInteger(from) ||
        from < 0 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 8
      )
        throw Error("Bounded onchain history page required");
      const block = await provider.viewBlock({ finality: "final" }),
        rows = [];
      for (let id = from; id < from + limit; id++) {
        const job = await view(
          "get_service_job",
          { job_id: id },
          { blockId: block.header.hash },
        );
        if (!job) break;
        rows.push({ id, job, blockHash: block.header.hash });
      }
      return rows;
    },
    async resolveOwnership(id) {
      const block = await provider.viewBlock({ finality: "final" });
      const token = await view(
        "nft_token",
        { token_id: id },
        { blockId: block.header.hash },
      );
      return token
        ? {
            ownerId: token.owner_id,
            reference: block.header.hash,
            network,
          }
        : null;
    },
    prepareFunding(p) {
      const allocations = allocationArgs(p);
      return nativeTransaction({
        network,
        contract,
        method: "post_service_job",
        args: {
          proposal_id: p.id,
          scope_hash: proposalCommitment(p, network),
          allocations,
          deadline: Number(BigInt(Date.now() + 86400000) * 1000000n),
        },
        deposit: formatNear(
          (BigInt(p.total_price || p.price) + 10n ** 23n).toString(),
        ),
      });
    },
    async verifyFunding({ proposal: p, transactionHash, customer }) {
      const r = await receipt(transactionHash, customer, "post_service_job");
      if (
        r.args.proposal_id !== p.id ||
        r.args.scope_hash !== proposalCommitment(p, network) ||
        JSON.stringify(r.args.allocations) !== JSON.stringify(allocationArgs(p))
      )
        throw Error("Funding scope or allocation mismatch");
      const jobId = String(r.result),
        job = await view("get_service_job", { job_id: Number(jobId) });
      if (
        !job ||
        job.proposal_id !== p.id ||
        job.customer !== customer ||
        job.buyer_agent !== null ||
        job.total !== (p.total_price || p.price) ||
        job.scope_hash !== proposalCommitment(p, network)
      )
        throw Error("Funded onchain job mismatch");
      return {
        ...r,
        proposalId: p.id,
        agentId: p.provider_id,
        amount: p.total_price || p.price,
        jobId,
      };
    },
    async agentAuthority(agentId, owner) {
      const [token, policy, record] = await Promise.all([
        view("nft_token", { token_id: agentId }),
        view("get_policy", { agent_id: agentId }),
        view("get_professional", { agent_id: agentId }),
      ]);
      if (
        !token ||
        token.owner_id !== owner ||
        !policy ||
        policy.owner !== owner ||
        record?.paused
      )
        throw Error("Fresh current-owner operating policy required");
      return { owner, policy, treasury: record.treasury };
    },
    async fundAgent(p) {
      if (!journal || !p.buyer_agent)
        throw Error("Durable journal and agent purchase required");
      const current = journal.prepared("fund:" + p.id)
          ? null
          : await this.agentAuthority(p.buyer_agent, p.customer_id),
        total = BigInt(p.total_price);
      if (
        current &&
        (total > BigInt(current.policy.remaining) ||
          total > BigInt(current.policy.per_job) ||
          total > BigInt(current.treasury) ||
          p.allocations.some(
            (a) =>
              a.agent_id === p.buyer_agent ||
              !current.policy.allowed_services.includes(a.service_id),
          ))
      )
        throw Error("Professional purchase exceeds current owner authority");
      const args = {
        buyer_agent: p.buyer_agent,
        expected_owner: p.customer_id,
        proposal_id: p.id,
        scope_hash: proposalCommitment(p, network),
        allocations: allocationArgs(p),
        deadline: Number(
          BigInt(Date.parse(p.created_at) + 86400000) * 1000000n,
        ),
      };
      const tx = await journal.send({
        id: "fund:" + p.id,
        method: "open_agent_service_job",
        args,
        actions: [
          actions.functionCall(
            "open_agent_service_job",
            args,
            teraToGas("120"),
            0n,
          ),
        ],
      });
      return tx.transaction.hash;
    },
    async verifyAgentFunding({ proposal: p, transactionHash }) {
      const r = await receipt(
        transactionHash,
        contract,
        "open_agent_service_job",
      );
      if (
        r.args.buyer_agent !== p.buyer_agent ||
        r.args.expected_owner !== p.customer_id ||
        r.args.proposal_id !== p.id ||
        r.args.scope_hash !== proposalCommitment(p, network) ||
        JSON.stringify(r.args.allocations) !== JSON.stringify(allocationArgs(p))
      )
        throw Error("Autonomous funding does not match approved manifest");
      const jobId = String(r.result),
        job = await view("get_service_job", { job_id: Number(jobId) });
      if (
        job?.buyer_agent !== p.buyer_agent ||
        job.total !== p.total_price ||
        job.proposal_id !== p.id ||
        job.scope_hash !== proposalCommitment(p, network)
      )
        throw Error("Agent escrow reconciliation failed");
      return {
        ...r,
        proposalId: p.id,
        agentId: p.provider_id,
        amount: p.total_price,
        jobId,
      };
    },
    async acceptAgent(c) {
      const authority = await this.agentAuthority(c.buyer_agent, c.customer_id);
      if (!authority.policy.auto_accept)
        throw Error("Owner approval required for settlement");
      await this.publishDelivery(c, c.evidence);
      const args = {
        job_id: Number(c.chain_job_id),
        expected_owner: c.customer_id,
      };
      const tx = await journal.send({
        id: "accept:" + c.chain_job_id,
        method: "accept_service_job",
        args,
        actions: [
          actions.functionCall(
            "accept_service_job",
            args,
            teraToGas("100"),
            0n,
          ),
        ],
      });
      return tx.transaction.hash;
    },
    async publishDelivery(c, evidence) {
      evidence = Array.isArray(evidence) ? evidence : [evidence];
      if (!evidence.length || evidence.some((h) => !/^[a-f0-9]{64}$/.test(h)))
        throw Error("Complete checked delivery evidence required");
      const job = await view("get_service_job", {
        job_id: Number(c.chain_job_id),
      });
      if (!job || job.proposal_id !== c.proposal_id)
        throw Error("Delivery contract mismatch");
      if (["DELIVERED", "SETTLED"].includes(job.state)) {
        if (
          JSON.stringify(job.allocations.map((a) => a.evidence)) !==
          JSON.stringify(evidence)
        )
          throw Error("Onchain delivery hash mismatch");
        return;
      }
      if (job.state !== "FUNDED") throw Error("Funded onchain job required");
      if (!journal)
        throw Error(
          "Durable operator journal must be configured before signing",
        );
      const args = { job_id: Number(c.chain_job_id), evidence };
      const tx = await journal.send({
        id: "deliver:" + c.chain_job_id,
        method: "deliver_service_job",
        args,
        actions: [
          actions.functionCall(
            "deliver_service_job",
            args,
            teraToGas("80"),
            0n,
          ),
        ],
      });
      if (!Object.hasOwn(tx.status || {}, "SuccessValue"))
        throw Error("Delivery attestation failed");
      return { hash: tx.transaction.hash };
    },
    async prepareAcceptance(c) {
      await this.publishDelivery(c, c.evidence || [c.delivery_hash]);
      return nativeTransaction({
        network,
        contract,
        method: "accept_service_job",
        args: { job_id: Number(c.chain_job_id) },
        deposit: "0.000000000000000000000001",
      });
    },
    async verifyAcceptance({ contract: c, customer, transactionHash }) {
      const r = await receipt(
        transactionHash,
        c.buyer_agent && customer === contract ? contract : customer,
        "accept_service_job",
      );
      const job = await view("get_service_job", {
        job_id: Number(c.chain_job_id),
      });
      if (
        String(r.args.job_id) !== c.chain_job_id ||
        job?.state !== "SETTLED" ||
        job.proposal_id !== c.proposal_id ||
        JSON.stringify(job.allocations?.map((a) => a.evidence)) !==
          JSON.stringify(c.evidence || [c.delivery_hash])
      )
        throw Error("Settlement does not match verified delivery");
      return { ...r, jobId: c.chain_job_id };
    },
    prepareCapital(agentId, amount) {
      if (BigInt(parseNear(amount)) <= 0n)
        throw Error("Positive capital required");
      return nativeTransaction({
        network,
        contract,
        method: "provide_capital",
        args: { agent_id: agentId },
        deposit: amount,
      });
    },
    async verifyCapital({ agentId, customer, transactionHash }) {
      const r = await receipt(transactionHash, customer, "provide_capital");
      if (r.args.agent_id !== agentId || BigInt(r.deposit) <= 0n)
        throw Error("Capital receipt mismatch");
      return { ...r, agentId, amount: r.deposit };
    },
    async prepareBudget(
      agentId,
      { remaining, perJob, allowedServices, autoAccept },
    ) {
      const a = await view("get_professional", { agent_id: agentId });
      const remainingYocto = parseNear(remaining),
        perJobYocto = parseNear(perJob);
      if (
        !a ||
        !Array.isArray(allowedServices) ||
        allowedServices.length > 16 ||
        allowedServices.some((s) => typeof s !== "string" || s.length > 64) ||
        typeof autoAccept !== "boolean" ||
        BigInt(perJobYocto) > BigInt(remainingYocto) ||
        BigInt(remainingYocto) > BigInt(a.treasury)
      )
        throw Error(
          "Budget exceeds verified available capital or policy bounds",
        );
      return nativeTransaction({
        network,
        contract,
        method: "authorize_budget",
        args: {
          agent_id: agentId,
          remaining: remainingYocto,
          per_job: perJobYocto,
          allowed_services: allowedServices,
          auto_accept: autoAccept,
        },
        deposit: "0.000000000000000000000001",
      });
    },
    async verifyBudget({ agentId, customer, transactionHash }) {
      const r = await receipt(transactionHash, customer, "authorize_budget");
      if (r.args.agent_id !== agentId) throw Error("Budget receipt mismatch");
      return { ...r, agentId };
    },
    async prepareTransfer(agentId, receiver) {
      if (
        typeof receiver !== "string" ||
        !(
          network === "testnet"
            ? /^([a-f0-9]{64}|[a-z0-9._-]+\.testnet)$/
            : /^([a-f0-9]{64}|[a-z0-9._-]+\.near)$/
        ).test(receiver) ||
        receiver.length > 64
      )
        throw Error("Existing account on the configured network required");
      await provider.viewAccount({
        accountId: receiver,
        blockQuery: { finality: "final" },
      });
      return nativeTransaction({
        network,
        contract,
        method: "nft_transfer",
        args: {
          receiver_id: receiver,
          token_id: agentId,
          memo: "Econia Genesis 2 ownership transfer; profession, history and treasury persist.",
        },
        deposit: "0.000000000000000000000001",
      });
    },
    async operatorAccount() {
      return operator();
    },
  };
}

export function createProfessionalTestnet(options = {}) {
  return createProfessionalChain({ ...options, network: "testnet" });
}
