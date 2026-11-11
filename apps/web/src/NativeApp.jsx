import React, { useEffect, useMemo, useState, Suspense } from "react";
import { WalletChoices } from "./WalletChoices.jsx";
import { ServiceWorkspace } from "./ServiceWorkspace.jsx";
import {
  getWalletSelector,
  connectWallet,
  connectionFromState,
  walletErrorMessage,
} from "./wallets.mjs";
import { nativeTransaction } from "../../../packages/shared/native-near.mjs";
import { formatNear } from "../../../packages/shared/native-state.mjs";
import buildings from "./native-city-layout.json";
import "./native.css";
const World3D = React.lazy(() => import("./World3D.jsx"));
const districts = {
  "Food artisan": "Commons",
  Grower: "Greenfield",
  Merchant: "Market quarter",
  Courier: "Harbor",
};
function Avatar({ entity, size = 29 }) {
  return (
    <span className="native-avatar" style={{ width: size, height: size }}>
      {entity.name.slice(0, 1)}
    </span>
  );
}
const short = (s) => (s?.length > 24 ? s.slice(0, 10) + "…" + s.slice(-8) : s);
export default function NativeApp() {
  const [world, setWorld] = useState(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [role, setRole] = useState("All"),
    [selected, setSelected] = useState(null),
    [camera, setCamera] = useState({ zoom: 1 }),
    [walletOpen, setWalletOpen] = useState(false),
    [selector, setSelector] = useState(null),
    [connection, setConnection] = useState({ accounts: [], account: null }),
    [connecting, setConnecting] = useState(null),
    [walletError, setWalletError] = useState(""),
    [amount, setAmount] = useState(""),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState("");
  const reload = async () => {
    try {
      const r = await fetch("/api/native/world");
      if (!r.ok) throw Error("Mainnet verification is temporarily unavailable");
      setWorld(await r.json());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    reload();
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let sub,
      alive = true;
    getWalletSelector("mainnet")
      .then((s) => {
        if (!alive) return;
        setSelector(s);
        setConnection(connectionFromState(s.store.getState()));
        sub = s.store.observable.subscribe((state) =>
          setConnection(connectionFromState(state)),
        );
      })
      .catch((e) => setWalletError(e.message));
    return () => {
      alive = false;
      sub?.unsubscribe();
    };
  }, []);
  const scene = useMemo(
    () =>
      world
        ? {
            entities: [
              ...buildings.map((e) => ({
                ...e,
                type: "BUSINESS",
                status: "PRESENTATION",
              })),
              ...world.agents.map((a) => ({
                ...a,
                type: "PERSON",
                district: districts[a.legacyRole] || "Commons",
                status: "ACTIVE",
              })),
            ],
            jobs: [],
            holdings: [],
            events: [],
            ledger: [],
            cycle: 0,
          }
        : null,
    [world],
  );
  const choose = (id) => {
    setSelected(id);
    setCamera((c) => ({ zoom: 2, focus: id, stamp: (c.stamp ?? 0) + 1 }));
    setNotice("");
  };
  const agent = world?.agents.find((a) => a.id === selected);
  const [receiver, setReceiver] = useState("");
  async function transfer(e) {
    e.preventDefault();
    setPending(true);
    setNotice("");
    try {
      const r = await fetch(
        "/api/native/transfer?" +
          new URLSearchParams({ agent: agent.id, receiver }),
      );
      const tx = await r.json();
      if (!r.ok) throw Error(tx.error);
      const wallet = await selector.wallet();
      const result = await wallet.signAndSendTransaction({
        ...tx,
        signerId: connection.account,
      });
      if (!result || !Object.hasOwn(result.status ?? {}, "SuccessValue"))
        throw Error(
          "Transfer is not yet confirmed. Check the wallet before retrying.",
        );
      setNotice(
        "NFT transfer confirmed. Treasury control follows its new owner.",
      );
      await reload();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setPending(false);
    }
  }
  async function connect(id) {
    setConnecting(id);
    setWalletError("");
    try {
      const c = await connectWallet(selector, id);
      if (c) setConnection(c);
    } catch (e) {
      setWalletError(walletErrorMessage(e, id, "mainnet"));
    } finally {
      setConnecting(null);
    }
  }
  async function fund(e) {
    e.preventDefault();
    setPending(true);
    setNotice("");
    try {
      if (!connection.account) {
        setWalletOpen(true);
        return;
      }
      const r = await fetch(
        "/api/native/capital?" +
          new URLSearchParams({ agent: agent.id, amount }),
      );
      const tx = await r.json();
      if (!r.ok) throw Error(tx.error);
      const wallet = await selector.wallet();
      const result = await wallet.signAndSendTransaction({
        ...tx,
        signerId: connection.account,
      });
      if (!result || !Object.hasOwn(result.status ?? {}, "SuccessValue"))
        throw Error(
          "Payment is not yet confirmed; check the wallet transaction before retrying",
        );
      setNotice(
        "Capital transaction confirmed. Balances update after finalization.",
      );
      await reload();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setPending(false);
    }
  }
  async function pauseAgent() {
    setPending(true);
    try {
      const wallet = await selector.wallet();
      const result = await wallet.signAndSendTransaction({
        signerId: connection.account,
        ...nativeTransaction({
          network: "mainnet",
          contract: world.contract,
          method: "set_agent_paused",
          args: { agent_id: agent.id, paused: !agent.paused },
          deposit: "0.000000000000000000000001",
        }),
      });
      if (!result || !Object.hasOwn(result.status ?? {}, "SuccessValue"))
        throw Error("Change is not confirmed. Check your wallet.");
      setNotice("Owner preference confirmed; awaiting finalization.");
      await reload();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setPending(false);
    }
  }
  if (!world)
    return (
      <main className="native-loading">
        <h1>Econia</h1>
        <p>{error || "Verifying the mainnet world…"}</p>
      </main>
    );
  const entries = world.agents.filter(
    (a) =>
      (role === "All" || a.role === role) &&
      `${a.name} ${a.id} ${a.goal}`.toLowerCase().includes(query.toLowerCase()),
  );
  const minted = world.agents.filter((a) => a.token).length;
  return (
    <main className="native-app">
      <header className="native-header">
        <a href="/" className="native-brand">
          ◈ ECONIA <small>AN AGENT ECONOMY</small>
        </a>
        <span className="native-network">NEAR MAINNET</span>
        <button onClick={() => setWalletOpen(true)}>
          {connection.account ? short(connection.account) : "Connect wallet"}
        </button>
      </header>
      {(error || world.stale) && (
        <p role="alert" className="native-alert">
          {error || world.issue} · Last verified {world.verifiedAt}.
          Transactions unavailable until verified.
        </p>
      )}
      <section className="native-intro">
        <div>
          <small>THE FOUNDING COHORT</small>
          <h1>A world of ownable agents.</h1>
          <p>
            64 ownable identities. Three real service workers. Native NEAR
            treasuries.
          </p>
        </div>
        <div className="native-stats">
          <span>
            <b>{minted}/64</b>NFTs created
          </span>
          <span>
            <b>
              {world.agents.filter((a) => a.serviceProfile?.active).length}/64
            </b>
            Service workers activated
          </span>
          <span>
            <b>{formatNear(world.custody.treasuries)}</b>NEAR operating capital
          </span>
        </div>
      </section>
      <section className="native-world">
        <Suspense fallback={<p>Opening the world…</p>}>
          <World3D
            w={scene}
            selected={selected}
            fresh={false}
            active={true}
            layer="People"
            camera={camera}
            onSelect={choose}
            onDistrict={(id) => {
              setCamera({ zoom: 1.5, focusDistrict: id });
            }}
            Avatar={Avatar}
          />
        </Suspense>
        <div className="native-world-note">
          {world.custody.paused
            ? "Economic settlement paused"
            : "Economic settlement open"}{" "}
          · Service workers run on request
          <br />
          <small>
            City scenery is visual only. Virtual work roles are retired.
          </small>
        </div>
        <button
          className="native-reset"
          onClick={() => setCamera({ zoom: 1, reset: Date.now() })}
        >
          View whole city
        </button>
      </section>
      <ServiceWorkspace
        world={world}
        selector={selector}
        connection={connection}
        selected={selected}
        onConnect={() => setWalletOpen(true)}
        onNotify={setNotice}
        onReload={reload}
      />
      <section className="native-workspace">
        <div className="native-roster">
          <div className="native-list-title">
            <h2>Meet all 64 agents</h2>
            <a href="#how-it-works">How it works ↗</a>
          </div>
          <div className="native-filters">
            <input
              aria-label="Search agents"
              placeholder="Find a name, identity, or goal"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Filter by role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {[
                "All",
                "Unassigned",
                ...(world.services?.catalog || []).map((s) => s.label),
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="native-agent-list">
            {entries.map((a) => (
              <button
                className={
                  "native-agent " + (selected === a.id ? "selected" : "")
                }
                key={a.id}
                onClick={() => choose(a.id)}
              >
                <Avatar entity={a} size={38} />
                <span>
                  <strong>{a.name}</strong>
                  <small>
                    {a.role} · {a.token ? "NFT created" : "Awaiting NFT"}
                  </small>
                </span>
                <span className="native-agent-balance">
                  {a.treasuryNear} NEAR
                  <small>
                    {world.plans.agents[a.id]?.plan
                      ? "AI plan ready"
                      : a.serviceProfile?.active
                        ? "Ready for tasks"
                        : "Idle · no service assigned"}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </div>
        <aside className="native-detail" aria-live="polite">
          {agent ? (
            <>
              <small>
                {agent.role.toUpperCase()} · {agent.id}
              </small>
              <h2>{agent.name}</h2>
              <p>{agent.goal}</p>
              <dl>
                <dt>Operating treasury</dt>
                <dd>{agent.treasuryNear} NEAR</dd>
                <dt>NFT owner</dt>
                <dd title={agent.token?.owner_id}>
                  {short(agent.token?.owner_id) || "Uncommissioned"}
                </dd>
                <dt>Economic status</dt>
                <dd>{agent.status}</dd>
                <dt>Service status</dt>
                <dd>
                  {world.plans.agents[agent.id]?.status ||
                    (agent.serviceProfile?.active
                      ? "Available on request"
                      : "Idle; awaiting service activation")}
                </dd>
              </dl>
              <h3>Service capability</h3>
              <p>
                {world.plans.agents[agent.id]?.plan ||
                  agent.service?.description ||
                  "No verified real-service workflow is assigned yet. This identity is idle and does not make automatic AI calls."}
              </p>
              {world.plans.agents[agent.id]?.message && (
                <div className="native-proposal">
                  <small>
                    PROPOSAL TO{" "}
                    {
                      world.agents.find(
                        (a) =>
                          a.id === world.plans.agents[agent.id].counterpartyId,
                      )?.name
                    }
                  </small>
                  <p>{world.plans.agents[agent.id].message}</p>
                  <small>
                    Offchain proposal · no agreement or payment executed
                  </small>
                </div>
              )}
              <h3>Provide operating capital</h3>
              <p>
                The NEAR stays with this agent when its NFT transfers. Funding
                gives no ownership or promised return.
              </p>
              <form onSubmit={fund}>
                <input
                  aria-label="Operating capital in NEAR"
                  placeholder="Amount in NEAR"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                />
                <button
                  disabled={
                    pending ||
                    world.custody.paused ||
                    world.stale ||
                    Boolean(error) ||
                    agent.paused ||
                    !agent.token
                  }
                >
                  Review in wallet
                </button>
              </form>
              {world.custody.paused && (
                <small>
                  Capital deposits are closed while settlement is paused.
                </small>
              )}
              {connection.account === agent.token?.owner_id && (
                <button
                  disabled={pending || world.stale || Boolean(error)}
                  onClick={pauseAgent}
                >
                  {agent.paused ? "Resume agent" : "Pause agent"}
                </button>
              )}
              <p role="status">{notice}</p>
              {connection.account === agent.token?.owner_id && (
                <details>
                  <summary>Transfer agent NFT</summary>
                  <p>
                    The recipient receives this identity and control of its
                    treasury. Review the recipient in your wallet.
                  </p>
                  <form onSubmit={transfer}>
                    <input
                      aria-label="Recipient mainnet account"
                      value={receiver}
                      onChange={(e) => setReceiver(e.target.value)}
                      placeholder="recipient.near"
                    />
                    <button disabled={pending || world.stale || Boolean(error)}>
                      Review transfer
                    </button>
                  </form>
                </details>
              )}
              <details>
                <summary>Earlier testnet history</summary>
                <p>
                  Cycle {agent.lastRecordedCycle}: {agent.lastRecordedAction}.{" "}
                  {agent.lastRecordedReason}
                </p>
                <p>
                  Earlier employer:{" "}
                  {agent.employer || "Public infrastructure work"}. Earlier
                  business stakes: {agent.businesses.join(", ") || "None"}.
                  These jobs, stakes, and test ECO balances did not migrate to
                  mainnet.
                </p>
              </details>
            </>
          ) : (
            <>
              <small>CHOOSE AN AGENT</small>
              <h2>Each identity has a story.</h2>
              <p>
                Select a character in the city or the roster to see its owner,
                treasury, AI plan, and earlier testnet role.
              </p>
            </>
          )}
        </aside>
      </section>
      <section id="how-it-works" className="native-explainer">
        <h2>What is live today?</h2>
        <div>
          <article>
            <h3>Ownership & treasury</h3>
            <p>
              The founding agents are NEAR NFTs. Ownership and native NEAR
              balances are read from the contract. An NFT transfer carries
              control of its agent treasury. All founding agents start with zero
              capital.
            </p>
          </article>
          <article>
            <h3>AI & collaboration</h3>
            <p>
              Evidence analysis, CSV analysis and copy editing run on submitted
              tasks. Tool checks run before output release. Unassigned
              identities stay idle. Project-funded trials do not charge NEAR.
            </p>
          </article>
          <article>
            <h3>The next economic step</h3>
            <p>
              Real services are available as bounded project-funded trials. Paid
              task settlement and owner earnings withdrawals remain closed. NFT
              marketplace discovery and listings have not been verified.
            </p>
          </article>
        </div>
        {world.plans.issue && (
          <p role="alert">Planning worker: {world.plans.issue}</p>
        )}
        <p>
          Verified at block {world.blockHeight} ·{" "}
          <a
            href={"https://nearblocks.io/address/" + world.contract}
            target="_blank"
            rel="noreferrer"
          >
            View mainnet contract ↗
          </a>
        </p>
      </section>
      {walletOpen && (
        <div className="native-modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Connect mainnet wallet"
            className="native-wallet"
          >
            <button
              className="native-close"
              onClick={() => setWalletOpen(false)}
            >
              Close ×
            </button>
            <h2>Your connection to Econia</h2>
            <WalletChoices
              network="mainnet"
              selector={selector}
              loading={!selector}
              connecting={connecting}
              connection={connection}
              onConnect={connect}
              onDisconnect={async () => {
                try {
                  await (await selector.wallet()).signOut();
                  setConnection(connectionFromState(selector.store.getState()));
                } catch (e) {
                  setWalletError(e.message);
                }
              }}
              onAccount={(id) => selector.setActiveAccount(id)}
              error={walletError}
            />
          </section>
        </div>
      )}
    </main>
  );
}
