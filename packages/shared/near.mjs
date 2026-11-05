import { createHash } from "node:crypto";
export class NearTestnetEcoAdapter {
  mode = "testnet";
  constructor({
    rpcUrl = "https://rpc.testnet.near.org",
    ecoContract,
    worldContract,
    signer,
  }) {
    if (
      !ecoContract?.endsWith(".testnet") ||
      !worldContract?.endsWith(".testnet")
    )
      throw new Error("Explicit testnet contracts required");
    const host = new URL(rpcUrl).hostname;
    if (
      !host.endsWith(".near.org") &&
      !host.endsWith(".fastnear.com") &&
      host !== "127.0.0.1"
    )
      throw new Error("Unapproved RPC host");
    Object.assign(this, { rpcUrl, ecoContract, worldContract, signer });
    this.rpcSequence = 0;
  }
  async rpc(method, params) {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++this.rpcSequence,
        method,
        params,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    return data.result;
  }
  async view(account, method, args = {}) {
    const result = await this.rpc("query", {
      request_type: "call_function",
      finality: "final",
      account_id: account,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    return JSON.parse(Buffer.from(result.result).toString());
  }
  async entity(id) {
    return this.view(this.worldContract, "get_entity", { entity_id: id });
  }
  async owner(id) {
    return (await this.view(this.worldContract, "nft_token", { token_id: id }))
      ?.owner_id;
  }
  async reconcile(entities) {
    const differences = [];
    for (const e of entities) {
      const chain = await this.entity(e.id);
      if (!chain || BigInt(chain.treasury) !== BigInt(e.cash))
        differences.push({
          entity: e.id,
          projected: e.cash,
          onchain: chain?.treasury ?? null,
        });
    }
    const balance = await this.view(this.ecoContract, "ft_balance_of", {
      account_id: this.worldContract,
    });
    const state = await this.view(this.worldContract, "settlement_state");
    return {
      balanced:
        differences.length === 0 &&
        BigInt(balance) === BigInt(state.escrow_total),
      differences,
      escrow: balance,
      accounted: state.escrow_total,
    };
  }
  async receipt(hash, sender) {
    const tx = await this.rpc("tx", {
      tx_hash: hash,
      sender_account_id: sender,
      wait_until: "FINAL",
    });
    if (tx.final_execution_status !== "FINAL")
      throw new Error("Transaction not final");
    if (!Object.hasOwn(tx.status, "SuccessValue"))
      throw new Error("Transaction failed");
    return tx;
  }
  async worldEventsReceipt(hash, sender) {
    const tx = await this.receipt(hash, sender);
    if (
      tx.transaction?.signer_id !== sender ||
      ![this.worldContract, this.ecoContract].includes(
        tx.transaction?.receiver_id,
      )
    )
      throw new Error("Unexpected transaction source");
    const events = [];
    for (const receipt of tx.receipts_outcome || []) {
      if (
        receipt.outcome.executor_id !== this.worldContract ||
        !Object.hasOwn(receipt.outcome.status, "SuccessValue")
      )
        continue;
      for (const log of receipt.outcome.logs || []) {
        if (!log.startsWith("EVENT_JSON:")) continue;
        try {
          const event = JSON.parse(log.slice(11));
          if (event.standard === "econia")
            events.push({ type: event.event, ...event.data?.[0]?.value });
        } catch {}
      }
    }
    if (!events.length) throw new Error("No successful world events");
    return events;
  }
  async sponsorshipReceipt(hash, sender, entityId) {
    const tx = await this.receipt(hash, sender);
    if (
      tx.transaction?.signer_id !== sender ||
      tx.transaction?.receiver_id !== this.ecoContract
    )
      throw new Error("Unexpected signer or token contract");
    for (const receipt of tx.receipts_outcome || []) {
      if (
        receipt.outcome.executor_id !== this.worldContract ||
        !Object.hasOwn(receipt.outcome.status, "SuccessValue")
      )
        continue;
      for (const log of receipt.outcome.logs || []) {
        if (!log.startsWith("EVENT_JSON:")) continue;
        let event;
        try {
          event = JSON.parse(log.slice(11));
        } catch {
          continue;
        }
        if (event.standard !== "econia" || event.event !== "sponsorship")
          continue;
        const value = event.data?.[0]?.value;
        if (
          value?.entity_id === entityId &&
          value.sender === sender &&
          /^\d+$/.test(value.amount)
        )
          return {
            hash,
            sender,
            entityId,
            amount: value.amount,
            treasury: value.treasury,
            sequence: event.data[0].sequence,
            blockHash: receipt.block_hash,
          };
      }
    }
    throw new Error("No matching successful sponsorship receipt");
  }
  sponsorshipTransaction(entityId, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new Error("Invalid token units");
    return {
      receiverId: this.ecoContract,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "ft_transfer_call",
            args: {
              receiver_id: this.worldContract,
              amount: String(amount),
              memo: `Sponsor ${entityId}`,
              msg: JSON.stringify({ kind: "Sponsor", entity_id: entityId }),
            },
            gas: "100000000000000",
            deposit: "1",
          },
        },
      ],
    };
  }
  async settle({ id, transfers }) {
    if (!this.signer) throw new Error("Restricted operator signer required");
    if (!Number.isSafeInteger(id) || id < 1 || transfers.length > 50)
      throw new Error("Invalid settlement batch");
    const movements = transfers.map((t) => {
      if (!Number.isSafeInteger(t.amount) || t.amount <= 0)
        throw new Error("Invalid movement");
      return { from: t.debit, to: t.credit, amount: String(t.amount) };
    });
    const stateHash = createHash("sha256")
      .update(JSON.stringify({ id, movements }))
      .digest("hex");
    const previous = await this.view(this.worldContract, "settlement_state");
    if (previous.last_batch === id) {
      if (previous.last_hash !== stateHash)
        throw new Error("Conflicting retry");
      return { hash: null, reconciled: true, stateHash };
    }
    if (previous.last_batch !== id - 1)
      throw new Error("Settlement sequence mismatch");
    // Signer must await FINAL; retries reuse the same nonce/payload, never create another economic batch.
    const result = await this.signer({
      receiverId: this.worldContract,
      methodName: "settle_batch",
      args: { batch_id: id, state_hash: stateHash, movements },
      gas: "200000000000000",
      deposit: "0",
    });
    if (
      result.final_execution_status !== "FINAL" ||
      !Object.hasOwn(result.status || {}, "SuccessValue")
    )
      throw new Error("Settlement not final");
    return { hash: result.transaction.hash, stateHash };
  }
}
