import React, { useEffect, useState } from "react";
import { formatNear } from "../../../packages/shared/native-state.mjs";
export function ProfessionalRefunds({
  request,
  selector,
  account,
  network,
  onNotice,
}) {
  const [amount, setAmount] = useState("0"),
    [busy, setBusy] = useState(false),
    [issue, setIssue] = useState("");
  useEffect(() => {
    let live = true;
    const refresh = () =>
      request("wallet/refunds")
        .then((v) => {
          if (live) setAmount(v.amount);
        })
        .catch(() => {});
    refresh();
    const t = setInterval(refresh, 15000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [request, account]);
  async function withdraw() {
    setBusy(true);
    setIssue("");
    try {
      const tx = await request("wallet/refunds/withdraw", {});
      const r = await (
        await selector.wallet()
      ).signAndSendTransaction({ ...tx, signerId: account });
      const transactionHash =
        r?.transaction?.hash || r?.transaction_outcome?.id;
      if (!transactionHash)
        throw Error(
          "Check your wallet before retrying; confirmation is unavailable.",
        );
      const confirmed = await request("wallet/refunds/confirm", {
        transactionHash,
      });
      setAmount(confirmed.amount);
      onNotice("Refund withdrawal confirmed on NEAR.");
    } catch (e) {
      setIssue(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (amount === "0" && !issue) return null;
  return (
    <section className="pro-work-card">
      <h3>Available contract refunds</h3>
      <p>
        {formatNear(amount)} {network === "mainnet" ? "NEAR" : "testnet NEAR"}
      </p>
      <p className="pro-small">
        Unused funding excess is held for your wallet. Withdrawal requires your
        approval and network gas.
      </p>
      <button disabled={busy || amount === "0"} onClick={withdraw}>
        Withdraw in wallet
      </button>
      {issue && <p role="alert">{issue}</p>}
    </section>
  );
}
