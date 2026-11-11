import React, { useEffect, useState } from "react";
import { nonceFromChallenge } from "./wallets.mjs";
import "./services.css";
import { MissionWorkspace } from "./MissionWorkspace.jsx";
export function ServiceWorkspace({
  world,
  selector,
  connection,
  selected,
  onConnect,
  onNotify,
  onReload,
}) {
  const [session, setSession] = useState(null),
    [agentId, setAgentId] = useState("person_103"),
    [serviceGroup, setServiceGroup] = useState("web3"),
    [workspaceMode, setWorkspaceMode] = useState("team"),
    [input, setInput] = useState(""),
    [brief, setBrief] = useState(""),
    [jobs, setJobs] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [purpose, setPurpose] = useState(""),
    [capability, setCapability] = useState("source-brief"),
    [requestId, setRequestId] = useState(null);
  const catalog = world.services?.catalog || [],
    workers = world.agents.filter((a) => a.serviceProfile?.active),
    agent = world.agents.find((a) => a.id === agentId),
    owned = world.agents.find(
      (a) => a.id === selected && a.token?.owner_id === connection.account,
    ),
    service = catalog.find((s) => s.id === agent?.serviceProfile?.service);
  const signedIn =
    session &&
    session.accountId === connection.account &&
    session.expires > Date.now();
  async function request(path, body, method = body ? "POST" : "GET") {
    const r = await fetch("/api/services/" + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(signedIn ? { Authorization: "Bearer " + session.token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const j = await r.json();
    if (!r.ok) throw Error(j.error || "Service request failed");
    return j;
  }
  async function login() {
    if (!connection.account) {
      onConnect();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const c = await request("challenge", { accountId: connection.account }),
        wallet = await selector.wallet();
      if (typeof wallet.signMessage !== "function")
        throw Error(
          "This wallet needs NEP-413 message signing. Use a wallet that supports signed login, such as Nightly.",
        );
      const proof = await wallet.signMessage({
        message: c.message,
        recipient: c.recipient,
        nonce: nonceFromChallenge(c.nonce),
      });
      if (!proof) throw Error("Sign-in was not completed in the wallet");
      const s = await request("login", {
        challengeId: c.id,
        accountId: proof.accountId,
        publicKey: proof.publicKey,
        signature: proof.signature,
      });
      setSession(s);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setJobs([]);
    setSession(null);
  }, [connection.account]);
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    const update = () =>
      request("tasks")
        .then((j) => {
          if (alive) setJobs(j);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    update();
    const t = setInterval(update, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [session, connection.account]);
  useEffect(() => {
    setPurpose(owned?.serviceProfile?.purpose || "");
    setCapability(owned?.serviceProfile?.service || "custom");
  }, [owned?.id, owned?.serviceProfile?.purpose]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const key = requestId || crypto.randomUUID();
    setRequestId(key);
    try {
      const job = await request("tasks", {
        agentId,
        input,
        brief,
        requestId: key,
      });
      setJobs((old) => [job, ...old.filter((t) => t.id !== job.id)]);
      setRequestId(null);
      onNotify("Task queued within the project-funded trial allowance.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function configure(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const p = await request(
        "profile",
        { agentId: owned.id, service: capability, purpose },
        "PUT",
      );
      onNotify(
        p.active
          ? "Owner brief saved."
          : "Owner brief saved; capability activation needs review.",
      );
      await onReload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function accept(id) {
    setBusy(true);
    try {
      const t = await request("tasks/" + id + "/accept", {});
      setJobs((old) => old.map((j) => (j.id === id ? t : j)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function download(t, kind = "tasks") {
    try {
      const r = await fetch(
        "/api/services/" + kind + "/" + t.id + "/artifact",
        {
          headers: { Authorization: "Bearer " + session.token },
        },
      );
      if (!r.ok) throw Error("Artifact download failed");
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = "econia-" + t.id + ".md";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    }
  }
  if (!world.services) return null;
  return (
    <section className="service-workspace" id="services">
      <div className="service-heading">
        <div>
          <small>THE FIRST WORKFORCE</small>
          <h2>Give an agent real work.</h2>
          <p>
            {world.services.activeCapacity} activated identities. Tasks run on
            the hosted worker; idle agents make no AI calls.
          </p>
        </div>
        <button disabled={busy} onClick={login}>
          {signedIn
            ? "Signed in · " + connection.account
            : "Sign in with wallet"}
        </button>
      </div>
      <div className="service-actions" aria-label="Work assignment mode">
        {["team", "single"].map((mode) => (
          <button
            key={mode}
            aria-pressed={workspaceMode === mode}
            onClick={() => setWorkspaceMode(mode)}
          >
            {mode === "team"
              ? "Give a team a goal"
              : "Choose a single specialist"}
          </button>
        ))}
      </div>
      {workspaceMode === "single" && (
        <>
          <div className="service-actions" aria-label="Service categories">
            {["web3", "digital"].map((group) => (
              <button
                key={group}
                aria-pressed={serviceGroup === group}
                onClick={() => {
                  setServiceGroup(group);
                  setAgentId(
                    catalog.find(
                      (s) => (s.category === "web3") === (group === "web3"),
                    )?.agentId,
                  );
                  setRequestId(null);
                }}
              >
                {group === "web3" ? "Web3 services" : "Documents & data"}
              </button>
            ))}
          </div>
          <div
            className={
              "service-catalog " +
              (serviceGroup === "web3" ? "web3-catalog" : "")
            }
          >
            {catalog
              .filter(
                (s) => (s.category === "web3") === (serviceGroup === "web3"),
              )
              .map((s) => (
                <button
                  key={s.id}
                  className={agentId === s.agentId ? "selected" : ""}
                  onClick={() => {
                    setAgentId(s.agentId);
                    setRequestId(null);
                  }}
                >
                  <strong>{s.label}</strong>
                  <p>{s.description}</p>
                  <small>
                    {s.aiCalls
                      ? "Up to 1 AI call per task"
                      : "0 AI calls · deterministic tools"}{" "}
                    ·{" "}
                    {workers.some((a) => a.id === s.agentId)
                      ? "Available"
                      : "Unavailable"}
                  </small>
                </button>
              ))}
          </div>
        </>
      )}
      <div className="service-notice">
        <strong>Project-funded trial · 0 NEAR charged</strong>
        <p>
          The project pays bounded inference costs. This is not yet a paid
          marketplace: customer acceptance here records approval, without an
          onchain payment. Limit: {world.services.dailyAiLimit} reserved AI
          calls across the project and {world.services.accountTaskLimit} tasks
          per wallet per UTC day.
        </p>
      </div>
      {error && (
        <p role="alert" className="native-alert">
          {error}
        </p>
      )}
      {workspaceMode === "team" && (
        <MissionWorkspace
          world={world}
          request={request}
          signedIn={signedIn}
          busy={busy}
          setBusy={setBusy}
          download={download}
        />
      )}
      {workspaceMode === "single" && (
        <div className="service-columns">
          <form onSubmit={submit}>
            <h3>{service?.label || "Choose an available worker"}</h3>
            <label>
              {service?.inputLabel || "Task input"}
              <textarea
                aria-label="Service task input"
                maxLength={16000}
                minLength={service?.minInputLength || 40}
                required
                rows={9}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setRequestId(null);
                }}
                placeholder={
                  service?.placeholder ||
                  (service?.id === "csv-audit"
                    ? "name,units,price\nNotebook,4,2.50\nPen,10,0.30"
                    : "Paste the document or text you want this agent to work on.")
                }
              />
            </label>
            <label>
              {service?.category === "web3"
                ? "Optional notes (chain report fields are fixed)"
                : "What should the output focus on?"}
              <textarea
                aria-label="Task instructions"
                maxLength={1000}
                rows={3}
                value={brief}
                onChange={(e) => {
                  setBrief(e.target.value);
                  setRequestId(null);
                }}
              />
            </label>
            <p className="service-small">
              {service?.category === "web3"
                ? "Public account and contract IDs are sent to the configured NEAR RPC. These tools use no AI; notes do not alter the read-only queries."
                : "Document task input and instructions are sent to NEAR AI Cloud. CSV analysis stays in the worker."}{" "}
              Your task and output are private to your signed-in account.
            </p>
            <button
              disabled={busy || !signedIn || !agent?.serviceProfile?.active}
            >
              Submit {service?.aiCalls ? "AI-assisted" : "tool-based"} task
            </button>
            {!signedIn && <p>Sign in with your wallet before submitting.</p>}
          </form>
          <div className="service-jobs">
            <h3>Your deliverables</h3>
            {jobs.length === 0 && (
              <p>Your submitted tasks and checked outputs will appear here.</p>
            )}
            {jobs.map((t) => (
              <article className="service-job" key={t.id}>
                <strong>
                  {catalog.find((c) => c.id === t.service)?.label} ·{" "}
                  {t.status.replaceAll("_", " ")}
                </strong>
                <small>
                  {t.id} · {new Date(t.createdAt).toLocaleString()}
                </small>
                <ol>
                  {t.trace.map((step, i) => (
                    <li key={i}>
                      {world.agents.find((a) => a.id === step.agentId)?.name ||
                        "Release gate"}
                      : {step.tool} — {step.status}
                    </li>
                  ))}
                </ol>
                {t.error && <p role="alert">{t.error}</p>}
                {t.output && (
                  <>
                    <details>
                      <summary>Read checked output</summary>
                      <pre>{t.output.artifact}</pre>
                    </details>
                    <p>{t.output.review}</p>
                    <ul>
                      {t.output.checks.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                    <small>SHA-256: {t.output.sha256}</small>
                    <div className="service-actions">
                      <button type="button" onClick={() => download(t)}>
                        Download Markdown
                      </button>
                      {t.status === "REVIEW_READY" && (
                        <button
                          disabled={busy}
                          type="button"
                          onClick={() => accept(t.id)}
                        >
                          Accept trial deliverable
                        </button>
                      )}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      <section className="service-owner">
        <h3>Define your agent’s purpose</h3>
        <p>
          Select an NFT you own in the roster to set its purpose and preferred
          service capability. A custom brief saves your intent; it does not add
          new tools or activate an unreviewed agent.
        </p>
        {owned ? (
          <form onSubmit={configure}>
            <strong>{owned.name}</strong>
            <label>
              Preferred capability
              <select
                aria-label="Owner preferred capability"
                value={capability}
                onChange={(e) => setCapability(e.target.value)}
              >
                <option value="custom">
                  Custom capability — review required
                </option>
                {owned.serviceProfile?.service &&
                  !catalog.some(
                    (s) => s.id === owned.serviceProfile.service,
                  ) && (
                    <option value={owned.serviceProfile.service}>
                      {owned.role}
                    </option>
                  )}
                {catalog.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Owner brief
              <textarea
                aria-label="Owner service brief"
                minLength={15}
                maxLength={1000}
                required
                rows={4}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </label>
            <button disabled={busy || !signedIn}>Save owner brief</button>
          </form>
        ) : (
          <p>
            Your connected wallet must be the current NFT owner. Current
            founding identities are owned by the project account.
          </p>
        )}
      </section>
    </section>
  );
}
