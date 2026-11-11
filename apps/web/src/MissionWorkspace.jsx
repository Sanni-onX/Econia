import React, { useEffect, useState } from "react";
export function MissionWorkspace({
  world,
  request,
  signedIn,
  busy,
  setBusy,
  download,
}) {
  const [goal, setGoal] = useState(
      "Inspect the supplied NEAR account and contract, share the checks between specialists, and prepare one traceable report.",
    ),
    [account, setAccount] = useState(""),
    [contract, setContract] = useState(""),
    [source, setSource] = useState(""),
    [csv, setCsv] = useState(""),
    [tokenContract, setTokenContract] = useState(""),
    [nftContract, setNftContract] = useState(""),
    [tokenId, setTokenId] = useState(""),
    [maxAiCalls, setMaxAiCalls] = useState(3),
    [autonomy, setAutonomy] = useState(false),
    [missions, setMissions] = useState([]),
    [issue, setIssue] = useState(""),
    [key, setKey] = useState(null);
  useEffect(() => {
    if (!signedIn) {
      setMissions([]);
      return;
    }
    let alive = true;
    const refresh = () =>
      request("missions")
        .then((m) => alive && setMissions(m))
        .catch((e) => alive && setIssue(e.message));
    refresh();
    const t = setInterval(refresh, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [signedIn, request]);
  const edit = (setter) => (e) => {
    setter(e.target.value);
    setKey(null);
  };
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setIssue("");
    const requestId = key || crypto.randomUUID();
    setKey(requestId);
    try {
      const inputs = {
        ...(account ? { accounts: [account.trim()] } : {}),
        ...(contract ? { contracts: [contract.trim()] } : {}),
        ...(source ? { source } : {}),
        ...(csv ? { csv } : {}),
        ...(tokenContract && account
          ? {
              tokens: [
                { contract: tokenContract.trim(), accountId: account.trim() },
              ],
            }
          : {}),
        ...(nftContract && tokenId
          ? { nfts: [{ contract: nftContract.trim(), tokenId }] }
          : {}),
      };
      const m = await request("missions", {
        goal,
        inputs,
        maxAiCalls,
        autonomy,
        requestId,
      });
      setMissions((old) => [m, ...old.filter((x) => x.id !== m.id)]);
      setKey(null);
    } catch (e) {
      setIssue(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function action(m, name) {
    setBusy(true);
    try {
      const result = await request("missions/" + m.id + "/" + name, {});
      setMissions((old) => old.map((x) => (x.id === m.id ? result : x)));
    } catch (e) {
      setIssue(e.message);
    } finally {
      setBusy(false);
    }
  }
  const name = (id) => world.agents.find((a) => a.id === id)?.name || id;
  return (
    <section className="mission-workspace">
      <div className="mission-intro">
        <small>AGENTS COMMISSION AGENTS</small>
        <h2>One goal. A specialist team.</h2>
        <p>
          The NEAR AI coordinator decides the work plan. Specialists claim one
          task at a time, delegate checks to reviewers, and hand their results
          to the report assembler. Large documents are split across the evidence
          team.
        </p>
      </div>
      <div className="service-columns">
        <form onSubmit={submit}>
          <label>
            Your goal
            <textarea
              aria-label="Team mission goal"
              required
              minLength={20}
              maxLength={3000}
              value={goal}
              onChange={edit(setGoal)}
              rows={3}
            />
          </label>
          <div className="mission-targets">
            <label>
              Account to analyse
              <input
                aria-label="Mission account"
                placeholder="account.near"
                value={account}
                onChange={edit(setAccount)}
              />
            </label>
            <label>
              Contract to inspect
              <input
                aria-label="Mission contract"
                placeholder="contract.near"
                value={contract}
                onChange={edit(setContract)}
              />
            </label>
          </div>
          <details>
            <summary>Add documents, data or token targets</summary>
            <label>
              Source document
              <textarea
                aria-label="Mission source document"
                maxLength={16000}
                value={source}
                onChange={edit(setSource)}
                rows={4}
              />
            </label>
            <label>
              CSV data
              <textarea
                aria-label="Mission CSV data"
                maxLength={16000}
                value={csv}
                onChange={edit(setCsv)}
                rows={3}
              />
            </label>
            <label>
              Fungible-token contract (uses the account above)
              <input
                value={tokenContract}
                onChange={edit(setTokenContract)}
                placeholder="wrap.near"
              />
            </label>
            <label>
              NFT collection
              <input
                value={nftContract}
                onChange={edit(setNftContract)}
                placeholder="collection.near"
              />
            </label>
            <label>
              NFT token ID
              <input
                value={tokenId}
                onChange={edit(setTokenId)}
                maxLength={128}
              />
            </label>
          </details>
          <label>
            Maximum inference calls for this mission
            <select
              aria-label="Mission inference allowance"
              value={maxAiCalls}
              onChange={(e) => {
                setMaxAiCalls(Number(e.target.value));
                setKey(null);
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} call{n === 1 ? "" : "s"} including coordination
                </option>
              ))}
            </select>
          </label>
          <p className="service-small">
            Reserves this allowance and 8 task slots before planning. Up to 6
            specialist jobs plus coordination and assembly. Failed or unused
            reservations remain counted conservatively in the app allowance.
            Only actual inference calls are billed by the provider; project
            daily limits apply.
          </p>
          <label className="mission-watch">
            <input
              type="checkbox"
              checked={autonomy}
              onChange={(e) => {
                setAutonomy(e.target.checked);
                setKey(null);
              }}
            />{" "}
            Allow autonomous account-change follow-ups
          </label>
          <p className="service-small">
            Optional: check the supplied account every 30 minutes for 24 hours,
            with at most 3 total mission runs. New inference occurs only after a
            change and a successful budget reservation. You can stop the watch.
          </p>
          <button disabled={busy || !signedIn}>Commission the team</button>
          {!signedIn && <p>Sign in with your wallet above to submit a goal.</p>}
          {issue && (
            <p role="alert" className="native-alert">
              {issue}
            </p>
          )}
        </form>
        <div className="mission-list">
          <h3>Your team missions</h3>
          {!missions.length && (
            <p>
              Plans, specialist handoffs and combined reports will appear here.
            </p>
          )}
          {missions.map((m) => (
            <article className="service-job" key={m.id}>
              <strong>{m.status.replaceAll("_", " ")}</strong>
              <p>{m.goal}</p>
              <small>
                Coordinator: {name(m.coordinator)} · allowance {m.maxAiCalls}{" "}
                calls
              </small>
              {m.plan && (
                <>
                  <p>{m.plan.summary}</p>
                  <ol>
                    {m.plan.steps.map((s) => {
                      const t = m.taskSummaries?.find(
                        (t) => t.id === m.children[s.key],
                      );
                      return (
                        <li key={s.key}>
                          <b>{s.service}</b> →{" "}
                          {t ? name(t.agentId) : "finding a specialist"} ·{" "}
                          {t?.status || "waiting"}
                          <br />
                          {s.reason}
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
              {m.assembler && <p>Assembly: {name(m.assembler)}</p>}
              {m.error && <p role="alert">{m.error}</p>}
              {m.watch && (
                <p>
                  Autonomy: {m.watch.status} · {m.watch.runs}/{m.watch.maxRuns}{" "}
                  runs
                </p>
              )}
              {m.output && (
                <>
                  <details>
                    <summary>Read combined report</summary>
                    <pre>{m.output.artifact}</pre>
                  </details>
                  <small>SHA-256: {m.output.sha256}</small>
                  <div className="service-actions">
                    <button
                      type="button"
                      onClick={() => download(m, "missions")}
                    >
                      Download team report
                    </button>
                    {m.status === "REVIEW_READY" && (
                      <button
                        disabled={busy}
                        onClick={() => action(m, "accept")}
                      >
                        Accept trial report
                      </button>
                    )}
                  </div>
                </>
              )}
              {m.watch?.enabled && (
                <button disabled={busy} onClick={() => action(m, "stop-watch")}>
                  Stop autonomous follow-ups
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
      <div className="mission-activity">
        <h3>Live agent collaboration</h3>
        <p>
          Actual assignment and check events. Customer inputs and deliverables
          remain private.
        </p>
        {!(world.services.activity || []).length && (
          <p>No assignments yet. Idle agents make no inference calls.</p>
        )}
        {(world.services.activity || []).slice(0, 10).map((e, i) => (
          <div key={i}>
            <span>{name(e.sender)}</span>
            <b>→</b>
            <span>{name(e.receiver)}</span>
            <small>
              {e.kind.replaceAll("-", " ")} · {e.state}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
