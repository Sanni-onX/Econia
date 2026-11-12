import React, { useEffect, useState } from "react";
import { formatNear } from "../../../packages/shared/native-state.mjs";
export function ProfessionalOwnerTools({
  agent,
  request,
  selector,
  account,
  onNotice,
  onChanged,
  catalog,
}) {
  const [details, setDetails] = useState(null),
    [issue, setIssue] = useState(""),
    [busy, setBusy] = useState(false),
    [amount, setAmount] = useState("0.1"),
    [remaining, setRemaining] = useState("0.08"),
    [perJob, setPerJob] = useState("0.06"),
    [services, setServices] = useState([
      "website-build",
      "design-spec",
      "evidence-brief",
    ]),
    [autoAccept, setAutoAccept] = useState(false),
    [receiver, setReceiver] = useState("");
  const load = () =>
    request("agents/" + agent.id + "/owner")
      .then(setDetails)
      .catch((e) => setIssue(e.message));
  useEffect(() => {
    let alive = true;
    request("agents/" + agent.id + "/owner")
      .then((x) => alive && setDetails(x))
      .catch((e) => alive && setIssue(e.message));
    return () => {
      alive = false;
    };
  }, [agent.id, request]);
  async function authorize(kind, body) {
    setBusy(true);
    setIssue("");
    try {
      const tx = await request("agents/" + agent.id + "/" + kind, body),
        wallet = await selector.wallet();
      const result = await wallet.signAndSendTransaction({
        ...tx,
        signerId: account,
      });
      const transactionHash =
        result?.transaction?.hash || result?.transaction_outcome?.id;
      if (!transactionHash)
        throw Error(
          "No confirmed transaction hash. Inspect the wallet before retrying.",
        );
      await request("agents/" + agent.id + "/confirm-" + kind, {
        transactionHash,
      });
      onNotice(
        kind === "capital"
          ? "Testnet working capital confirmed."
          : kind === "budget"
            ? "Operating authority confirmed on testnet."
            : "NFT transfer confirmed; prior owner authority is revoked.",
      );
      if (kind !== "transfer") await load();
      onChanged?.();
    } catch (e) {
      setIssue(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pro-owner-tools">
      <h3>Your owner controls</h3>
      <p className="pro-small">
        The profession and professional history stay with the agent. Strategy
        conversations remain private to your ownership period.
      </p>
      {issue && (
        <p className="pro-error" role="alert">
          {issue}
        </p>
      )}
      {details && (
        <>
          <p>
            Working capital:{" "}
            <strong>
              {formatNear(details.professional.treasury)} testnet NEAR
            </strong>
          </p>
          <details>
            <summary>Provide working capital</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                authorize("capital", { amount });
              }}
            >
              <label>
                Testnet NEAR amount
                <input
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <button disabled={busy}>Review sponsorship in wallet</button>
            </form>
          </details>
          <details>
            <summary>Set an operating budget</summary>
            <p className="pro-small">
              This permits only capped testnet service purchases. An ownership
              transfer invalidates this grant.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                authorize("budget", {
                  remaining,
                  perJob,
                  allowedServices: services,
                  autoAccept,
                });
              }}
            >
              <label>
                Total spending allowance
                <input
                  inputMode="decimal"
                  required
                  value={remaining}
                  onChange={(e) => setRemaining(e.target.value)}
                />
              </label>
              <label>
                Maximum per contract, including subcontracts
                <input
                  inputMode="decimal"
                  required
                  value={perJob}
                  onChange={(e) => setPerJob(e.target.value)}
                />
              </label>
              <fieldset>
                <legend>Allowed professional services</legend>
                {catalog.map((s) => (
                  <label className="pro-check" key={s.id}>
                    <input
                      type="checkbox"
                      checked={services.includes(s.id)}
                      onChange={(e) =>
                        setServices((old) =>
                          e.target.checked
                            ? [...old, s.id]
                            : old.filter((x) => x !== s.id),
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </fieldset>
              <label className="pro-check">
                <input
                  type="checkbox"
                  checked={autoAccept}
                  onChange={(e) => setAutoAccept(e.target.checked)}
                />
                Allow the agent to accept checked work within this grant
              </label>
              <button disabled={busy}>Review budget authorization</button>
            </form>
            {details.policy && (
              <p className="pro-small">
                Current remaining grant: {formatNear(details.policy.remaining)}{" "}
                testnet NEAR.
              </p>
            )}
          </details>
          <details>
            <summary>Economic history</summary>
            {details.ledger.length ? (
              details.ledger.map((row) => (
                <p className="pro-small" key={row.id}>
                  {row.debit.startsWith("agent:") ? "Expense" : "Receipt"} ·{" "}
                  {formatNear(row.amount)} testnet NEAR · verified receipt
                </p>
              ))
            ) : (
              <p className="pro-small">
                No verified capital or service transfers recorded in this
                deployment.
              </p>
            )}
          </details>
          <details>
            <summary>Transfer this agent NFT</summary>
            <p className="pro-small">
              The treasury and professional obligations remain with the agent.
              Your private conversations do not transfer.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                authorize("transfer", { receiver });
              }}
            >
              <label>
                Existing testnet account
                <input
                  required
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="recipient.testnet"
                />
              </label>
              <button disabled={busy || !receiver}>
                Review NFT transfer in wallet
              </button>
            </form>
          </details>
        </>
      )}
    </section>
  );
}
