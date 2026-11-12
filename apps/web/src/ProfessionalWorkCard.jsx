import React, { useState, useEffect } from "react";
import { formatNear } from "../../../packages/shared/native-state.mjs";
export function ProfessionalWorkCard({
  proposal: p,
  request,
  selector,
  account,
  world,
  onNotice,
  onChanged,
  artifactContent,
}) {
  const [work, setWork] = useState(null),
    [revisionFeedback, setRevisionFeedback] = useState("");
  const [files, setFiles] = useState([]),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [issue, setIssue] = useState(""),
    [collaboration, setCollaboration] = useState([]),
    [rating, setRating] = useState(4),
    [clarification, setClarification] = useState(""),
    [feedback, setFeedback] = useState("");
  const name = (id) => world.agents.find((a) => a.id === id)?.name || id;
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!p.contract_id) return;
      try {
        const c = await request("contracts/" + p.contract_id);
        if (alive) setWork(c);
        if (["REVIEW_READY", "SETTLED"].includes(c.state)) {
          const f = await request("contracts/" + p.contract_id + "/artifacts");
          if (alive) setFiles(f);
        }
      } catch (e) {
        if (alive) setIssue(e.message);
      }
    }
    load();
    const timer = setInterval(load, 3500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [p.contract_id, p.contract_state, request]);
  async function walletAction(action) {
    setBusy(true);
    setIssue("");
    try {
      const tx = await request(
        action === "funding"
          ? "proposals/" + p.id + "/funding"
          : "contracts/" + p.contract_id + "/acceptance",
        {},
      );
      const result = await (
        await selector.wallet()
      ).signAndSendTransaction({ ...tx, signerId: account });
      const transactionHash =
        result?.transaction?.hash || result?.transaction_outcome?.id;
      if (!transactionHash)
        throw Error(
          "Inspect your wallet before retrying; confirmation is unavailable.",
        );
      await request(
        action === "funding"
          ? "proposals/" + p.id + "/confirm-funding"
          : "contracts/" + p.contract_id + "/confirm-acceptance",
        { transactionHash },
      );
      onNotice(
        action === "funding"
          ? "Testnet escrow confirmed; work is queued."
          : "Delivery accepted and testnet settlement confirmed.",
      );
      onChanged();
    } catch (e) {
      setIssue(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function openFile(f, download = false) {
    setBusy(true);
    try {
      const content = await artifactContent(f.id);
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(content.text),
      );
      const actual = [...new Uint8Array(digest)]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      if (actual !== f.sha256)
        throw Error("Artifact checksum did not match its verified record");
      if (download) {
        const url = URL.createObjectURL(
          new Blob([content.text], { type: f.content_type }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = f.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else setPreview({ ...f, text: content.text });
    } catch (e) {
      setIssue(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submitFeedback(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await request("contracts/" + p.contract_id + "/feedback", {
        rating,
        feedback,
      });
      setFeedback("");
      onNotice("Feedback recorded; a bounded reflection job is queued.");
      onChanged();
    } catch (e) {
      setIssue(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="pro-service pro-work-card">
      <small>{(p.contract_state || p.state).replaceAll("_", " ")}</small>
      <h4>
        {name(p.provider_id)} ·{" "}
        {
          world.agents
            .find((a) => a.id === p.provider_id)
            ?.serviceCatalog.find((s) => s.id === p.service_id)?.name
        }
      </h4>
      <p>{p.scope}</p>
      {p.source && (
        <small>Source: {p.source.filename} · original data preserved</small>
      )}
      <p>
        {formatNear(p.total_price || p.price)} testnet NEAR · valueless test
        assets
      </p>
      {issue && (
        <p role="alert" className="pro-error">
          {issue}
        </p>
      )}
      <button
        onClick={async () => {
          try {
            setCollaboration(
              await request("proposals/" + p.id + "/collaboration"),
            );
          } catch (e) {
            setIssue(e.message);
          }
        }}
      >
        Inspect agent collaboration
      </button>
      {collaboration.map((m, i) => (
        <article className="pro-message-event" key={i}>
          <small>
            {name(m.sender)} → {name(m.recipient)} ·{" "}
            {m.type.replaceAll("_", " ")}
          </small>
          <p>
            {(() => {
              try {
                const v = JSON.parse(m.content);
                return [
                  v.message,
                  v.scope,
                  v.priceYocto
                    ? formatNear(v.priceYocto) + " testnet NEAR"
                    : "",
                ]
                  .filter(Boolean)
                  .join("\n\n");
              } catch {
                return m.content;
              }
            })()}
          </p>
        </article>
      ))}
      {["NEGOTIATING", "NEEDS_CLARIFICATION"].includes(p.state) &&
        collaboration.length > 0 && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const targets = [
                  ...new Set(
                    collaboration
                      .filter(
                        (m) =>
                          m.state === "DECLINED" || m.state === "REQUESTED",
                      )
                      .map((m) => m.id),
                  ),
                ];
                for (const id of targets)
                  await request("agent-threads/" + id + "/clarify", {
                    content: clarification,
                  });
                setClarification("");
                onNotice(
                  "Clarification sent. Each specialist will independently reconsider their quotation.",
                );
                onChanged();
              } catch (e) {
                setIssue(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Clarify the requested work
              <textarea
                value={clarification}
                onChange={(e) => setClarification(e.target.value)}
                minLength={20}
                maxLength={3000}
                required
              />
            </label>
            <button disabled={busy || clarification.length < 20}>
              Send clarification to pending specialists
            </button>
          </form>
        )}
      {p.allocations?.length > 1 && (
        <ul>
          {p.allocations.map((a) => (
            <li key={a.allocation_index}>
              {name(a.agent_id)} · {formatNear(a.price)} testnet NEAR
            </li>
          ))}
        </ul>
      )}
      {p.state === "PROPOSED" && !p.buyer_agent && world.settlementReady && (
        <button disabled={busy} onClick={() => walletAction("funding")}>
          Review scope & testnet funding
        </button>
      )}
      {!world.settlementReady && (
        <p className="pro-small">
          Testnet funding is unavailable until contract and worker permissions
          are verified.
        </p>
      )}
      {work?.issues?.length > 0 && (
        <section>
          <h5>Work needs correction</h5>
          <label>
            Correction instructions
            <textarea
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              maxLength={2000}
              placeholder="Explain what needs correcting in the existing scope."
            />
          </label>
          {work.issues.map((i) => (
            <article key={i.id}>
              <p>
                {name(i.provider_id)}: {i.attempt.error}
              </p>
              <button
                disabled={busy || revisionFeedback.length < 20}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await request("contracts/" + i.id + "/revision", {
                      feedback: revisionFeedback,
                    });
                    setRevisionFeedback("");
                    onNotice(
                      "A bounded revision is queued against the existing escrow.",
                    );
                    onChanged();
                  } catch (e) {
                    setIssue(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Request a corrected deliverable
              </button>
            </article>
          ))}
        </section>
      )}
      {files.map((f) => (
        <div className="pro-file" key={f.id}>
          <strong>{f.filename}</strong>
          <small>Checked · SHA-256 {f.sha256.slice(0, 12)}…</small>
          <button disabled={busy} onClick={() => openFile(f)}>
            Preview
          </button>
          <button disabled={busy} onClick={() => openFile(f, true)}>
            Download
          </button>
        </div>
      ))}
      {preview && (
        <section className="pro-deliverable-preview">
          <button className="pro-text-button" onClick={() => setPreview(null)}>
            Close preview
          </button>
          {preview.content_type === "text/html" ? (
            <iframe title={preview.filename} sandbox="" srcDoc={preview.text} />
          ) : preview.content_type === "image/svg+xml" ? (
            <img
              alt="Verified professional style board"
              src={
                "data:image/svg+xml;charset=utf-8," +
                encodeURIComponent(preview.text)
              }
            />
          ) : (
            <pre>{preview.text}</pre>
          )}
        </section>
      )}
      {p.contract_state === "REVIEW_READY" && (
        <>
          <p className="pro-small">
            Review the deliverables before accepting. Acceptance releases the
            testnet escrow to the contracted professionals.
          </p>
          <button disabled={busy} onClick={() => walletAction("acceptance")}>
            Accept checked work in wallet
          </button>
        </>
      )}
      {["REVIEW_READY", "SETTLED"].includes(p.contract_state) && (
        <details>
          <summary>Give professional feedback</summary>
          <form onSubmit={submitFeedback}>
            <label>
              Your assessment
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option value={n} key={n}>
                    {n} / 5
                  </option>
                ))}
              </select>
            </label>
            <label>
              What worked, and what should change?
              <textarea
                required
                minLength={10}
                maxLength={2000}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
              />
            </label>
            <button disabled={busy}>Record feedback</button>
          </form>
          <p className="pro-small">
            Reflection updates private strategy memory for this client
            relationship. It does not train model weights or change professional
            authority.
          </p>
        </details>
      )}
    </article>
  );
}
