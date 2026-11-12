import { randomUUID } from "node:crypto";
export function createVerifiedLedger(store) {
  return {
    record({ receiptHash, debit, credit, amount }) {
      if (
        typeof amount !== "string" ||
        !/^\d{1,39}$/.test(amount) ||
        BigInt(amount) <= 0n ||
        BigInt(amount) > 2n ** 128n - 1n ||
        debit === credit
      )
        throw Error("Positive exact asset transfer required");
      const receipt = store.db
        .prepare("SELECT * FROM receipts WHERE tx_hash=?")
        .get(receiptHash);
      if (!receipt || receipt.network_id !== store.network)
        throw Error(`Ledger entries require a verified ${store.network} receipt`);
      for (const id of [debit, credit])
        store.db
          .prepare("INSERT OR IGNORE INTO accounts VALUES(?,?,?)")
          .run(id, store.network, `near:${store.network}:NEAR`);
      const old = store.db
        .prepare(
          "SELECT amount FROM ledger_transfers WHERE receipt_hash=? AND debit=? AND credit=?",
        )
        .get(receiptHash, debit, credit);
      if (old) {
        if (old.amount !== amount)
          throw Error("Receipt transfer amount mismatch");
        return;
      }
      store.db
        .prepare("INSERT INTO ledger_transfers VALUES(?,?,?,?,?)")
        .run(randomUUID(), receiptHash, debit, credit, amount);
    },
    history(account) {
      return store.db
        .prepare(
          "SELECT * FROM ledger_transfers WHERE debit=? OR credit=? ORDER BY rowid",
        )
        .all(account, account);
    },
  };
}
