import { createHash } from "node:crypto";
import { SignedTransaction, baseEncode } from "near-api-js";
// The journal is private. Signed bytes must never appear in HTTP responses or logs.
export function createDurableOperator({ store, provider, account, receiver }) {
  let tail = Promise.resolve();
  async function bounded(promise) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(Error("RPC confirmation timed out")),
            30000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  function send({ id, method, args, actions }) {
    const perform = async () => {
      const payloadHash = createHash("sha256")
        .update(JSON.stringify({ receiver, method, args }))
        .digest("hex");
      let row = store.db
        .prepare("SELECT * FROM chain_operations WHERE operation_id=?")
        .get(id);
      if (row && row.payload_hash !== payloadHash)
        throw Error("Operator operation changed after signing");
      let signed;
      if (row) signed = SignedTransaction.decode(new Uint8Array(row.signed_tx));
      else {
        signed = await (
          await account()
        ).createSignedTransaction({ receiverId: receiver, actions });
        const txHash = baseEncode(
          createHash("sha256").update(signed.transaction.encode()).digest(),
        );
        store.db
          .prepare("INSERT INTO chain_operations VALUES(?,?,?,?,?,?,?)")
          .run(
            id,
            method,
            payloadHash,
            txHash,
            Buffer.from(signed.encode()),
            "PREPARED",
            store.now(),
          );
        row = store.db
          .prepare("SELECT * FROM chain_operations WHERE operation_id=?")
          .get(id);
      }
      let result;
      try {
        // Sending the exact persisted bytes is safe even after an uncertain broadcast.
        result = await bounded(provider.sendTransactionUntil(signed, "FINAL"));
      } catch {
        try {
          result = await bounded(
            provider.viewTransactionStatus({
              txHash: row.tx_hash,
              accountId: receiver,
              waitUntil: "FINAL",
            }),
          );
        } catch {
          throw Error(
            "Operator transaction is unconfirmed; its persisted hash must be reconciled before any replacement",
          );
        }
      }
      if (
        result.transaction?.hash !== row.tx_hash ||
        (result.final_execution_status &&
          result.final_execution_status !== "FINAL") ||
        result.transaction?.receiver_id !== receiver ||
        !Object.hasOwn(result.status || {}, "SuccessValue") ||
        [result.transaction_outcome, ...(result.receipts_outcome || [])].some(
          (x) => x?.outcome?.status?.Failure,
        )
      )
        throw Error("Operator transaction did not successfully finalize");
      store.db
        .prepare(
          "UPDATE chain_operations SET status='FINAL' WHERE operation_id=?",
        )
        .run(id);
      return result;
    };
    const result = tail.then(perform);
    tail = result.catch(() => {});
    return result;
  }
  return {
    send,
    prepared: (id) =>
      Boolean(
        store.db
          .prepare(
            "SELECT operation_id FROM chain_operations WHERE operation_id=?",
          )
          .get(id),
      ),
  };
}
