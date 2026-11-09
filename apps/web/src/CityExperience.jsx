import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  districts,
  money,
  unit,
  mergeRecords,
  cityStories,
  cityMoments,
  businessOf,
  placement,
  routineSummary,
  importantActions,
  storyContext,
} from "./city-model.mjs";
import "./city.css";
const World3D = React.lazy(() => import("./World3D.jsx"));
function readLocal(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function Glyph({ name, size = 20 }) {
  const paths = {
    world: (
      <>
        <path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    discover: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m16 8-2 6-6 2 2-6z" />
      </>
    ),
    exchange: (
      <>
        <path d="M3 7h17l-4-4M21 17H4l4 4M20 7l-4 4M4 17l4-4" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    paper: (
      <>
        <path d="M4 4h13v16H4zM17 7h4v11a2 2 0 0 1-2 2M7 8h7M7 12h3M7 16h7M13 12h1" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    locate: (
      <>
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 1v5M12 18v5M1 12h5M18 12h5" />
      </>
    ),
    follow: <path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    wallet: (
      <>
        <path d="M3 6h17v14H3zM3 6V4h14v2M15 11h6v5h-6z" />
        <path d="M17 13h1" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    back: <path d="M20 12H5m6-6-6 6 6 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.world}
    </svg>
  );
}
function useRecords(id, w) {
  const [records, setRecords] = useState({ decisions: [], events: [] });
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    Promise.all(
      ["decisions", "decisions?important=1", "history"].map((path) =>
        fetch(`/api/entities/${id}/${path}`, {
          signal: controller.signal,
        }).then((r) => (r.ok ? r.json() : [])),
      ),
    )
      .then(([recent, important, events]) =>
        setRecords({ decisions: mergeRecords(recent, important), events }),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [id]);
  return {
    decisions: mergeRecords(
      records.decisions.filter((d) => d.entityId === id),
      w.decisions.filter((d) => d.entityId === id),
    ),
    events: mergeRecords(
      records.events.filter((d) => d.entityId === id),
      w.events.filter((d) => d.entityId === id),
    ),
  };
}
function relativeTime(stamp, now) {
  if (!stamp) return "Waiting for the next observed cycle";
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(stamp).getTime()) / 1000),
  );
  return seconds < 60
    ? `${seconds}s ago`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : `${Math.floor(seconds / 3600)}h ago`;
}

function Block({
  x = 0,
  y = 0,
  width = 84,
  depth = 44,
  height = 60,
  front = "#E9D1AA",
  side = "#CBA77B",
  roof = "#C4674C",
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d={`M0 0 ${width / 2} -${depth / 2} ${width} 0 ${width / 2} ${depth / 2}z`}
        fill="#284e3c"
        opacity=".12"
        transform="translate(3 7)"
      />
      <path
        d={`M0 -${height} ${width / 2} -${height - depth / 2} ${width / 2} ${depth / 2} 0 0z`}
        fill={front}
      />
      <path
        d={`M${width / 2} -${height - depth / 2} ${width} -${height} ${width} 0 ${width / 2} ${depth / 2}z`}
        fill={side}
      />
      <path
        d={`M0 -${height} ${width / 2} -${height + depth / 2} ${width} -${height} ${width / 2} -${height - depth / 2}z`}
        fill={roof}
      />
    </g>
  );
}
function PlaceArt({
  entity: e,
  selected = false,
  active = false,
  mini = false,
}) {
  const kind = e.industry;
  return (
    <g className={`place-art ${selected ? "chosen" : ""}`}>
      {selected && (
        <ellipse
          cx="0"
          cy="18"
          rx="78"
          ry="38"
          fill="#F4B544"
          opacity=".35"
          className="selection-halo"
        />
      )}
      {kind === "FARMING" ? (
        <>
          <path d="m-93 20 53-27 88 43-54 28z" fill="#9AAC65" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`m${-83 + i * 13} ${20 + i * 6} 42-21`}
              stroke={i % 2 ? "#527B44" : "#C5C477"}
              strokeWidth="7"
            />
          ))}
          <Block
            x={-39}
            y={-12}
            width={77}
            depth={44}
            height={58}
            front="#CF7558"
            side="#AB553D"
            roof="#425D54"
          />
          <path d="m-43-70 38-38 47 37-38 20z" fill="#52675B" />
          <path d="M-22-38v27l19 9v-27z" fill="#713D32" />
          <path
            d="m-22-38 19 36M-3-29-22-11"
            stroke="#F5DEB9"
            strokeWidth="2"
          />
          <ellipse cx="49" cy="-6" rx="16" ry="8" fill="#AFB8A3" />
          <path d="M33-6v-57h32v57" fill="#D9DECA" />
          <ellipse cx="49" cy="-63" rx="16" ry="8" fill="#F6E8CC" />
          <path d="m33-63 16-20 16 20" fill="#617965" />
          <path d="M49-60v49" stroke="#B2BAA5" strokeWidth="2" />
        </>
      ) : kind === "FOOD" ? (
        <>
          <Block
            x={-49}
            y={0}
            width={108}
            depth={57}
            height={66}
            front="#F1D1A4"
            side="#D6B486"
            roof="#BD6547"
          />
          <path d="m-55-68 54-45 66 42-54 31z" fill="#C86748" />
          <path d="m-1-113 66 42-54 31-12-14z" fill="#A84F3C" />
          <path d="M-28-37v37l18 9v-37z" fill="#745C4C" />
          <path
            d="m5-20 30-15v23L5 3z"
            fill="#577A7C"
            stroke="#FFF1D1"
            strokeWidth="3"
          />
          <path d="m1-34 37-18 13 10-42 20z" fill="#F6BD5F" />
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`m${3 + i * 9} ${-35 - i * 4.4} 8 10`}
              stroke="#F5EBD4"
              strokeWidth="6"
            />
          ))}
          <path d="M29-85v-29l12-6v29z" fill="#C8A489" />
          {active && (
            <g className="oven-smoke">
              <ellipse
                cx="35"
                cy="-131"
                rx="10"
                ry="7"
                fill="#fff"
                opacity=".7"
              />
              <ellipse
                cx="30"
                cy="-148"
                rx="13"
                ry="9"
                fill="#fff"
                opacity=".4"
              />
            </g>
          )}
          <g transform="translate(60 0)">
            <path d="m0-20 12-6 11 5v23l-12 6L0 2z" fill="#8A6549" />
            <path d="m3-16 8-4 8 3v13l-8 4-8-3z" fill="#E5B86D" />
            <path d="m6-11 10-5" stroke="#FFF0BE" strokeWidth="3" />
          </g>
        </>
      ) : kind === "MILLING" ? (
        <>
          <Block
            x={-44}
            y={0}
            width={92}
            depth={54}
            height={65}
            front="#EEE0BC"
            side="#C6B18B"
            roof="#608582"
          />
          <path d="m-13-43 2-70 20-11 22 15 2 70-23 15z" fill="#F4E5C4" />
          <path d="m-16-112 27-34 27 33-24 14z" fill="#647B78" />
          <g
            transform="translate(7 -100)"
            className={active ? "mill-turn" : ""}
          >
            <path
              d="M0 0-36-15l4-11L0-5 31-39l10 8L5 0l35 16-5 11L0 6-31 39l-10-9z"
              fill="#D2BB8A"
              stroke="#A78E64"
              strokeWidth="2"
            />
            <circle r="5" fill="#846B4C" />
          </g>
          <path d="m33-20 33-17 10 10-35 17z" fill="#D0A347" />
          {[0, 1, 2].map((i) => (
            <ellipse
              key={i}
              cx={47 + i * 10}
              cy={-5 - i * 4}
              rx="7"
              ry="10"
              fill="#E8D3A9"
            />
          ))}
        </>
      ) : (
        <>
          <Block
            x={-58}
            y={0}
            width={123}
            depth={66}
            height={58}
            front="#AFCBD2"
            side="#7299AB"
            roof="#466D7A"
          />
          <path d="m-62-60 62-29 69 29-62 33z" fill="#598392" />
          <path d="m-35-32 27 14V8l-27-14z" fill="#43667A" />
          <path d="m20-18 24-12v31L20 13z" fill="#456A7D" />
          <g transform="translate(58 17)">
            <Block
              width={35}
              depth={23}
              height={22}
              front="#C58F57"
              side="#9C7048"
              roof="#E2BA79"
            />
            <path d="m0-11 18 9M18-13v22" stroke="#8B6543" strokeWidth="2" />
          </g>
          <path d="m-56 9 35 17 25-12-35-18z" fill="#E1A846" />
          <path d="m-52 7 14 7 12-6-14-6z" fill="#476D78" />
          <ellipse cx="-42" cy="21" rx="6" ry="5" fill="#3D5055" />
          <ellipse cx="-13" cy="24" rx="6" ry="5" fill="#3D5055" />
        </>
      )}
      {!mini && (
        <>
          <path
            d="M-58 32h116"
            stroke="#314E3A"
            opacity=".12"
            strokeWidth="2"
          />
          <g transform="translate(-57 5)">
            <path d="M0 0v-28" stroke="#7D6753" strokeWidth="3" />
            <path
              d="m-10-30 21-10v17l-21 10z"
              fill={
                kind === "FOOD"
                  ? "#C86748"
                  : kind === "FARMING"
                    ? "#5C8954"
                    : kind === "MILLING"
                      ? "#B19446"
                      : "#438FC4"
              }
            />
            <path d="m-5-26 10-5" stroke="#FFF0C9" strokeWidth="3" />
          </g>
        </>
      )}
    </g>
  );
}
function PersonCard({ e, w, Avatar, onOpen, followed, onFollow }) {
  const latest = w.decisions.filter((d) => d.entityId === e.id).at(-1),
    holdings = businessOf(w, e.id);
  return (
    <article className="resident-card">
      <button className="resident-card-main" onClick={() => onOpen(e.id)}>
        <Avatar entity={e} size={68} />
        <span>
          <small>
            {e.role} · {e.district}
          </small>
          <h3>{e.name}</h3>
        </span>
        <Glyph name="arrow" />
      </button>
      <p className="resident-ambition">{e.goal}</p>
      <div className="resident-now">
        <i />
        {holdings.length
          ? `Has a stake in ${holdings[0].name}`
          : latest?.reason || "A new economic life is beginning."}
      </div>
      <div className="resident-card-foot">
        <button
          onClick={() => onFollow(e.id)}
          className={followed ? "is-followed" : ""}
        >
          <Glyph name="follow" size={15} />
          {followed ? "Following" : "Follow their story"}
        </button>
        <button onClick={() => onOpen(e.id)}>
          Meet {e.name.split(" ")[0]} <Glyph name="arrow" size={15} />
        </button>
      </div>
    </article>
  );
}

function DecisionEvidence({ decision: d, w, onClose }) {
  return (
    <section className="decision-evidence">
      <div className="sheet-section-title">
        <span>Why this choice?</span>
        <button onClick={onClose} aria-label="Close decision evidence">
          <Glyph name="close" size={16} />
        </button>
      </div>
      <h3>
        {d.action.type === "CREATE_BUSINESS"
          ? "A business, on their own terms."
          : d.action.type === "HIRE"
            ? "Someone to build with."
            : d.action.type.replaceAll("_", " ").toLowerCase()}
      </h3>
      <p>{d.reason}</p>
      <div className="record-label">
        RECORDED BEFORE THE ACTION · CYCLE {d.cycle}
      </div>
      {Object.entries(d.facts || {})
        .filter(([k]) =>
          [
            "cash",
            "reserve",
            "expectedBatchMargin",
            "startupCapital",
            "risk",
            "industry",
          ].includes(k),
        )
        .map(([key, value]) => (
          <div className="evidence-row" key={key}>
            <span>{key.replace(/([A-Z])/g, " $1")}</span>
            <strong>
              {[
                "cash",
                "reserve",
                "expectedBatchMargin",
                "startupCapital",
              ].includes(key)
                ? `${money(value)} ${unit(w)}`
                : String(value)}
            </strong>
          </div>
        ))}
      {d.facts?.prices && (
        <details className="quiet-details">
          <summary>Quoted prices & source</summary>
          {Object.entries(d.facts.prices).map(([good, price]) => (
            <div className="evidence-row" key={good}>
              <span>{good.toLowerCase()}</span>
              <strong>
                {money(price)} {unit(w)}
              </strong>
            </div>
          ))}
          <code>{d.id}</code>
          <p>
            {d.status.toLowerCase()} · {d.result}
          </p>
        </details>
      )}
    </section>
  );
}

function ContextPanel({
  e,
  w,
  Avatar,
  owner,
  followed,
  onFollow,
  onOpen,
  onClose,
  onLocate,
  onAction,
  onExchange,
  onConnect,
}) {
  const [tab, setTab] = useState("Life"),
    [why, setWhy] = useState(null);
  const records = useRecords(e.id, w),
    significant = records.decisions.filter((d) =>
      importantActions.has(d.action?.type),
    ),
    latest = records.decisions[0],
    businesses = businessOf(w, e.id),
    job = w.jobs.find((j) => j.person === e.id),
    workers = w.jobs.filter((j) => j.business === e.id),
    shareholders = w.holdings.filter((h) => h.entity === e.id),
    isBusiness = e.type === "BUSINESS",
    listing = w.listings.find(
      (l) => l.entity === e.id && l.status === "ACTIVE",
    );
  const suppliers = w.relationships
      .filter((r) => r.from === e.id)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 3),
    customers = w.relationships
      .filter((r) => r.to === e.id)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 3);
  useEffect(() => {
    setTab("Life");
    setWhy(null);
  }, [e.id]);
  const linkEntity = (id, label) => {
    const other = w.entities.find((x) => x.id === id);
    return (
      other && (
        <button className="connection-row" key={id} onClick={() => onOpen(id)}>
          <Avatar entity={other} size={38} />
          <span>
            <strong>{other.name}</strong>
            <small>{label || other.role || other.industry}</small>
          </span>
          <Glyph name="arrow" size={16} />
        </button>
      )
    );
  };
  return (
    <aside
      className="world-sheet"
      role="region"
      aria-label={`${e.name} in the city`}
    >
      <div className="sheet-grip" />
      <div className="sheet-topline">
        <button onClick={() => onLocate(e.id)}>
          <Glyph name="locate" size={14} />
          {e.district}
        </button>
        <button onClick={onClose} aria-label="Close place panel">
          <Glyph name="close" />
        </button>
      </div>
      {isBusiness ? (
        <div className={`premises-art premises-${e.industry.toLowerCase()}`}>
          <svg
            viewBox="-130 -180 260 240"
            role="img"
            aria-label={`${e.industry.toLowerCase()} premises`}
          >
            <ellipse cy="15" rx="110" ry="45" fill="#172333" opacity=".1" />
            <PlaceArt entity={e} mini />
          </svg>
          <span>
            {e.industry === "FOOD"
              ? "THE BAKERY"
              : e.industry === "FARMING"
                ? "THE FARM"
                : e.industry === "MILLING"
                  ? "THE MILL & MARKET"
                  : "THE LOGISTICS YARD"}
          </span>
        </div>
      ) : (
        <div className="person-intro">
          <Avatar entity={e} size={90} />
          <div>
            <span className="small-kicker">A LIFE IN ECONIA</span>
            <span className="person-role">{e.role}</span>
            <span className="status-note">
              <i />
              {job ? "At work in the city" : "Finding their next opportunity"}
            </span>
          </div>
        </div>
      )}
      <div className="sheet-identity">
        <h2>{e.name}</h2>
        <p>
          {isBusiness
            ? `${workers.length} ${workers.length === 1 ? "person" : "people"} building a livelihood here`
            : "Every choice becomes part of their story."}
        </p>
      </div>
      <div className="context-actions">
        <button
          className={followed ? "follow-control followed" : "follow-control"}
          onClick={() => onFollow(e.id)}
        >
          <Glyph name="follow" size={16} />
          {followed ? "Following" : "Follow"}
        </button>
        <button onClick={() => onLocate(e.id)}>
          <Glyph name="locate" size={16} />
          Locate
        </button>
        {e.type === "PERSON" && (
          <button
            className="sponsor-control"
            onClick={() => onAction("SPONSOR", e)}
          >
            Sponsor <span>↗</span>
          </button>
        )}
      </div>
      <div
        className="sheet-tabs"
        role="tablist"
        aria-label="Entity information"
      >
        {["Life", "Choices", "Economy"].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => {
              setTab(t);
              setWhy(null);
            }}
          >
            {t === "Life" && isBusiness ? "Inside" : t}
          </button>
        ))}
      </div>
      <div className="sheet-body">
        {why ? (
          <DecisionEvidence decision={why} w={w} onClose={() => setWhy(null)} />
        ) : tab === "Life" ? (
          <>
            {!isBusiness && (
              <section className="ambition-block">
                <span className="small-kicker">
                  WHAT THEY’RE WORKING TOWARD
                </span>
                <p>“{e.goal}”</p>
                <div className="skill-tags">
                  {Object.entries(e.skills)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([skill, value]) => (
                      <span key={skill}>
                        {skill} <b>{Math.floor(value)}</b>
                      </span>
                    ))}
                </div>
              </section>
            )}
            <section className="current-choice">
              <div className="sheet-section-title">
                <span>
                  {isBusiness ? "On the workshop floor" : "Their latest move"}
                </span>
                <small>
                  {latest ? `Cycle ${latest.cycle}` : "Awaiting a decision"}
                </small>
              </div>
              {latest ? (
                <>
                  <h3>
                    {latest.action.type === "PRODUCE"
                      ? "Another batch, ready for the city."
                      : latest.action.type === "BUY"
                        ? `Sourcing ${latest.action.good?.toLowerCase() || "what they need"}.`
                        : latest.action.type === "WORK"
                          ? "Putting their skills to work."
                          : latest.action.type === "CONSUME"
                            ? "Taking care of everyday needs."
                            : latest.action.type === "CREATE_BUSINESS"
                              ? "Taking the leap into business."
                              : latest.action.type === "HIRE"
                                ? "Making room for a new colleague."
                                : "Considering the next move."}
                  </h3>
                  <p>{latest.reason}</p>
                  <button className="world-link" onClick={() => setWhy(latest)}>
                    Understand this choice <Glyph name="arrow" size={16} />
                  </button>
                </>
              ) : (
                <p>
                  Their first recorded choice will appear as the city advances.
                </p>
              )}
            </section>
            {isBusiness ? (
              <>
                <section className="sheet-section">
                  <span className="small-kicker">PEOPLE BEHIND THE PLACE</span>
                  {shareholders.map((h) =>
                    linkEntity(h.owner, `${h.bps / 100}% economic stake`),
                  )}
                  {workers.map((j) => linkEntity(j.person, "Works here"))}
                  {!workers.length && (
                    <p>
                      No employees yet. Staffing is part of this business’s next
                      choices.
                    </p>
                  )}
                </section>
                <section className="sheet-section">
                  <span className="small-kicker">ON THE SHELVES</span>
                  <div className="stock-grid">
                    {Object.entries(e.inventory)
                      .filter(([, q]) => q > 0)
                      .map(([good, q]) => (
                        <div key={good}>
                          <span>{good.toLowerCase()}</span>
                          <strong>{q}</strong>
                          <small>items on hand</small>
                        </div>
                      ))}
                  </div>
                  {!Object.values(e.inventory).some((q) => q > 0) && (
                    <p>Stock is waiting to be replenished.</p>
                  )}
                </section>
                {(suppliers.length > 0 || customers.length > 0) && (
                  <section className="sheet-section">
                    <span className="small-kicker">
                      CONNECTED THROUGH TRADE
                    </span>
                    {suppliers.map((r) =>
                      linkEntity(
                        r.to,
                        `${r.interactions} recorded supplier interactions`,
                      ),
                    )}
                    {customers
                      .filter((r) => !suppliers.some((s) => s.to === r.from))
                      .slice(0, 2)
                      .map((r) => linkEntity(r.from, "Customer"))}
                  </section>
                )}
              </>
            ) : (
              <>
                <section className="sheet-section">
                  <span className="small-kicker">
                    THEIR CORNER OF THE ECONOMY
                  </span>
                  {businesses.map((b) =>
                    linkEntity(b.id, `${b.stake}% economic stake`),
                  )}
                  {job && linkEntity(job.business, "Works here")}
                  {!businesses.length && !job && (
                    <p>
                      No private job or business yet. Their story is still
                      taking shape.
                    </p>
                  )}
                </section>
                {significant[0] && (
                  <section className="turning-point">
                    <span className="small-kicker">A TURNING POINT</span>
                    <h3>
                      {significant[0].action.type === "CREATE_BUSINESS"
                        ? "The decision to build something."
                        : significant[0].action.type
                            .replaceAll("_", " ")
                            .toLowerCase()}
                    </h3>
                    <p>{significant[0].reason}</p>
                    <button
                      className="world-link"
                      onClick={() => setWhy(significant[0])}
                    >
                      Revisit the decision · cycle {significant[0].cycle}{" "}
                      <Glyph name="arrow" size={16} />
                    </button>
                  </section>
                )}
              </>
            )}
            <section className="sheet-section">
              <span className="small-kicker">RECENT CHAPTERS</span>
              {records.events
                .filter((ev) =>
                  [
                    "BUSINESS_CREATED",
                    "ENTITY_FUNDED",
                    "ENTITY_HIRED",
                    "NFT_SOLD",
                    "ENTITY_FIRED",
                  ].includes(ev.type),
                )
                .slice(0, 4)
                .map((ev) => (
                  <div className="life-event" key={ev.id}>
                    <span>◦</span>
                    <div>
                      <strong>{ev.title}</strong>
                      <small>Cycle {ev.cycle}</small>
                    </div>
                  </div>
                ))}
              {!records.events.some((ev) =>
                [
                  "BUSINESS_CREATED",
                  "ENTITY_FUNDED",
                  "ENTITY_HIRED",
                  "NFT_SOLD",
                ].includes(ev.type),
              ) && <p>Follow this story to keep track of the next chapter.</p>}
            </section>
          </>
        ) : tab === "Choices" ? (
          <>
            <section className="sheet-section">
              <span className="small-kicker">IMPORTANT CHOICES</span>
              {significant.map((d) => (
                <button
                  className="choice-card"
                  key={d.id}
                  onClick={() => setWhy(d)}
                >
                  <span>{d.action.type.replaceAll("_", " ")}</span>
                  <strong>{d.reason}</strong>
                  <small>
                    Cycle {d.cycle} · {d.status.toLowerCase()} <span>↗</span>
                  </small>
                </button>
              ))}
              {!significant.length && (
                <p>
                  No major decision is recorded yet. The routines below are
                  keeping this economic life moving.
                </p>
              )}
            </section>
            <section className="sheet-section">
              <span className="small-kicker">THE RHYTHM OF EVERYDAY LIFE</span>
              {routineSummary(records.decisions).map((g) => (
                <details className="routine-group" key={g.kind}>
                  <summary>
                    <span>
                      {{
                        WORK: "Work shifts",
                        BUY: "Supplies & everyday purchases",
                        CONSUME: "Everyday needs",
                        PRODUCE: "Production batches",
                        WAIT: "Waiting for opportunity",
                      }[g.kind] || g.kind}
                    </span>
                    <b>{g.count}</b>
                  </summary>
                  <p>
                    Recorded during cycles {g.first}–{g.last}. Latest:{" "}
                    {g.latest.result}.
                  </p>
                  <button
                    className="world-link"
                    onClick={() => setWhy(g.latest)}
                  >
                    Inspect the latest choice ↗
                  </button>
                </details>
              ))}
            </section>
          </>
        ) : (
          <>
            <section className="sheet-section">
              <span className="small-kicker">ECONOMIC CONDITION</span>
              {[
                ["Treasury", e.cash, "Spendable capital held by the entity."],
                [
                  "Estimated economic value",
                  e.netWorth,
                  "Cash, quoted inventory and proportional business holdings; this is not a sale price.",
                ],
                [
                  "Sponsor capital received",
                  e.sponsorship,
                  "Funding provided by sponsors.",
                ],
                [
                  "Internally created wealth",
                  e.generatedWealth,
                  "Estimated value less initial and sponsored capital.",
                ],
              ].map(([label, value, help]) => (
                <div className="economy-fact" key={label}>
                  <span>{label}</span>
                  <strong>
                    {money(value)} <small>{unit(w)}</small>
                  </strong>
                  <p>{help}</p>
                </div>
              ))}
              {listing && (
                <div className="economy-fact">
                  <span>Current asking price</span>
                  <strong>
                    {money(listing.ask)} <small>{unit(w)}</small>
                  </strong>
                  <p>
                    The seller’s price for ownership, separate from the entity’s
                    treasury and estimated value.
                  </p>
                </div>
              )}
            </section>
            <section className="sheet-section">
              <button
                className="city-button full"
                onClick={() => onExchange(e.id)}
              >
                {listing
                  ? "See the Living Asset listing"
                  : "Open the Living Asset exchange"}{" "}
                <Glyph name="arrow" size={16} />
              </button>
              {e.owner === owner && (
                <button
                  className="world-link"
                  onClick={() => onAction("POLICY", e)}
                >
                  Review strategy boundaries ↗
                </button>
              )}
            </section>
            <details className="quiet-details">
              <summary>Ownership & evidence</summary>
              <div className="evidence-row">
                <span>Current NFT owner</span>
                <code>{e.owner}</code>
              </div>
              <div className="evidence-row">
                <span>Persistent ID</span>
                <code>{e.id}</code>
              </div>
              {w.chain && (
                <a
                  href={`https://testnet.nearblocks.io/address/${w.chain.world}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Inspect world contract ↗
                </a>
              )}
              {w.sponsorships
                .filter((s) => s.entity === e.id && s.hash)
                .map((s) => (
                  <a
                    key={s.id}
                    href={`https://testnet.nearblocks.io/txns/${s.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {money(s.amount)} ECO sponsorship receipt ↗
                  </a>
                ))}
            </details>
          </>
        )}
      </div>
      <div className="sheet-bottom-note">
        {followed
          ? "★ You’re following this story."
          : "Every entity keeps its identity and history."}
      </div>
    </aside>
  );
}

function StorySheet({ story, w, onClose, onOpen, onDistrict, onMarkets }) {
  const { entity, business, constraint, affected, location } = storyContext(
    story,
    w,
  );
  const priceGood =
      constraint?.type === "DROUGHT" || constraint?.type === "BUMPER_HARVEST"
        ? "GRAIN"
        : constraint?.type === "DEMAND_SURGE"
          ? "BREAD"
          : "ENERGY",
    prices = constraint
      ? w.priceHistory.filter(
          (h) =>
            h.cycle >= constraint.start &&
            h.cycle <= Math.min(w.cycle, constraint.end),
        )
      : [],
    first = prices[0],
    last = prices.at(-1);
  return (
    <aside
      className="world-sheet story-sheet"
      role="region"
      aria-label="Chronicle story"
    >
      <div className="sheet-topline">
        <span>
          <Glyph name="paper" size={16} /> THE ECONIA CHRONICLE
        </span>
        <button aria-label="Close story" onClick={onClose}>
          <Glyph name="close" />
        </button>
      </div>
      <div className="story-illustration">
        <Glyph
          name={constraint ? "world" : business ? "home" : "discover"}
          size={72}
        />
        <span>CHAPTER {String(story.cycle).padStart(3, "0")}</span>
      </div>
      <div className="sheet-body">
        <span className="small-kicker">
          RECORDED AT CYCLE {story.cycle} ·{" "}
          {story.cycle === w.cycle
            ? "CURRENT CYCLE"
            : "FROM THE CITY’S HISTORY"}
        </span>
        <h2>{story.title}</h2>
        <p className="story-lede">{story.detail}</p>
        {constraint && (
          <>
            <h3>Who was affected</h3>
            <p>
              {affected.length}{" "}
              {affected.length === 1 ? "business was" : "businesses were"}{" "}
              subject to this world constraint. The event changed the conditions
              they faced; their choices determined what followed.
            </p>
            <div className="story-people">
              {affected.slice(0, 4).map((e) => (
                <button key={e.id} onClick={() => onOpen(e.id)}>
                  {e.name}
                  <Glyph name="arrow" size={14} />
                </button>
              ))}
            </div>
            {prices.length > 1 && (
              <section className="story-evidence-preview">
                <span>
                  {priceGood.toLowerCase()} quote in the available event window
                </span>
                <strong>
                  {money(first[priceGood])} → {money(last[priceGood])} {unit(w)}
                </strong>
                <small>
                  Cycles {first.cycle}–{last.cycle}. This comparison does not by
                  itself establish causation.
                </small>
              </section>
            )}
            <h3>What happened next</h3>
            <p>
              {w.cycle >= constraint.end
                ? `The configured constraint period ended at cycle ${constraint.end}. Current business profiles show how those businesses are doing now.`
                : `This constraint remains scheduled until cycle ${constraint.end}. Follow the affected places to observe their next choices.`}
            </p>
          </>
        )}
        {business && (
          <>
            <h3>A place in the city</h3>
            <p>
              {business.name} is now part of {business.district}. Its current
              records show{" "}
              {w.jobs.filter((j) => j.business === business.id).length} employed{" "}
              {w.jobs.filter((j) => j.business === business.id).length === 1
                ? "person"
                : "people"}
              .
            </p>
            <button
              className="city-button full"
              onClick={() => onOpen(business.id)}
            >
              Step inside {business.name} <Glyph name="arrow" size={16} />
            </button>
          </>
        )}
        {entity && (
          <button
            className="story-entity-link"
            onClick={() => onOpen(entity.id)}
          >
            Meet {entity.name} in the city <Glyph name="arrow" size={16} />
          </button>
        )}
        {location && (
          <button className="world-link" onClick={() => onDistrict(location)}>
            Explore {location} <Glyph name="locate" size={15} />
          </button>
        )}
        {constraint && (
          <button className="world-link" onClick={onMarkets}>
            Inspect the goods-market evidence ↗
          </button>
        )}
        <details className="quiet-details">
          <summary>Read the underlying evidence</summary>
          <p>
            Source: {story.type.replaceAll("_", " ").toLowerCase()} · cycle{" "}
            {story.cycle}
          </p>
          <code>{story.id}</code>
          <pre>{JSON.stringify(story.data, null, 2)}</pre>
          {story.data?.hash && (
            <a
              href={`https://testnet.nearblocks.io/txns/${story.data.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              Verify NEAR transaction ↗
            </a>
          )}
        </details>
      </div>
    </aside>
  );
}

function WorldChronicle({ stories, w, onStory }) {
  return (
    <div className="city-chronicle">
      <div className="city-page-heading">
        <span className="small-kicker">FROM THE STREETS OF ECONIA</span>
        <h1>The Econia Chronicle</h1>
        <p>Choices, connections, and the chapters they leave behind.</p>
      </div>
      <div className="chronicle-stories">
        {stories.map((s, i) => (
          <button
            className={
              i === 0 ? "chronicle-story featured-story" : "chronicle-story"
            }
            key={s.id}
            onClick={() => onStory(s)}
          >
            <span className="small-kicker">
              CYCLE {s.cycle} · {s.type.replaceAll("_", " ")}
            </span>
            <h2>{s.title}</h2>
            <p>{s.detail}</p>
            <span className="world-link">
              Follow the story <Glyph name="arrow" size={17} />
            </span>
          </button>
        ))}
      </div>
      {!stories.length && (
        <p>
          The first chapter is still being written. Return as the city advances.
        </p>
      )}
    </div>
  );
}

export function CityExperience({
  w,
  owner,
  wallet,
  connection,
  page,
  onNavigate,
  onConnect,
  onAction,
  onNotify,
  Avatar,
  Markets,
  Marketplace,
  Leaderboards,
  Development,
}) {
  const [selected, setSelected] = useState(null),
    [story, setStory] = useState(null),
    [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 }),
    [district, setDistrict] = useState(null),
    [layer, setLayer] = useState("People"),
    [listView, setListView] = useState(false),
    [query, setQuery] = useState(""),
    [discoverKind, setDiscoverKind] = useState("People"),
    [exchangeTab, setExchangeTab] = useState("Living Assets"),
    [discoveryQuery, setDiscoveryQuery] = useState(""),
    [myTab, setMyTab] = useState("Following"),
    [archive, setArchive] = useState([]),
    [economyOpen, setEconomyOpen] = useState(false),
    [now, setNow] = useState(Date.now()),
    [followed, setFollowed] = useState(() => {
      try {
        const x = JSON.parse(readLocal("econia-followed") || "[]");
        return Array.isArray(x) ? x : [];
      } catch {
        return [];
      }
    }),
    [returnCycle, setReturnCycle] = useState(() =>
      Number(readLocal("econia-last-seen") || 0),
    );
  useEffect(() => {
    const update = (ev) =>
      setFollowed((old) =>
        old.includes(ev.detail) ? old : [...old, ev.detail],
      );
    window.addEventListener("econia-sponsored", update);
    return () => window.removeEventListener("econia-sponsored", update);
  }, []);
  useEffect(() => {
    const dismiss = (ev) => {
      if (ev.key === "Escape" && !document.querySelector('[role="dialog"]')) {
        setSelected(null);
        setStory(null);
        setQuery("");
      }
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, []);
  const cycleRef = useRef(w?.cycle),
    seenAdvance = useRef(null);
  useEffect(() => {
    if (w && cycleRef.current !== w.cycle) {
      if (cycleRef.current !== undefined) seenAdvance.current = Date.now();
      cycleRef.current = w.cycle;
    }
  }, [w?.cycle]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/chronicle", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((x) => setArchive(Array.isArray(x) ? x : []))
      .catch(() => {});
    return () => controller.abort();
  }, [Math.floor((w?.cycle || 0) / 12)]);
  useEffect(() => {
    saveLocal("econia-followed", JSON.stringify(followed));
  }, [followed]);
  useEffect(() => {
    if (!w) return;
    if (document.visibilityState === "visible")
      saveLocal("econia-last-seen", String(w.cycle));
    const visibility = () => {
      if (document.visibilityState === "visible") {
        setReturnCycle(Number(readLocal("econia-last-seen") || 0));
        saveLocal("econia-last-seen", String(w.cycle));
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [w?.cycle]);
  const positions = useMemo(
      () => (w ? placement(w) : new Map()),
      [w?.entities, w?.jobs],
    ),
    stories = w ? cityStories(w, archive) : [],
    moments = w ? cityMoments(w, archive) : [],
    entity = w?.entities.find((e) => e.id === selected),
    mira = w?.entities.find((e) => e.id === "person_199"),
    fresh = Boolean(
      w &&
      !w.paused &&
      !w.settlementDelayed &&
      connection === "live" &&
      (w.lastAdvancedAt || seenAdvance.current) &&
      now - new Date(w.lastAdvancedAt || seenAdvance.current).getTime() < 60000,
    );
  function follow(id) {
    setFollowed((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
    );
  }
  function open(id) {
    setSelected(id);
    setStory(null);
    setQuery("");
    onNavigate("World");
  }
  function locate(id) {
    const p = positions.get(id);
    if (p) {
      const mobile = window.matchMedia("(max-width:640px)").matches;
      setCamera({
        zoom: 1.65,
        focus: id,
        x: (mobile ? 700 : 500) - p.x * 1.65,
        y: (mobile ? 90 : 385) - p.y * 1.65,
      });
      setDistrict(p.district);
    }
    setQuery("");
  }
  function exploreDistrict(id) {
    const d = districts.find((d) => d.id === id);
    if (d) {
      setDistrict(id);
      setCamera({
        zoom: 1.45,
        focusDistrict: id,
        x: 620 - d.x * 1.45,
        y: 340 - d.y * 1.45,
      });
    }
    setStory(null);
    onNavigate("World");
    setQuery("");
  }
  function openStory(s) {
    setStory(s);
    setSelected(null);
    setQuery("");
  }
  function go(destination) {
    onNavigate(destination);
    setQuery("");
    if (destination !== "World") {
      setSelected(null);
      setStory(null);
    }
  }
  const owned =
      w?.entities.filter((e) => e.type === "PERSON" && e.owner === owner) || [],
    sponsored =
      w?.entities.filter((e) =>
        w.sponsorships.some((s) => s.entity === e.id && s.sender === owner),
      ) || [],
    tracked = [
      ...new Set([
        ...followed,
        ...owned.map((e) => e.id),
        ...sponsored.map((e) => e.id),
      ]),
    ],
    watchedPlaces = w
      ? tracked.flatMap((id) => businessOf(w, id).map((b) => b.id))
      : [],
    away = stories.filter(
      (s) =>
        s.cycle > returnCycle &&
        [...tracked, ...watchedPlaces].includes(s.entityId),
    );
  const results =
    query && w
      ? [
          ...w.entities
            .filter(
              (e) =>
                ["PERSON", "BUSINESS"].includes(e.type) &&
                `${e.name} ${e.role || ""} ${e.industry || ""} ${e.district}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            )
            .slice(0, 5)
            .map((e) => ({
              kind: "entity",
              e,
              label: e.name,
              sub: e.role || e.industry,
            })),
          ...districts
            .filter((d) => d.label.toLowerCase().includes(query.toLowerCase()))
            .map((d) => ({
              kind: "district",
              d,
              label: d.label,
              sub: "District",
            })),
          ...stories
            .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 2)
            .map((s) => ({
              kind: "story",
              s,
              label: s.title,
              sub: "Chronicle story",
            })),
        ]
      : [];
  const discovery =
    w?.entities.filter(
      (e) =>
        e.type === (discoverKind === "Businesses" ? "BUSINESS" : "PERSON") &&
        `${e.name} ${e.role || ""} ${e.district}`
          .toLowerCase()
          .includes(discoveryQuery.toLowerCase()),
    ) || [];
  const sheet = entity ? (
    <ContextPanel
      key={entity.id}
      e={entity}
      w={w}
      Avatar={Avatar}
      owner={owner}
      followed={followed.includes(entity.id)}
      onFollow={follow}
      onOpen={open}
      onClose={() => setSelected(null)}
      onLocate={locate}
      onAction={onAction}
      onConnect={onConnect}
      onExchange={() => {
        setExchangeTab("Living Assets");
        go("Exchange");
      }}
    />
  ) : story ? (
    <StorySheet
      story={story}
      w={w}
      onClose={() => setStory(null)}
      onOpen={open}
      onDistrict={exploreDistrict}
      onMarkets={() => {
        setExchangeTab("Goods & prices");
        go("Exchange");
        setStory(null);
      }}
    />
  ) : null;
  return (
    <div className="city-app">
      <header className="city-header">
        <a
          className="city-brand"
          href="#"
          onClick={(ev) => {
            ev.preventDefault();
            go("World");
          }}
        >
          <span className="city-brand-mark">
            <i />
            <i />
            <i />
          </span>
          econia<span>.</span>
        </a>
        <nav className="city-main-nav" aria-label="Main navigation">
          {[
            ["World", "world"],
            ["Discover", "discover"],
            ["Exchange", "exchange"],
            ["My Econia", "home"],
          ].map(([label, icon]) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              onClick={() => go(label)}
            >
              <Glyph name={icon} size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="city-search">
          <Glyph name="search" size={17} />
          <input
            aria-label="Search people, places and stories"
            placeholder="People, places, stories…"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
          />
          <kbd>/</kbd>
          {query && (
            <div className="city-search-results">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() =>
                    r.kind === "entity"
                      ? open(r.e.id)
                      : r.kind === "district"
                        ? exploreDistrict(r.d.id)
                        : openStory(r.s)
                  }
                >
                  {r.kind === "entity" ? (
                    <Avatar entity={r.e} size={35} />
                  ) : (
                    <Glyph name={r.kind === "story" ? "paper" : "world"} />
                  )}
                  <span>
                    <strong>{r.label}</strong>
                    <small>{r.sub}</small>
                  </span>
                  <Glyph name="arrow" size={15} />
                </button>
              ))}
              {!results.length && (
                <p>No match yet. Try “Mira”, “bakery” or “Harbor”.</p>
              )}
            </div>
          )}
        </div>
        <button
          className={
            "newspaper-control " + (page === "Chronicle" ? "active" : "")
          }
          onClick={() => go("Chronicle")}
          aria-label="Open the Chronicle"
        >
          <Glyph name="paper" />
          <span>Chronicle</span>
        </button>
        <button
          className="city-wallet"
          aria-label={wallet ? "Open connected wallet" : "Connect wallet"}
          onClick={onConnect}
        >
          <Glyph name="wallet" size={18} />
          <span>
            {wallet
              ? wallet.length > 19
                ? wallet.slice(0, 14) + "…"
                : wallet
              : "Connect wallet"}
          </span>
        </button>
      </header>
      {!w ? (
        <div className="city-loading">
          <span className="loading-orbit">◈</span>
          <h1>A city is waking up.</h1>
          <p>
            {connection === "reconnecting"
              ? "Waiting for the Econia world service."
              : "Opening a window into Econia…"}
          </p>
        </div>
      ) : (
        <>
          <div
            className={
              "city-world " +
              (page !== "World" ? "world-behind-destination" : "")
            }
            aria-hidden={page !== "World"}
            inert={page !== "World" ? true : undefined}
          >
            <React.Suspense
              fallback={
                <div className="world-3d-loading">Opening the 3D city…</div>
              }
            >
              <World3D
                w={w}
                selected={selected}
                onSelect={open}
                camera={camera}
                setCamera={setCamera}
                onDistrict={exploreDistrict}
                positions={positions}
                Avatar={Avatar}
                fresh={fresh}
                layer={layer}
                active={page === "World"}
              />
            </React.Suspense>
            <div className="world-camera-hint">
              <b>EXPLORE IN 3D</b> Drag to orbit · scroll to zoom · right-drag
              to pan
            </div>
            <div className="world-location">
              <div className="small-kicker">
                <span className="daylight-icon">☀</span> A PERSISTENT ECONOMIC
                WORLD
              </div>
              <h1>
                {district
                  ? districts.find((d) => d.id === district)?.label
                  : "Econia City"}
                <span>↗</span>
              </h1>
              <div className="world-time">
                Day {Math.floor(w.cycle / 24) + 1}
                <i />
                Cycle {w.cycle}
                <i />
                <span
                  className={connection === "live" ? "stream-connected" : ""}
                >
                  {connection === "live" ? "Connected" : "Reconnecting"}
                </span>
              </div>
              <div className="last-advanced">
                <Glyph name="clock" size={12} />
                {w.settlementDelayed
                  ? "Settlement delayed · last confirmed cycle"
                  : w.paused
                    ? "Clock paused"
                    : `Last advanced ${relativeTime(w.lastAdvancedAt || seenAdvance.current, now)}`}
              </div>
              {district && (
                <button
                  className="back-to-city"
                  onClick={() => {
                    setDistrict(null);
                    setCamera({ x: 0, y: 0, zoom: 1 });
                  }}
                >
                  ← Back to the whole city
                </button>
              )}
            </div>
            <div className="world-top-right">
              <details className="testnet-control">
                <summary>
                  <i />
                  {w.mode === "testnet" ? "NEAR TESTNET" : "LOCAL SANDBOX"}
                  <span>⌄</span>
                </summary>
                <div>
                  <strong>
                    {w.mode === "testnet"
                      ? "Actual test ECO settlement"
                      : "Simulation units only"}
                  </strong>
                  <p>
                    {w.mode === "testnet"
                      ? "Entity treasuries settle on NEAR. These are test assets, without real-money value."
                      : "This local world uses simulation units. No onchain funds move."}
                  </p>
                  {w.chain && (
                    <a
                      href={`https://testnet.nearblocks.io/address/${w.chain.world}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Verify the world contract ↗
                    </a>
                  )}
                </div>
              </details>
              <button
                className={
                  listView ? "world-view-button selected" : "world-view-button"
                }
                onClick={() => setListView(!listView)}
              >
                <Glyph name={listView ? "world" : "list"} size={17} />
                {listView ? "Map view" : "Accessible list"}
              </button>
            </div>
            {!entity && !story && (
              <>
                <div className="explore-prompt">
                  <span>YOUR WINDOW INTO A LIVING CITY</span>
                  <p>Who will you discover today?</p>
                  <small>
                    Select a place or a person to step into their story.
                  </small>
                </div>
                {mira && (
                  <button
                    className="mira-invitation"
                    onClick={() => {
                      open(mira.id);
                      locate(mira.id);
                    }}
                  >
                    <Avatar entity={mira} size={56} />
                    <span>
                      <small>A STORY WORTH FOLLOWING</small>
                      <strong>Meet Mira.</strong>
                      <span>
                        {businessOf(w, mira.id).length
                          ? "A food artisan. A business of her own."
                          : "A food artisan with an ambition to build."}
                      </span>
                    </span>
                    <span className="invitation-arrow">
                      <Glyph name="arrow" />
                    </span>
                  </button>
                )}
              </>
            )}
            {listView && (
              <div className="world-list-alternative">
                <div className="sheet-section-title">
                  <strong>People & places in {district || "the city"}</strong>
                  <button
                    onClick={() => setListView(false)}
                    aria-label="Close city list"
                  >
                    <Glyph name="close" size={18} />
                  </button>
                </div>
                {w.entities
                  .filter(
                    (e) =>
                      ["PERSON", "BUSINESS"].includes(e.type) &&
                      (!district || e.district === district),
                  )
                  .map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        open(e.id);
                        setListView(false);
                      }}
                    >
                      <Avatar entity={e} size={35} />
                      <span>
                        <strong>{e.name}</strong>
                        <small>
                          {e.role || e.industry} · {e.district}
                        </small>
                      </span>
                      <Glyph name="arrow" size={16} />
                    </button>
                  ))}
              </div>
            )}
            <div className="map-controls">
              <div>
                <button
                  aria-label="Zoom in"
                  onClick={() =>
                    setCamera((c) => ({
                      ...c,
                      zoom: Math.min(2.5, c.zoom + 0.2),
                    }))
                  }
                >
                  ＋
                </button>
                <button
                  aria-label="Zoom out"
                  onClick={() =>
                    setCamera((c) => ({
                      ...c,
                      zoom: Math.max(0.65, c.zoom - 0.2),
                    }))
                  }
                >
                  −
                </button>
                <button
                  aria-label="Reset city view"
                  onClick={() => {
                    setCamera({ x: 0, y: 0, zoom: 1 });
                    setDistrict(null);
                  }}
                >
                  <Glyph name="locate" size={17} />
                </button>
              </div>
              <select
                aria-label="Map layer"
                value={layer}
                onChange={(ev) => setLayer(ev.target.value)}
              >
                <option>People</option>
                <option>Places</option>
                <option>Names</option>
              </select>
              <details className="world-controls-help">
                <summary>3D controls</summary>
                <div>
                  <strong>Explore the city</strong>
                  <p>Drag to orbit. Scroll to zoom. Right-drag to pan.</p>
                  <p>
                    On a touch screen, drag with one finger to orbit; pinch or
                    move two fingers to zoom and pan.
                  </p>
                  <p>
                    Keyboard: focus the world and use the arrow keys to pan. The
                    city list offers every person and place.
                  </p>
                </div>
              </details>
              <button
                className="economy-toggle"
                onClick={() => setEconomyOpen(!economyOpen)}
              >
                Economy ↗
              </button>
            </div>
            <div className="map-legend">
              <i className="recorded-trail" />
              {fresh
                ? "Trails mark recorded goods purchases in this cycle."
                : "Showing the latest recorded world state."}
              <span>Orbit · Zoom · Pan</span>
            </div>
            {!sheet && (
              <div className="world-story-rail">
                <div className="story-rail-label">
                  <Glyph name="paper" size={18} />
                  <span>
                    FROM THE
                    <br />
                    CITY STREETS
                  </span>
                </div>
                {moments.map((s, i) => (
                  <button
                    key={s.id}
                    className="city-moment"
                    onClick={() => openStory(s)}
                  >
                    <span className={"moment-number moment-" + i}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <small>
                        {s.cycle === w.cycle
                          ? "THIS CYCLE"
                          : `RECORDED · CYCLE ${s.cycle}`}
                      </small>
                      <strong>{s.title}</strong>
                    </span>
                    <Glyph name="arrow" size={16} />
                  </button>
                ))}
              </div>
            )}
            {economyOpen && (
              <div className="world-economy-popover">
                <div className="sheet-section-title">
                  <strong>The economy at a glance</strong>
                  <button
                    aria-label="Close economy overview"
                    onClick={() => setEconomyOpen(false)}
                  >
                    <Glyph name="close" size={16} />
                  </button>
                </div>
                {[
                  ["People", w.metrics.population],
                  ["Independent businesses", w.metrics.businesses],
                  ["Employment", `${Math.round(w.metrics.employment * 100)}%`],
                  [
                    "Economic circulation",
                    `${money(w.metrics.circulating)} ${unit(w)}`,
                  ],
                  [
                    "Recent goods volume",
                    `${money(w.metrics.volume)} ${unit(w)}`,
                  ],
                ].map(([k, v]) => (
                  <div className="evidence-row" key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
                <button
                  className="world-link"
                  onClick={() => {
                    setExchangeTab("Goods & prices");
                    go("Exchange");
                    setEconomyOpen(false);
                  }}
                >
                  Explore prices and supply ↗
                </button>
              </div>
            )}
          </div>
          {page !== "World" && (
            <main className="city-destination">
              {page === "Discover" ? (
                <>
                  <div className="city-page-heading">
                    <span className="small-kicker">FOLLOW YOUR CURIOSITY</span>
                    <h1>Every life leads somewhere.</h1>
                    <p>
                      Find the people, places and choices shaping this city.
                    </p>
                  </div>
                  <div className="destination-tabs">
                    {["People", "Businesses", "Districts", "Achievements"].map(
                      (t) => (
                        <button
                          className={discoverKind === t ? "active" : ""}
                          key={t}
                          onClick={() => setDiscoverKind(t)}
                        >
                          {t}
                        </button>
                      ),
                    )}
                    {["People", "Businesses"].includes(discoverKind) && (
                      <input
                        aria-label="Search discovery"
                        placeholder="Find someone or somewhere…"
                        value={discoveryQuery}
                        onChange={(ev) => setDiscoveryQuery(ev.target.value)}
                      />
                    )}
                  </div>
                  {discoverKind === "Districts" ? (
                    <div className="district-grid">
                      {districts.map((d, i) => (
                        <button
                          key={d.id}
                          onClick={() => exploreDistrict(d.id)}
                        >
                          <div
                            className={`district-poster district-poster-${i}`}
                          >
                            <Glyph name="world" size={70} />
                            <span>{String(i + 1).padStart(2, "0")}</span>
                          </div>
                          <h2>{d.label}</h2>
                          <p>{d.subtitle}</p>
                          <span className="world-link">
                            Explore the district ↗
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : discoverKind === "Achievements" ? (
                    <Leaderboards w={w} onEntity={open} />
                  ) : (
                    <div className="inhabitants-grid">
                      {discovery.map((e) =>
                        discoverKind === "People" ? (
                          <PersonCard
                            key={e.id}
                            e={e}
                            w={w}
                            Avatar={Avatar}
                            onOpen={(id) => {
                              open(id);
                              locate(id);
                            }}
                            followed={followed.includes(e.id)}
                            onFollow={follow}
                          />
                        ) : (
                          <article className="place-card" key={e.id}>
                            <button
                              className={`place-card-art premises-${e.industry.toLowerCase()}`}
                              onClick={() => {
                                open(e.id);
                                locate(e.id);
                              }}
                            >
                              <svg
                                viewBox="-150 -180 300 250"
                                role="img"
                                aria-label={e.name}
                              >
                                <PlaceArt entity={e} mini />
                              </svg>
                            </button>
                            <span className="small-kicker">
                              {e.industry} · {e.district}
                            </span>
                            <h2>{e.name}</h2>
                            <p>
                              {w.jobs.filter((j) => j.business === e.id).length}{" "}
                              employed here ·{" "}
                              {Object.values(e.inventory).reduce(
                                (n, q) => n + q,
                                0,
                              )}{" "}
                              items on hand
                            </p>
                            <button
                              className="world-link"
                              onClick={() => {
                                open(e.id);
                                locate(e.id);
                              }}
                            >
                              Step inside <Glyph name="arrow" size={16} />
                            </button>
                          </article>
                        ),
                      )}
                    </div>
                  )}
                </>
              ) : page === "Exchange" ? (
                <>
                  <div className="destination-tabs exchange-tabs">
                    {["Living Assets", "Goods & prices"].map((t) => (
                      <button
                        className={exchangeTab === t ? "active" : ""}
                        key={t}
                        onClick={() => setExchangeTab(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {exchangeTab === "Living Assets" ? (
                    <Marketplace
                      w={w}
                      onEntity={open}
                      onTrade={(action) =>
                        onAction(action.type, action.e, action)
                      }
                    />
                  ) : (
                    <Markets w={w} />
                  )}
                </>
              ) : page === "Chronicle" ? (
                <WorldChronicle stories={stories} w={w} onStory={openStory} />
              ) : page === "My Econia" ? (
                <>
                  <div className="city-page-heading">
                    <span className="small-kicker">
                      YOUR PLACE IN THIS WORLD
                    </span>
                    <h1>
                      {tracked.length
                        ? "Some stories become part of yours."
                        : "It starts with someone."}
                    </h1>
                    <p>
                      {wallet
                        ? "Your owned entities and the lives you’re following."
                        : "You can follow a life before connecting a wallet. Ownership and sponsorship begin when you choose to participate."}
                    </p>
                  </div>
                  {returnCycle > 0 && away.length > 0 && (
                    <section className="away-card">
                      <span className="small-kicker">WHILE YOU WERE AWAY</span>
                      <h2>
                        {away.length}{" "}
                        {away.length === 1 ? "chapter" : "chapters"} you might
                        have missed.
                      </h2>
                      {away.slice(0, 3).map((s) => (
                        <button key={s.id} onClick={() => openStory(s)}>
                          {s.title}
                          <span>Cycle {s.cycle} ↗</span>
                        </button>
                      ))}
                    </section>
                  )}
                  <div className="destination-tabs">
                    {["Following", "Owned", "Sponsored"].map((t) => (
                      <button
                        key={t}
                        className={myTab === t ? "active" : ""}
                        onClick={() => setMyTab(t)}
                      >
                        {t}{" "}
                        <small>
                          {
                            (t === "Following"
                              ? followed
                              : t === "Owned"
                                ? owned
                                : sponsored
                            ).length
                          }
                        </small>
                      </button>
                    ))}
                  </div>
                  {(myTab === "Following"
                    ? followed
                        .map((id) => w.entities.find((e) => e.id === id))
                        .filter(Boolean)
                    : myTab === "Owned"
                      ? owned
                      : sponsored
                  ).length ? (
                    <div className="inhabitants-grid">
                      {(myTab === "Following"
                        ? followed
                            .map((id) => w.entities.find((e) => e.id === id))
                            .filter(Boolean)
                        : myTab === "Owned"
                          ? owned
                          : sponsored
                      ).map((e) => (
                        <PersonCard
                          key={e.id}
                          e={e}
                          w={w}
                          Avatar={Avatar}
                          onOpen={(id) => {
                            open(id);
                            locate(id);
                          }}
                          followed={followed.includes(e.id)}
                          onFollow={follow}
                        />
                      ))}
                    </div>
                  ) : (
                    <section className="welcome-econia">
                      <div className="welcome-portraits">
                        {w.entities
                          .filter((e) => e.type === "PERSON")
                          .slice(0, 3)
                          .map((e) => (
                            <Avatar key={e.id} entity={e} size={72} />
                          ))}
                      </div>
                      <h2>
                        {myTab === "Owned"
                          ? "Your first Living Asset is still out there."
                          : myTab === "Sponsored"
                            ? "Back a possibility when you’re ready."
                            : "A whole city of stories. Start with one."}
                      </h2>
                      <p>
                        {myTab === "Owned"
                          ? "Acquiring a Living Asset transfers an existing entity’s identity and history. Explore their life before making an offer."
                          : myTab === "Sponsored"
                            ? "Sponsorship provides capital and discretion, not ownership or a promised return."
                            : "Meet someone, understand what they’re working toward, and follow what happens next. No wallet needed."}
                      </p>
                      <div>
                        <button
                          className="city-button"
                          onClick={() => {
                            open(mira.id);
                            locate(mira.id);
                          }}
                        >
                          Meet Mira <Glyph name="arrow" size={16} />
                        </button>
                        <button
                          className="city-button secondary"
                          onClick={() =>
                            go(myTab === "Owned" ? "Exchange" : "Discover")
                          }
                        >
                          {myTab === "Owned"
                            ? "Explore Living Assets"
                            : "Discover the city"}
                        </button>
                      </div>
                    </section>
                  )}
                  <p className="device-note">
                    Following is saved on this device. Owned assets are
                    determined by your connected wallet.
                  </p>
                </>
              ) : page === "Development" &&
                location.search.includes("dev=1") ? (
                <Development w={w} notify={onNotify} />
              ) : null}
            </main>
          )}
          {sheet && <div className="context-overlay">{sheet}</div>}
        </>
      )}
    </div>
  );
}
