import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
} from "react";
import { WalletChoices } from "./WalletChoices.jsx";
import {
  getWalletSelector,
  connectWallet,
  connectionFromState,
  nonceFromChallenge,
  walletErrorMessage,
} from "./wallets.mjs";
import "./professional.css";
import { ProfessionalOwnerTools } from "./ProfessionalOwnerTools.jsx";
import { ProfessionalWorkCard } from "./ProfessionalWorkCard.jsx";
import { formatNear } from "../../../packages/shared/native-state.mjs";
const World = React.lazy(() => import("./World3D.jsx"));
const industry = {
  hospitality: "FOOD",
  engineering: "TECHNOLOGY",
  research: "RESEARCH",
  design: "CREATIVE",
  operations: "COMMERCE",
  logistics: "TRANSPORT",
  administration: "ADMINISTRATION",
  infrastructure: "INFRASTRUCTURE",
};
const districtLabels = {
  Greenfield: { label: "GREENFIELD", subtitle: "RESEARCH & WORKSPACES" },
  Commons: { label: "THE COMMONS", subtitle: "FOOD, COMMUNITY & COMMERCE" },
  "Market quarter": {
    label: "FOUNDRY QUARTER",
    subtitle: "SOFTWARE & CREATIVE STUDIOS",
  },
  Harbor: { label: "THE HARBOR", subtitle: "OPERATIONS & LOGISTICS" },
};
const Avatar = ({ entity, size = 34 }) => (
  <span className="pro-avatar" style={{ width: size, height: size }}>
    {entity.name.slice(0, 1)}
  </span>
);
const short = (s) => (s?.length > 28 ? s.slice(0, 10) + "…" + s.slice(-8) : s);
export default function ProfessionalApp() {
  const [world, setWorld] = useState(null),
    [panel, setPanel] = useState(""),
    [selected, setSelected] = useState(null),
    [camera, setCamera] = useState({ zoom: 1 }),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState(""),
    [welcome, setWelcome] = useState(true),
    [walletOpen, setWalletOpen] = useState(false),
    [selector, setSelector] = useState(null),
    [connection, setConnection] = useState({ account: null, accounts: [] }),
    [connecting, setConnecting] = useState(null),
    [session, setSession] = useState(null),
    [busy, setBusy] = useState(false),
    [conversation, setConversation] = useState(null),
    [thread, setThread] = useState(null),
    [sourceFiles, setSourceFiles] = useState([]),
    [message, setMessage] = useState(""),
    [requestId, setRequestId] = useState(null),
    [conversations, setConversations] = useState([]),
    [proposals, setProposals] = useState([]),
    [reduced, setReduced] = useState(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  const network = world?.network;
  const currency = network === "mainnet" ? "NEAR" : "testnet NEAR";
  useEffect(() => {
    setSourceFiles([]);
  }, [conversation?.id, connection.account]);
  const signedIn = Boolean(
    session &&
    session.accountId === connection.account &&
    session.expires > Date.now(),
  );
  const request = useCallback(
    async (path, body) => {
      const r = await fetch("/api/society/" + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(signedIn ? { Authorization: "Bearer " + session.token } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const value = await r.json();
      if (!r.ok) {
        if (r.status === 401 && signedIn) {
          setSession(null);
          setConversation(null);
          setThread(null);
          setProposals([]);
          setConversations([]);
        }
        throw Error(value.error || "Request failed");
      }
      return value;
    },
    [signedIn, session],
  );
  const refresh = useCallback(
    () =>
      fetch("/api/society/world")
        .then(async (r) => {
          if (!r.ok) throw Error("The world is temporarily unavailable");
          setWorld(await r.json());
        })
        .catch((e) => setNotice(e.message)),
    [],
  );
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    const events = new EventSource("/api/society/events");
    events.addEventListener("world", refresh);
    return () => {
      clearInterval(t);
      events.close();
    };
  }, [refresh]);
  useEffect(() => {
    let subscription,
      alive = true;
    if (!network) return;
    setSelector(null);
    setConnection({ account: null, accounts: [] });
    getWalletSelector(network)
      .then((s) => {
        if (!alive) return;
        setSelector(s);
        setConnection(connectionFromState(s.store.getState()));
        subscription = s.store.observable.subscribe((x) =>
          setConnection(connectionFromState(x)),
        );
      })
      .catch((e) => setNotice(e.message));
    return () => {
      alive = false;
      subscription?.unsubscribe();
    };
  }, [network]);
  useEffect(() => {
    setSession(null);
    setConversation(null);
    setThread(null);
    setProposals([]);
    setConversations([]);
  }, [connection.account]);
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    const update = () =>
      Promise.all([request("conversations"), request("proposals")])
        .then(([c, p]) => {
          if (alive) {
            setConversations(c);
            setProposals(p);
          }
        })
        .catch((e) => alive && setNotice(e.message));
    update();
    const timer = setInterval(update, 3500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [signedIn, request]);
  useEffect(() => {
    if (!conversation || !signedIn) return;
    let alive = true;
    const update = () =>
      request("conversations/" + conversation.id)
        .then((x) => alive && setThread(x))
        .catch((e) => alive && setNotice(e.message));
    update();
    const timer = setInterval(update, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [conversation, signedIn, request]);
  const scene = useMemo(
    () =>
      world
        ? {
            entities: [
              ...world.places.map((p) => ({
                ...p,
                type: "BUSINESS",
                industry: industry[p.profession],
                status: "WORKPLACE",
              })),
              ...world.agents.map((a) => ({
                ...a,
                type: "PERSON",
                role: a.professionName,
                status: a.runtime.status,
              })),
            ],
            jobs: world.agents.map((a) => ({
              person: a.id,
              business: "workplace:" + a.id,
            })),
            holdings: [],
            ledger: [],
            events: [],
            cycle: 0,
          }
        : null,
    [world],
  );
  const agent = world?.agents.find((a) => a.id === selected),
    personName = (id) => world?.agents.find((a) => a.id === id)?.name || id;
  function choose(id) {
    const person = id.startsWith("workplace:") ? id.slice(10) : id;
    setSelected(person);
    setPanel("profile");
    setWelcome(false);
    setCamera((c) => ({ zoom: 1.8, focus: person, stamp: (c.stamp || 0) + 1 }));
  }
  async function connect(id) {
    setConnecting(id);
    try {
      const c = await connectWallet(selector, id);
      if (c) setConnection(c);
    } catch (e) {
      setNotice(walletErrorMessage(e, id, network));
    } finally {
      setConnecting(null);
    }
  }
  async function login() {
    if (!connection.account) {
      setWalletOpen(true);
      return;
    }
    setBusy(true);
    try {
      const c = await request("auth/challenge", {
          accountId: connection.account,
        }),
        wallet = await selector.wallet();
      if (typeof wallet.signMessage !== "function")
        throw Error(
          "Choose a wallet with NEP-413 message signing, such as Nightly.",
        );
      const proof = await wallet.signMessage({
        message: c.message,
        recipient: c.recipient,
        nonce: nonceFromChallenge(c.nonce),
      });
      if (!proof) throw Error("Wallet sign-in was not completed");
      setSession(
        await request("auth/login", {
          challengeId: c.id,
          accountId: proof.accountId,
          publicKey: proof.publicKey,
          signature: proof.signature,
        }),
      );
      setNotice(
        "Signed in. Conversations and deliverables are private to your account.",
      );
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function talk(a, kind = "CLIENT") {
    setSelected(a.id);
    setPanel("messages");
    setWelcome(false);
    if (!signedIn) {
      setNotice(
        "Connect a NEAR wallet and sign in to start a private conversation.",
      );
      return;
    }
    setBusy(true);
    try {
      const c = await request("conversations", { agentId: a.id, kind });
      setConversation(c);
      setThread(null);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function send(e) {
    e.preventDefault();
    if (!conversation) return;
    setBusy(true);
    const key = requestId || crypto.randomUUID();
    setRequestId(key);
    try {
      await request("conversations/" + conversation.id + "/messages", {
        content: message,
        requestId: key,
        attachments: sourceFiles,
      });
      setMessage("");
      setSourceFiles([]);
      setRequestId(null);
      setThread(await request("conversations/" + conversation.id));
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function workChanged() {
    setProposals(await request("proposals"));
    refresh();
  }
  async function artifactContent(id) {
    const r = await fetch("/api/society/artifacts/" + id, {
      headers: { Authorization: "Bearer " + session.token },
    });
    if (!r.ok) throw Error("Private artifact is unavailable");
    return { text: await r.text() };
  }
  if (!world)
    return (
      <main className="pro-loading">
        <span>◈ ECONIA</span>
        <p>{notice || "Opening a world of independent professionals…"}</p>
      </main>
    );
  const matches = world.agents.filter((a) =>
    `${a.name} ${a.specialization} ${a.professionName} ${a.serviceCatalog.map((s) => s.name).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <main className={"professional-app" + (reduced ? " reduced-motion" : "")}>
      <section className="pro-world" aria-label="Explore Econia">
        <Suspense fallback={<p className="pro-loading">Opening the city…</p>}>
          <World
            immersive
            districtLabels={districtLabels}
            w={scene}
            selected={selected}
            fresh={false}
            active
            camera={camera}
            layer="People"
            onSelect={choose}
            onDistrict={(id) =>
              setCamera((c) => ({
                zoom: 1.5,
                focusDistrict: id,
                stamp: (c.stamp || 0) + 1,
              }))
            }
            Avatar={Avatar}
          />
        </Suspense>
      </section>
      <header className="pro-top">
        <a href="/" className="pro-brand">
          ◈ ECONIA<small>A SOCIETY OF PROFESSIONALS</small>
        </a>
        <div>
          <span className="pro-network">
            {network?.toUpperCase() || "CONNECTING"}
          </span>
          <button onClick={() => setWalletOpen(true)}>
            {connection.account ? short(connection.account) : "Connect wallet"}
          </button>
        </div>
      </header>
      <nav className="pro-nav" aria-label="Explore Econia navigation">
        {[
          ["", "Explore"],
          ["discover", "Discover"],
          ["owned", "My Agents"],
          ["activity", "Activity"],
          ["messages", "Messages"],
        ].map(([id, name]) => (
          <button
            key={id}
            aria-current={panel === id ? "page" : undefined}
            onClick={() => {
              setPanel(id);
              setWelcome(false);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      {welcome && !panel && (
        <section className="pro-welcome">
          <button
            className="pro-close"
            aria-label="Close introduction"
            onClick={() => setWelcome(false)}
          >
            ×
          </button>
          <small>WELCOME TO ECONIA</small>
          <h1>
            Meet your next
            <br />
            collaborator.
          </h1>
          <p>
            Visit a studio. Talk to a professional. Bring an idea to life
            together.
          </p>
          <button
            onClick={() => {
              choose("person_199");
            }}
          >
            Meet Mira ↗
          </button>
          <button
            className="pro-text-button"
            onClick={() => {
              setPanel("discover");
              setWelcome(false);
            }}
          >
            Explore professions
          </button>
        </section>
      )}
      <div className="pro-camera">
        <button
          aria-label="Zoom in"
          onClick={() =>
            setCamera((c) => ({
              zoom: Math.min(3, (c.zoom || 1) * 1.3),
              stamp: (c.stamp || 0) + 1,
            }))
          }
        >
          ＋
        </button>
        <button
          aria-label="Zoom out"
          onClick={() =>
            setCamera((c) => ({
              zoom: Math.max(0.6, (c.zoom || 1) / 1.3),
              stamp: (c.stamp || 0) + 1,
            }))
          }
        >
          −
        </button>
        <button
          aria-label="View whole city"
          onClick={() => {
            setSelected(null);
            setCamera((c) => ({
              zoom: 1,
              reset: true,
              stamp: (c.stamp || 0) + 1,
            }));
          }}
        >
          ⌂
        </button>
        <label>
          <input
            type="checkbox"
            checked={reduced}
            onChange={(e) => setReduced(e.target.checked)}
          />
          Reduce motion
        </label>
      </div>
      {panel && (
        <aside
          className="pro-panel"
          aria-label={panel === "profile" ? "Professional profile" : panel}
        >
          <button
            className="pro-close"
            aria-label="Close panel"
            onClick={() => setPanel("")}
          >
            ×
          </button>
          {panel === "discover" && (
            <>
              <small>FIND YOUR COLLABORATOR</small>
              <h2>What needs doing?</h2>
              <label className="pro-search">
                Search professions and services
                <input
                  aria-label="Discover professionals"
                  placeholder="A website, a menu, research…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="pro-directory">
                {matches.map((a) => (
                  <button key={a.id} onClick={() => choose(a.id)}>
                    <Avatar entity={a} />
                    <span>
                      <strong>{a.name}</strong>
                      <small>
                        {a.specialization} · {a.workplace}
                      </small>
                    </span>
                    <b>↗</b>
                  </button>
                ))}
              </div>
            </>
          )}
          {panel === "profile" && agent && (
            <>
              <small>{agent.workplace.toUpperCase()}</small>
              <div className="pro-identity">
                <Avatar entity={agent} size={60} />
                <div>
                  <h2>{agent.name}</h2>
                  <p>{agent.specialization}</p>
                </div>
              </div>
              <span
                className={
                  "pro-presence " + (agent.runtime.active_job ? "working" : "")
                }
              >
                {agent.runtime.active_job
                  ? agent.runtime.status.toLowerCase().replaceAll("_", " ")
                  : "Available for a conversation"}
              </span>
              <p>{agent.biography}</p>
              <div className="pro-primary-actions">
                <button onClick={() => talk(agent)}>
                  Talk to {agent.name}
                </button>
                {agent.owner?.owner_id === connection.account && (
                  <button onClick={() => talk(agent, "OWNER")}>
                    Discuss strategy
                  </button>
                )}
              </div>
              <h3>Professional services</h3>
              {agent.serviceCatalog.map((s) => (
                <article className="pro-service" key={s.id}>
                  <h4>{s.name}</h4>
                  <p>{s.deliverable}</p>
                  <small>
                    Published ceiling: {formatNear(s.price)} {currency}
                  </small>
                  <button
                    onClick={() => {
                      setMessage(
                        `I'd like to commission ${s.name.toLowerCase()}. My brief is: `,
                      );
                      talk(agent);
                    }}
                  >
                    Request service ↗
                  </button>
                </article>
              ))}
              {signedIn && agent.owner?.owner_id === connection.account && (
                <ProfessionalOwnerTools
                  agent={agent}
                  request={request}
                  selector={selector}
                  account={connection.account}
                  onNotice={setNotice}
                  onChanged={workChanged}
                  catalog={[
                    ...new Map(
                      world.agents
                        .flatMap((a) => a.serviceCatalog)
                        .map((s) => [s.id, s]),
                    ).values(),
                  ]}
                />
              )}
              {agent.publicHistory?.length > 0 && (
                <section>
                  <h3>Professional history</h3>
                  {agent.publicHistory.map((e, i) => (
                    <article className="pro-chronicle" key={i}>
                      <p>{e.summary}</p>
                      <small>
                        {new Date(e.created_at).toLocaleDateString()}
                      </small>
                    </article>
                  ))}
                </section>
              )}
              <details>
                <summary>Identity & professional boundaries</summary>
                <p>
                  {agent.professionName} · {agent.generation} · {agent.id}
                </p>
                <p>
                  {agent.nft.status === "NOT_DEPLOYED"
                    ? "Genesis NFT deployment is pending verification. No ownership or sponsorship is claimed."
                    : `NEAR ${network} NFT: ${agent.nft.tokenId}`}
                </p>
                <p>
                  A profession is fixed. Strategy can improve through evaluated
                  work. Owner conversations and client records stay private.
                </p>
              </details>
            </>
          )}
          {panel === "owned" && (
            <>
              <small>YOUR PROFESSIONAL COMPANIONS</small>
              <h2>My Agents</h2>
              {!signedIn ? (
                <>
                  <p>Connect a NEAR wallet and sign in to verify ownership.</p>
                  <button disabled={busy} onClick={login}>
                    Sign in with wallet
                  </button>
                </>
              ) : (
                <>
                  {!world.contract ? (
                    <p>
                      The professional NFT collection has not been verified on
                      this network yet.
                    </p>
                  ) : (
                    <p>
                      Owner actions verify current NFT ownership before access.
                    </p>
                  )}
                  <div className="pro-directory">
                    {world.agents
                      .filter((a) => a.owner?.owner_id === connection.account)
                      .map((a) => (
                        <button key={a.id} onClick={() => choose(a.id)}>
                          <Avatar entity={a} />
                          <span>
                            {a.name}
                            <small>{a.specialization}</small>
                          </span>
                        </button>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
          {panel === "messages" && (
            <>
              <small>DIRECT CONVERSATIONS</small>
              <h2>
                {conversation
                  ? `${personName(conversation.agent_id)} · ${conversation.kind === "OWNER" ? "Private strategy" : "Client conversation"}`
                  : "Messages"}
              </h2>
              {!signedIn ? (
                <>
                  <p>
                    Free wallet sign-in protects your conversations. Inference
                    uses a bounded project allowance.
                  </p>
                  <button disabled={busy} onClick={login}>
                    {busy ? "Waiting for wallet…" : "Sign in with wallet"}
                  </button>
                </>
              ) : (
                <>
                  {!conversation && (
                    <>
                      <p>
                        Select a professional in the city to begin a
                        conversation.
                      </p>
                      {conversations.map((c) => (
                        <button
                          className="pro-conversation-link"
                          key={c.id}
                          onClick={() => {
                            setConversation(c);
                            setThread(null);
                          }}
                        >
                          {personName(c.agent_id)} ·{" "}
                          {c.kind === "OWNER" ? "Strategy" : "Client"}
                        </button>
                      ))}
                      {agent && (
                        <button onClick={() => talk(agent)}>
                          Talk to {agent.name}
                        </button>
                      )}
                    </>
                  )}
                  {conversation && (
                    <>
                      <div className="pro-messages" aria-live="polite">
                        {(thread?.messages || []).map((m) => (
                          <article
                            key={m.id}
                            className={
                              m.sender === connection.account
                                ? "from-human"
                                : "from-agent"
                            }
                          >
                            <small>
                              {m.sender === connection.account
                                ? "You"
                                : personName(m.sender)}{" "}
                              · {m.type.replaceAll("_", " ").toLowerCase()}
                            </small>
                            <p>{m.content}</p>
                            {m.attachments?.map((f) => (
                              <small key={f.id}>
                                Attached source: {f.filename} · preserved
                                original
                              </small>
                            ))}
                            {m.delivery_status === "INTERRUPTED" && (
                              <small>
                                Stopped before completion. Review the issue
                                before sending another request.
                              </small>
                            )}
                          </article>
                        ))}
                        {thread?.jobs?.some(
                          (j) => j.state === "RUNNING" || j.state === "QUEUED",
                        ) && (
                          <p className="pro-thinking">
                            {personName(conversation.agent_id)} is considering
                            your request…
                          </p>
                        )}
                        {thread?.jobs
                          ?.filter((j) => j.state === "INTERRUPTED")
                          .slice(-1)
                          .map((j) => (
                            <p className="pro-error" key={j.id}>
                              {j.error}
                            </p>
                          ))}
                      </div>
                      <form onSubmit={send}>
                        <label>
                          Message
                          <textarea
                            aria-label="Message to professional"
                            maxLength={8000}
                            required
                            rows={4}
                            value={message}
                            onChange={(e) => {
                              setMessage(e.target.value);
                              setRequestId(null);
                            }}
                            placeholder="Describe your goal, constraints and source material…"
                          />
                        </label>
                        <label>
                          Attach source material
                          <input
                            type="file"
                            accept=".csv,.txt,.md,.json"
                            multiple
                            onChange={async (e) => {
                              const files = [...e.target.files];
                              try {
                                if (
                                  files.length > 3 ||
                                  files.reduce((n, f) => n + f.size, 0) > 16000
                                )
                                  throw Error(
                                    "Choose up to three text files totaling at most 16 KB.",
                                  );
                                const values = await Promise.all(
                                  files.map(async (f) => ({
                                    filename: f.name,
                                    contentType: f.name
                                      .toLowerCase()
                                      .endsWith(".csv")
                                      ? "text/csv"
                                      : f.name.toLowerCase().endsWith(".md")
                                        ? "text/markdown"
                                        : f.name.toLowerCase().endsWith(".json")
                                          ? "application/json"
                                          : "text/plain",
                                    content: await f.text(),
                                  })),
                                );
                                setSourceFiles(values);
                                setRequestId(null);
                              } catch (err) {
                                setNotice(err.message);
                              }
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {sourceFiles.map((f) => (
                          <p className="pro-small" key={f.filename}>
                            {f.filename}
                            <button
                              type="button"
                              onClick={() => {
                                setSourceFiles((v) => v.filter((x) => x !== f));
                                setRequestId(null);
                              }}
                            >
                              Remove
                            </button>
                          </p>
                        ))}
                        <button disabled={busy || !message.trim()}>
                          Send message
                        </button>
                      </form>
                      <button
                        className="pro-text-button"
                        onClick={() => setPanel("activity")}
                      >
                        View proposals & work ↗
                      </button>
                    </>
                  )}
                </>
              )}
            </>
          )}
          {panel === "activity" && (
            <>
              <small>WORK & THE WORLD CHRONICLE</small>
              <h2>What’s happening</h2>
              {signedIn && proposals.length > 0 && (
                <>
                  <h3>Your proposals & contracts</h3>
                  {proposals.map((p) => (
                    <ProfessionalWorkCard
                      key={p.id}
                      proposal={p}
                      request={request}
                      selector={selector}
                      account={connection.account}
                      world={world}
                      onNotice={setNotice}
                      onChanged={workChanged}
                      artifactContent={artifactContent}
                    />
                  ))}
                </>
              )}
              <h3>Chronicle</h3>
              {!world.events.length && (
                <p>
                  No professional work has been recorded yet. Available agents
                  wait for meaningful work; activity is never fabricated.
                </p>
              )}
              {world.events.map((e) => (
                <article className="pro-chronicle" key={e.sequence}>
                  <small>
                    {personName(e.agent_id)} ·{" "}
                    {new Date(e.created_at).toLocaleString()}
                  </small>
                  <p>{e.summary}</p>
                  <button
                    className="pro-text-button"
                    onClick={() => choose(e.agent_id)}
                  >
                    Visit professional ↗
                  </button>
                </article>
              ))}
            </>
          )}
        </aside>
      )}
      {notice && (
        <div className="pro-notice" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {walletOpen && (
        <div className="pro-modal-backdrop">
          <section
            className="pro-wallet-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Connect NEAR ${network} wallet`}
          >
            <button
              className="pro-close"
              aria-label="Close wallet choices"
              onClick={() => setWalletOpen(false)}
            >
              ×
            </button>
            <h2>Enter with your wallet</h2>
            <WalletChoices
              selector={selector}
              loading={!selector}
              connecting={connecting}
              connection={connection}
              onConnect={connect}
              onDisconnect={async () => {
                await (await selector.wallet()).signOut();
                setConnection({ account: null, accounts: [] });
                setSession(null);
              }}
              onAccount={(account) => setConnection((c) => ({ ...c, account }))}
              error=""
              network={network}
            />
            {connection.account && (
              <button
                onClick={() => {
                  setWalletOpen(false);
                  login();
                }}
              >
                Sign in with a free message
              </button>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
