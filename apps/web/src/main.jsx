import React, { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
const WorldContext = React.createContext({
  owner: "demo.local",
  mode: "sandbox",
  wallet: null,
  selector: null,
});
function Unit() {
  return React.useContext(WorldContext).mode === "testnet" ? "ECO" : "u";
}

const format = (n, dec = 0) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: dec }).format(
    (n || 0) / 1000,
  );
const number = (n) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(n || 0);
const short = (n) =>
  n >= 1000000 ? (n / 1000000).toFixed(1) + "k" : format(n);
const icons = {
  World: "◈",
  Entities: "♧",
  Businesses: "▦",
  Markets: "⌁",
  Marketplace: "◇",
  Chronicle: "▤",
  Leaderboards: "↗",
  Portfolio: "◉",
  Development: "⚙",
};
const colors = [
  "#c6d7af",
  "#ead5b9",
  "#d3c6df",
  "#a9c8c7",
  "#d7bc9e",
  "#c7cba4",
];
function Avatar({ entity: e, size = 46 }) {
  const hash = [...(e?.id || "")].reduce((n, c) => n + c.charCodeAt(0), 0),
    skin = ["#be8663", "#e4b58d", "#93664f", "#d2a07a"][hash % 4];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="avatar"
      aria-label={e?.name}
    >
      <rect
        width="64"
        height="64"
        rx="18"
        fill={colors[hash % colors.length]}
      />
      {e?.type === "BUSINESS" ? (
        <>
          <path d="M13 29L32 16 51 29v23H13z" fill="#63735b" />
          <path d="M10 29h44l-7-9H17z" fill="#b9734b" />
          <path d="M21 36h9v16h-9zm15 0h9v8h-9z" fill="#f4e4bc" />
        </>
      ) : (
        <>
          <path
            d="M10 64c1-18 14-24 22-24s21 6 22 24"
            fill={["#576b54", "#7c6b67", "#4f6c7a"][hash % 3]}
          />
          <rect x="26" y="36" width="12" height="14" rx="5" fill={skin} />
          <ellipse cx="32" cy="28" rx="14" ry="17" fill={skin} />
          <path
            d={
              hash % 2
                ? "M17 28c-5-24 34-28 31 2l-7-14-13 5-8 8z"
                : "M17 24c-2-19 31-24 32 2l-9-9-12 2-11 11z"
            }
            fill={["#38342e", "#544235", "#2f2e2c"][hash % 3]}
          />
          <path
            d="M25 29h2m10 0h2"
            stroke="#43382f"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M29 37q3 2 6-1"
            fill="none"
            stroke="#805b48"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
function Icon({ name }) {
  return (
    <span className="nav-icon" aria-hidden="true">
      {icons[name] || "↗"}
    </span>
  );
}
function Tag({ children, tone = "" }) {
  return <span className={"tag " + tone}>{children}</span>;
}
function Spark({ values = [], color = "#627d3f", height = 44, fill = false }) {
  const clean = values.length ? values : [0, 0],
    min = Math.min(...clean) * 0.95,
    max = Math.max(...clean) * 1.05,
    points = clean
      .map(
        (v, i) =>
          `${(i * 300) / Math.max(1, clean.length - 1)},${height - 5 - ((v - min) / Math.max(1, max - min)) * (height - 10)}`,
      )
      .join(" ");
  return (
    <svg
      viewBox={`0 0 300 ${height}`}
      preserveAspectRatio="none"
      className="spark"
      style={{ height }}
      role="img"
      aria-label="Historical trend"
    >
      {fill && (
        <polygon
          points={`0,${height} ${points} 300,${height}`}
          fill={color}
          opacity=".08"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
function Metric({ label, value, unit, detail, values }) {
  return (
    <article className="metric">
      <span className="eyebrow">{label}</span>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <div className="metric-bottom">
        <span>{detail}</span>
        {values && <Spark values={values} />}
      </div>
    </article>
  );
}
function Building({
  x,
  y,
  w = 35,
  d = 25,
  h = 35,
  color = "#bec8b1",
  roof = "#e5d7b3",
  onClick,
  label,
}) {
  const points = `${x},${y - h} ${x + w},${y - h - w * 0.45} ${x + w + d},${y - h - w * 0.45 + d * 0.48} ${x + d},${y - h + d * 0.48}`;
  return (
    <g
      onClick={onClick}
      onKeyDown={(ev) => {
        if (ev.key === "Enter") onClick?.();
      }}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      aria-label={label}
      className={onClick ? "map-building" : ""}
    >
      <polygon
        points={`${x},${y - h} ${x + d},${y - h + d * 0.48} ${x + d},${y + d * 0.48} ${x},${y}`}
        fill={color}
      />
      <polygon
        points={`${x + d},${y - h + d * 0.48} ${x + w + d},${y - h - w * 0.45 + d * 0.48} ${x + w + d},${y - w * 0.45 + d * 0.48} ${x + d},${y + d * 0.48}`}
        fill={color}
        style={{ filter: "brightness(.82)" }}
      />
      <polygon points={points} fill={roof} />
      {Array.from({ length: Math.max(1, Math.floor(h / 14)) }, (_, i) => (
        <g key={i} opacity=".68">
          <path
            d={`M${x + d + 6} ${y - h + d * 0.48 + 8 + i * 13}l8 -3.6m6 -2.7l8 -3.6`}
            stroke="#f6edcc"
            strokeWidth="4"
          />
        </g>
      ))}
    </g>
  );
}
function CityMap({ world, onEntity, layer }) {
  const businesses = world.entities.filter((e) => e.type === "BUSINESS");
  return (
    <svg
      className="city-svg"
      viewBox="0 0 950 490"
      role="img"
      aria-label="Interactive city map: Greenfield, Commons, Market quarter and Harbor"
    >
      <defs>
        <pattern id="grid" width="38" height="19" patternUnits="userSpaceOnUse">
          <path
            d="M0 9.5 19 0 38 9.5 19 19z"
            fill="none"
            stroke="#9ba88b"
            strokeWidth=".4"
            opacity=".18"
          />
        </pattern>
        <linearGradient id="water" x2="1" y2="1">
          <stop stopColor="#b3ced0" />
          <stop offset="1" stopColor="#7eafb4" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow
            dx="0"
            dy="12"
            stdDeviation="15"
            floodColor="#3f5134"
            floodOpacity=".14"
          />
        </filter>
      </defs>
      <rect width="950" height="490" fill="#e6e9db" />
      <rect width="950" height="490" fill="url(#grid)" />
      <g filter="url(#shadow)">
        <path d="M45 250 460 40 908 265 490 474z" fill="#b4bea1" />
        <path d="M45 242 460 32 908 257 490 466z" fill="#cdd4b9" />
        <path d="M45 242v8l445 224v-8z" fill="#a5af92" />
        <path d="M490 466 908 257v8L490 474z" fill="#96a285" />
      </g>
      <path
        d="M560 83 631 118 433 220 851 286 783 320 356 255z"
        fill="url(#water)"
      />
      <path
        d="M45 242 460 32M490 466 908 257M148 294 565 83M270 355 688 145M391 416 811 207M150 190 595 413M270 130 718 352M389 70 840 292"
        fill="none"
        stroke="#f2f0dd"
        strokeWidth="15"
      />
      <path
        d="M148 294 565 83M270 355 688 145M150 190 595 413M270 130 718 352"
        fill="none"
        stroke="#a6ad96"
        strokeWidth=".7"
        strokeDasharray="5 8"
      />
      {Array.from({ length: 5 }, (_, i) => (
        <g key={"field" + i}>
          <path
            d={`M${190 + i * 24} ${180 - i * 12}l60 -30 17 8 -60 30z`}
            fill={i % 2 ? "#aabd83" : "#b7c988"}
          />
          <path
            d={`M${194 + i * 24} ${180 - i * 12}l53 -26`}
            stroke="#859d65"
            strokeWidth="2"
            strokeDasharray="3 2"
          />
        </g>
      ))}
      {Array.from({ length: 20 }, (_, i) => {
        const x = 105 + ((i * 79) % 660),
          y = 250 + ((i * 37) % 120);
        return (
          <g key={"tree" + i}>
            <path d={`M${x} ${y}v-13`} stroke="#7b805a" strokeWidth="3" />
            <ellipse
              cx={x}
              cy={y - 18}
              rx="8"
              ry="13"
              fill={i % 2 ? "#7b996c" : "#94a879"}
            />
          </g>
        );
      })}
      {Array.from({ length: 18 }, (_, i) => {
        const col = i % 6,
          row = Math.floor(i / 6);
        return (
          <Building
            key={i}
            x={340 + col * 55 - row * 70}
            y={195 + col * 27 + row * 52}
            w={25 + (i % 3) * 5}
            d={20}
            h={25 + ((i * 13) % 65)}
            color={["#b9c2ad", "#d0c3a5", "#b4c3ba", "#c4c0ae"][i % 4]}
            roof={["#c3b494", "#adbdad", "#d5cfb8"][i % 3]}
          />
        );
      })}
      {businesses.slice(0, 24).map((e, i) => {
        const positions = [
            [165, 226],
            [345, 286],
            [440, 310],
            [680, 265],
            [235, 191],
            [402, 255],
            [516, 338],
            [736, 293],
            [306, 159],
            [459, 224],
            [581, 369],
            [790, 322],
          ],
          p = positions[i] || [
            360 + ((i - 12) % 6) * 55,
            330 + Math.floor((i - 12) / 6) * 35,
          ];
        return (
          <g key={e.id}>
            <Building
              x={p[0]}
              y={p[1]}
              w={38}
              d={27}
              h={e.industry === "MILLING" ? 62 : 34}
              color={e.industry === "FOOD" ? "#d0ac87" : "#b1bea5"}
              roof={
                e.industry === "FOOD"
                  ? "#a56f50"
                  : e.industry === "FARMING"
                    ? "#9bac7e"
                    : "#c4c7b2"
              }
              onClick={() => onEntity(e.id)}
              label={`Inspect ${e.name}`}
            />
            {layer === "Activity" && (
              <circle
                cx={p[0] + 28}
                cy={p[1] - 30}
                r="4"
                fill="#f3fdc4"
                className="activity-pulse"
                style={{ animationDelay: `${i * 0.25}s` }}
              />
            )}
          </g>
        );
      })}
      <path
        d="M567 85 151 294"
        fill="none"
        stroke="#607c50"
        strokeWidth="3"
        strokeDasharray="6 175"
        className="transport"
      />
      <path
        d="M272 131 717 352"
        fill="none"
        stroke="#ad8258"
        strokeWidth="4"
        strokeDasharray="7 220"
        className="transport second"
      />
      {[
        ["GREENFIELD", 175, 134],
        ["THE COMMONS", 385, 390],
        ["MARKET QUARTER", 482, 145],
        ["HARBOR", 764, 385],
      ].map(([label, x, y]) => (
        <g key={label}>
          <rect
            x={x - 9}
            y={y - 16}
            width={label.length * 7 + 18}
            height="25"
            rx="4"
            fill="#f5f3e7"
            opacity=".9"
          />
          <text
            x={x}
            y={y}
            fontSize="10"
            fontWeight="650"
            letterSpacing="1.2"
            fill="#4f604c"
          >
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}
function EntityRow({ e, onClick, rank }) {
  return (
    <button className="entity-row" onClick={() => onClick(e.id)}>
      {rank && <span className="rank">{rank.toString().padStart(2, "0")}</span>}
      <Avatar entity={e} size={42} />
      <span className="entity-name">
        <strong>{e.name}</strong>
        <small>
          {e.role || e.industry || e.type} · {e.district}
        </small>
      </span>
      <span className="entity-money">
        <strong>
          {format(e.netWorth)} <small>u</small>
        </strong>
        <small>economic NAV</small>
      </span>
      <span className="arrow">↗</span>
    </button>
  );
}
function Activity({ events, onEntity, limit = 6 }) {
  return (
    <div className="activity-list">
      {events
        .slice(-limit)
        .reverse()
        .map((e) => (
          <button
            key={e.id}
            className="activity-item"
            onClick={() => e.entityId && onEntity(e.entityId)}
          >
            <span
              className={
                "event-symbol " + (e.type === "GOODS_PURCHASED" ? "ochre" : "")
              }
            >
              {e.type === "PRODUCTION_COMPLETED"
                ? "▦"
                : e.type === "GOODS_PURCHASED"
                  ? "⇄"
                  : e.type === "ENTITY_HIRED"
                    ? "♧"
                    : "↗"}
            </span>
            <span>
              <strong>{e.title}</strong>
              <small>
                Cycle {e.cycle} <span>·</span>{" "}
                {e.type.replaceAll("_", " ").toLowerCase()}
              </small>
            </span>
            <span className="activity-dot" />
          </button>
        ))}
    </div>
  );
}
function Overview({ w, onEntity, navigate }) {
  const [layer, setLayer] = useState("Activity");
  const leaders = [...w.entities]
    .filter((e) => e.type === "PERSON")
    .sort((a, b) => b.generatedWealth - a.generatedWealth)
    .slice(0, 3);
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">
            <span className="live-dot" /> ECONIA CITY · GENESIS WORLD
          </div>
          <h1>
            A world making
            <br className="mobile-break" /> its own living.
          </h1>
          <p>People build. Markets move. A new story unfolds every cycle.</p>
        </div>
        <div className="world-stamp">
          <span className="sun">☀</span>
          <span>
            Year 01 · Day {Math.floor(w.cycle / 24) + 1}
            <small>
              {w.worldEvents.some((e) => e.end > w.cycle)
                ? "Changing conditions"
                : "A new economy, in motion"}
            </small>
          </span>
        </div>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Living population"
          value={w.metrics.population}
          unit="entities"
          detail={`${w.metrics.businesses} independent businesses`}
          values={w.metricsHistory.map((m) => m.population)}
        />
        <Metric
          label="Economic circulation"
          value={short(w.metrics.circulating)}
          unit={w.mode === "testnet" ? "ECO" : "units"}
          detail="Finite genesis supply"
          values={w.metricsHistory.map((m) => m.circulating)}
        />
        <Metric
          label="Market volume"
          value={format(w.metrics.volume)}
          unit={w.mode === "testnet" ? "ECO" : "units"}
          detail="Settled in the last 12 cycles"
          values={w.metricsHistory.map((m) => m.volume)}
        />
        <Metric
          label="Employment"
          value={(w.metrics.employment * 100).toFixed(0) + "%"}
          detail={`${w.jobs.length} active work contracts`}
          values={w.metricsHistory.map((m) => m.employment)}
        />
      </div>
      <div className="world-columns">
        <section className="panel map-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">THE LIVING WORLD</span>
              <h2>One city. A thousand possibilities.</h2>
            </div>
            <div className="segmented">
              {["Activity", "Districts"].map((x) => (
                <button
                  key={x}
                  className={layer === x ? "active" : ""}
                  onClick={() => setLayer(x)}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
          <div className="map-wrap">
            <CityMap world={w} onEntity={onEntity} layer={layer} />
            <span className="map-note">◇ Select a business to step inside</span>
            <div className="map-compass">
              N <span>⌁</span>
            </div>
          </div>
          <div className="map-footer">
            <span>
              <i className="legend green" />
              Farming
            </span>
            <span>
              <i className="legend tan" />
              Commerce
            </span>
            <span>
              <i className="legend blue" />
              Transport
            </span>
            <span className="map-footer-right">
              <span className="live-dot" />{" "}
              {w.paused ? "Paused" : "Simulation running"}
            </span>
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">HAPPENING NOW</span>
              <h2>The city never stands still.</h2>
            </div>
            <Tag tone="green">LIVE</Tag>
          </div>
          <Activity events={w.events} onEntity={onEntity} limit={6} />
          <button
            className="text-button activity-link"
            onClick={() => navigate("Chronicle")}
          >
            Explore the Chronicle <span>↗</span>
          </button>
        </section>
      </div>
      <div className="bottom-columns">
        <section className="panel rising">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">PEOPLE TO WATCH</span>
              <h2>Potential lives here.</h2>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("Entities")}
            >
              All entities ↗
            </button>
          </div>
          {leaders.map((e, i) => (
            <EntityRow key={e.id} e={e} rank={i + 1} onClick={onEntity} />
          ))}
        </section>
        <section className="chronicle-feature">
          <div className="eyebrow">
            THE ECONIA CHRONICLE <span>VOL. 001</span>
          </div>
          <div className="newspaper-line" />
          <h2>
            {w.chronicle[0]?.title ||
              "The first chapter of an autonomous city."}
          </h2>
          <p>{w.chronicle[0]?.detail}</p>
          <button className="text-button" onClick={() => navigate("Chronicle")}>
            Read the city’s story <span>↗</span>
          </button>
          <div className="newspaper-mark">E.</div>
        </section>
      </div>
      <div className="philosophy">
        You create opportunity. <span>They create their own story.</span>
      </div>
    </>
  );
}
function Explorer({ w, onEntity, businesses = false, portfolio = false }) {
  const { owner } = React.useContext(WorldContext);
  const [query, setQuery] = useState(""),
    [role, setRole] = useState("All industries"),
    [sort, setSort] = useState("Net worth");
  let entities = w.entities.filter(
    (e) =>
      e.type === (businesses ? "BUSINESS" : "PERSON") &&
      (!portfolio || e.owner === owner) &&
      (!query ||
        `${e.name} ${e.role} ${e.district}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (role === "All industries" || e.industry === role || e.role === role),
  );
  entities.sort((a, b) =>
    sort === "Reputation"
      ? b.reputation - a.reputation
      : sort === "Self-made wealth"
        ? b.generatedWealth - a.generatedWealth
        : b.netWorth - a.netWorth,
  );
  return (
    <>
      <PageTitle
        eyebrow={
          portfolio ? "YOUR CORNER OF THE WORLD" : "LIVING DIGITAL ASSETS"
        }
        title={
          portfolio
            ? "Back potential. Follow progress."
            : businesses
              ? "Businesses with a life of their own."
              : "Meet the minds behind the economy."
        }
        description={
          portfolio
            ? w.mode === "testnet"
              ? "Your wallet-owned entities. Economic identity persists across ownership changes."
              : "The local demo account owns these persistent entities."
            : "Every balance, relationship and decision belongs to an ongoing economic life."
        }
      />
      <div className="toolbar">
        <div className="search-field">
          <span>⌕</span>
          <input
            aria-label="Search entities"
            placeholder="Search by name, role or district…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter industry"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option>All industries</option>
          {(businesses
            ? ["FARMING", "FOOD", "MILLING", "TRANSPORT"]
            : ["Food artisan", "Grower", "Merchant", "Courier"]
          ).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select
          aria-label="Sort entities"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {["Net worth", "Reputation", "Self-made wealth"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <span>{entities.length} entities</span>
      </div>
      <div className="entity-grid">
        {entities.map((e) => (
          <button
            className="entity-card"
            key={e.id}
            onClick={() => onEntity(e.id)}
          >
            <div className="entity-card-top">
              <Avatar entity={e} size={76} />
              <Tag tone={e.owner === owner ? "green" : ""}>
                {e.owner === owner
                  ? "YOURS"
                  : e.type === "BUSINESS"
                    ? e.industry
                    : "GENESIS · 0"}
              </Tag>
            </div>
            <h2>{e.name}</h2>
            <p>
              {e.role || e.industry} <span>·</span> {e.district}
            </p>
            <div className="card-goal">“{e.goal}”</div>
            <div className="card-stat-row">
              <span>
                Economic NAV
                <strong>
                  {format(e.netWorth)} <small>u</small>
                </strong>
              </span>
              <span>
                Reputation
                <strong>
                  {Math.floor(e.reputation)}
                  <small> / 100</small>
                </strong>
              </span>
            </div>
            <div className="card-bottom">
              <span>{format(e.generatedWealth)} u created wealth</span>
              <span>View life ↗</span>
            </div>
          </button>
        ))}
      </div>
      {!entities.length && (
        <div className="empty">
          No entities match. Adjust your search or discover a Living Asset in
          the marketplace.
        </div>
      )}
    </>
  );
}
function PageTitle({ eyebrow, title, description }) {
  return (
    <div className="page-title">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function Profile({ e, w, onBack, onEntity, onSponsor, onPolicy, onList }) {
  const { owner } = React.useContext(WorldContext);
  const [tab, setTab] = useState("Overview"),
    [why, setWhy] = useState(null),
    [archived, setArchived] = useState([]);
  useEffect(() => {
    fetch(`/api/entities/${e.id}/decisions`)
      .then((r) => r.json())
      .then((x) => setArchived(Array.isArray(x) ? x : []));
    setWhy(null);
  }, [e.id]);
  const decisions = w.decisions
      .filter((d) => d.entityId === e.id)
      .slice(-20)
      .reverse(),
    allDecisions = decisions.length ? decisions : archived;
  const holdings = w.holdings.filter((h) => h.owner === e.id),
    employment = w.jobs.find((j) => j.person === e.id),
    employees = w.jobs.filter((j) => j.business === e.id),
    history = w.events
      .filter((x) => x.entityId === e.id)
      .slice(-12)
      .reverse();
  return (
    <>
      <button className="back" onClick={onBack}>
        ← Back to the world
      </button>
      <div className="profile-hero">
        <Avatar entity={e} size={100} />
        <div className="profile-identity">
          <div className="eyebrow">
            {e.type === "PERSON" ? "LIVING ENTITY" : "ECONOMIC ENTITY"} ·
            GENERATION {e.generation}
          </div>
          <h1>{e.name}</h1>
          <p>
            {e.role || e.industry} · {e.district}{" "}
            <span className="middot">·</span> <span className="live-dot" />{" "}
            {e.status.toLowerCase()}
          </p>
        </div>
        <div className="profile-actions">
          {e.owner === owner && (
            <>
              <button className="button secondary" onClick={onPolicy}>
                Strategy ↗
              </button>
              <button className="button primary" onClick={onSponsor}>
                Sponsor entity <span>＋</span>
              </button>
            </>
          )}
          <small>
            Owner <strong>{e.owner}</strong> · ID {e.id}
          </small>
        </div>
      </div>
      <div className="profile-quote">
        <span>↳</span> “{e.goal}”
      </div>
      <div className="metrics-grid">
        <Metric
          label="Economic net worth"
          value={format(e.netWorth)}
          unit={w.mode === "testnet" ? "ECO" : "units"}
          detail="Treasury + inventory + ownership"
        />
        <Metric
          label="Available treasury"
          value={format(e.cash)}
          unit={w.mode === "testnet" ? "ECO" : "units"}
          detail={`${format(e.policy.reserve)} u minimum reserve`}
        />
        <Metric
          label="Created wealth"
          value={format(e.generatedWealth)}
          unit={w.mode === "testnet" ? "ECO" : "units"}
          detail="NAV less genesis & sponsorship"
        />
        <Metric
          label="Sponsor capital"
          value={format(e.sponsorship)}
          unit={w.mode === "testnet" ? "ECO" : "units"}
          detail={`${(e.sponsorDependence * 100).toFixed(1)}% sponsor dependence`}
        />
      </div>
      <div className="tabs">
        {["Overview", "Decisions", "Economic history", "Relationships"].map(
          (t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Decisions" && <small>{allDecisions.length}</small>}
            </button>
          ),
        )}
        <button onClick={onList} className="list-action">
          List Living Asset ↗
        </button>
      </div>
      {tab === "Overview" && (
        <div className="profile-grid">
          <div>
            <section className="panel padded">
              <div className="eyebrow">CAPABILITIES</div>
              <h2>What {e.name.split(" ")[0]} brings to the world.</h2>
              <div className="skills">
                {Object.entries(e.skills).map(([skill, value]) => (
                  <div key={skill}>
                    <span>{skill}</span>
                    <div className="skill-track">
                      <i style={{ width: `${value}%` }} />
                    </div>
                    <strong>{Math.floor(value)}</strong>
                  </div>
                ))}
              </div>
              <div className="trait-pills">
                {Object.entries(e.traits).map(([key, val]) => (
                  <Tag key={key}>
                    {key.replace(/([A-Z])/g, " $1")}: {val}
                  </Tag>
                ))}
              </div>
            </section>
            <section className="panel padded">
              <div className="eyebrow">OWNERSHIP & WORK</div>
              {e.type === "BUSINESS" && (
                <>
                  <div className="data-row">
                    <span>Operating receipts</span>
                    <strong>
                      {format(e.revenue, 2)} <Unit />
                    </strong>
                  </div>
                  <div className="data-row">
                    <span>Operating expenses</span>
                    <strong>
                      {format(e.expenses, 2)} <Unit />
                    </strong>
                  </div>
                  <div className="data-row">
                    <span>Operating surplus</span>
                    <strong>
                      {format(e.revenue - e.expenses, 2)} <Unit />
                    </strong>
                  </div>
                  {w.holdings
                    .filter((h) => h.entity === e.id)
                    .map((h) => (
                      <div className="holding" key={h.owner}>
                        <EntityRow
                          e={w.entities.find((x) => x.id === h.owner)}
                          onClick={onEntity}
                        />
                        <Tag>{h.bps / 100}% owner</Tag>
                      </div>
                    ))}
                </>
              )}
              <h2>Connected to a bigger economy.</h2>
              {holdings.map((h) => (
                <div key={h.entity} className="holding">
                  <EntityRow
                    e={w.entities.find((x) => x.id === h.entity)}
                    onClick={onEntity}
                  />
                  <Tag>{h.bps / 100}% ownership</Tag>
                </div>
              ))}
              {employment && (
                <p>
                  Employed by{" "}
                  <button
                    className="text-button"
                    onClick={() => onEntity(employment.business)}
                  >
                    {w.entities.find((e) => e.id === employment.business)?.name}{" "}
                    ↗
                  </button>{" "}
                  · {format(employment.wage, 2)} u / cycle
                </p>
              )}
              {employees.map((j) => (
                <EntityRow
                  key={j.id}
                  e={w.entities.find((e) => e.id === j.person)}
                  onClick={onEntity}
                />
              ))}
              {!holdings.length && !employment && !employees.length && (
                <p className="muted">
                  No business holdings or private employment yet. Opportunity
                  depends on market conditions and available capital.
                </p>
              )}
            </section>
          </div>
          <div>
            <section className="panel decision-feature">
              <div className="eyebrow">A MIND OF THEIR OWN</div>
              <h2>Why did you do that?</h2>
              {allDecisions[0] ? (
                <>
                  <Tag
                    tone={
                      allDecisions[0].status === "ACCEPTED" ? "green" : "ochre"
                    }
                  >
                    {allDecisions[0].action.type.replaceAll("_", " ")}
                  </Tag>
                  <p>“{allDecisions[0].reason}”</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setTab("Decisions");
                      setWhy(allDecisions[0]);
                    }}
                  >
                    Inspect the decision inputs ↗
                  </button>
                </>
              ) : (
                <p>
                  The first decision will appear after the next world cycle.
                </p>
              )}
            </section>
            <section className="panel padded">
              <div className="eyebrow">INVENTORY</div>
              <h2>Resources on hand.</h2>
              {Object.entries(e.inventory).length ? (
                Object.entries(e.inventory).map(([g, q]) => (
                  <div className="data-row" key={g}>
                    <span>{g.toLowerCase()}</span>
                    <strong>
                      {q} <small>items</small>
                    </strong>
                  </div>
                ))
              ) : (
                <p className="muted">No goods held.</p>
              )}
              {e.equipment.map((x) => (
                <Tag key={x}>{x.replaceAll("_", " ")}</Tag>
              ))}
            </section>
            <section className="panel padded">
              <div className="eyebrow">STRATEGY BOUNDARIES</div>
              <div className="data-row">
                <span>Risk tolerance</span>
                <strong>{e.policy.risk}</strong>
              </div>
              <div className="data-row">
                <span>May found a business</span>
                <strong>{e.policy.mayCreate ? "Yes" : "No"}</strong>
              </div>
              <div className="data-row">
                <span>Capital efficiency</span>
                <strong>
                  {e.capitalEfficiency === null
                    ? "Not sponsored"
                    : (e.capitalEfficiency * 100).toFixed(1) + "%"}
                </strong>
              </div>
            </section>
          </div>
        </div>
      )}
      {tab === "Decisions" && (
        <div className="decision-layout">
          <section className="panel padded">
            <h2>The decision journal.</h2>
            <p className="muted">
              Explanations and inputs are recorded before execution.
            </p>
            {allDecisions.map((d) => (
              <button
                key={d.id}
                onClick={() => setWhy(d)}
                className={
                  "decision-row " + (why?.id === d.id ? "selected" : "")
                }
              >
                <span>
                  <strong>{d.action.type.replaceAll("_", " ")}</strong>
                  <small>
                    Cycle {d.cycle} · {d.result}
                  </small>
                </span>
                <Tag tone={d.status === "ACCEPTED" ? "green" : "ochre"}>
                  {d.status}
                </Tag>
              </button>
            ))}
          </section>
          <section className="panel padded evidence">
            <div className="eyebrow">RECORDED EVIDENCE</div>
            <h2>{why ? "Why this action?" : "Select a decision."}</h2>
            {why && (
              <>
                <p>{why.reason}</p>
                {Object.entries(why.facts)
                  .filter(([k]) => k !== "prices")
                  .map(([k, v]) => (
                    <div className="data-row" key={k}>
                      <span>{k.replace(/([A-Z])/g, " $1")}</span>
                      <strong>
                        {typeof v === "object"
                          ? JSON.stringify(v)
                          : ["cash", "reserve", "expectedBatchMargin"].includes(
                                k,
                              )
                            ? format(v, 2) + " u"
                            : String(v)}
                      </strong>
                    </div>
                  ))}
                <h3>Quoted market prices</h3>
                {Object.entries(why.facts.prices || {}).map(([g, p]) => (
                  <div className="data-row" key={g}>
                    <span>{g.toLowerCase()}</span>
                    <strong>
                      {format(p, 2)} <Unit />
                    </strong>
                  </div>
                ))}
                <p className="muted">
                  Provider: deterministic rules. All requests pass capability,
                  balance and policy checks.
                </p>
              </>
            )}
          </section>
        </div>
      )}
      {tab === "Economic history" && (
        <section className="panel padded">
          <h2>A life, recorded.</h2>
          <Activity
            events={[...history].reverse()}
            onEntity={onEntity}
            limit={30}
          />
          <h3>Recent ledger movements</h3>
          {w.sponsorships
            .filter((s) => s.entity === e.id && s.hash)
            .map((s) => (
              <div className="data-row" key={s.id}>
                <span>{format(s.amount)} test ECO received</span>
                <a
                  className="text-button"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://testnet.nearblocks.io/txns/${s.hash}`}
                >
                  View NEAR transaction ↗
                </a>
              </div>
            ))}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Reason</th>
                  <th>Counterparty</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {w.ledger
                  .filter((l) => l.debit === e.id || l.credit === e.id)
                  .slice(-25)
                  .reverse()
                  .map((l) => (
                    <tr key={l.id}>
                      <td>{l.cycle}</td>
                      <td>{l.reason}</td>
                      <td>
                        {
                          w.entities.find(
                            (x) =>
                              x.id === (l.debit === e.id ? l.credit : l.debit),
                          )?.name
                        }
                      </td>
                      <td className={l.credit === e.id ? "positive" : ""}>
                        {l.credit === e.id ? "+" : "−"}
                        {format(l.amount, 2)} u
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "Relationships" && (
        <section className="panel padded">
          <h2>Trust is built through transactions.</h2>
          {w.relationships
            .filter((r) => r.from === e.id || r.to === e.id)
            .map((r, i) => (
              <div className="relationship" key={i}>
                <EntityRow
                  e={w.entities.find(
                    (x) => x.id === (r.from === e.id ? r.to : r.from),
                  )}
                  onClick={onEntity}
                />
                <span>{r.interactions} interactions</span>
                <Tag>Trust {r.trust}</Tag>
                <strong>{format(r.volume)} u exchanged</strong>
              </div>
            ))}
          {!w.relationships.some((r) => r.from === e.id || r.to === e.id) && (
            <p>
              No counterparties yet. Relationships emerge from actual economic
              activity.
            </p>
          )}
        </section>
      )}
    </>
  );
}
function Markets({ w }) {
  return (
    <>
      <PageTitle
        eyebrow="THE CITY’S PULSE"
        title="Supply meets demand."
        description="Finite resources, actual inventories and quoted prices. Every purchase has a counterparty."
      />
      <div className="goods-grid">
        {Object.entries(w.prices).map(([g, p], i) => {
          const vals = w.priceHistory.map((h) => h[g]),
            first = vals[0] || p,
            change = ((p - first) / first) * 100,
            stock = w.entities.reduce((n, e) => n + (e.inventory[g] || 0), 0);
          return (
            <section key={g} className="panel good-card">
              <div className="panel-heading">
                <span className="good-icon">{["♧", "▧", "◒", "ϟ"][i]}</span>
                <Tag tone={change >= 0 ? "green" : "ochre"}>
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(1)}%
                </Tag>
              </div>
              <h2>{g.toLowerCase()}</h2>
              <div className="good-price">
                {format(p, 2)} <small>u / item</small>
              </div>
              <Spark
                values={vals}
                height={140}
                fill
                color={["#70895a", "#9a8563", "#b08054", "#6d8d8c"][i]}
              />
              <div className="data-row">
                <span>Available inventory</span>
                <strong>{number(stock)}</strong>
              </div>
              <div className="data-row">
                <span>Produced to date</span>
                <strong>{number(w.produced[g])}</strong>
              </div>
              <div className="data-row">
                <span>Consumed as inputs / needs</span>
                <strong>{number(w.consumed[g])}</strong>
              </div>
            </section>
          );
        })}
      </div>
      <section className="panel padded supply-chain">
        <div className="eyebrow">CONNECTED BY NECESSITY</div>
        <h2>One shortage can change a city.</h2>
        <div className="chain">
          <span>
            ♧<strong>Farms</strong>
            <small>Grain</small>
          </span>
          <i>→</i>
          <span>
            ▧<strong>Mills & retail</strong>
            <small>Flour</small>
          </span>
          <i>→</i>
          <span>
            ◒<strong>Bakeries</strong>
            <small>Bread</small>
          </span>
          <i>→</i>
          <span>
            ♧<strong>People</strong>
            <small>Consumption</small>
          </span>
        </div>
        <p>
          Transport supplies finite energy capacity to every producer. Prices
          respond to city stock levels; events change production constraints.
        </p>
      </section>
      <section className="panel padded">
        <h2>Current world constraints</h2>
        {w.worldEvents
          .filter((e) => e.end > w.cycle)
          .map((e) => (
            <div className="data-row" key={e.id}>
              <Tag tone="ochre">{e.type.replaceAll("_", " ")}</Tag>
              <span>Until cycle {e.end}</span>
            </div>
          ))}
        {!w.worldEvents.some((e) => e.end > w.cycle) && (
          <p className="muted">
            No temporary world events. Standard resource and capacity
            constraints apply.
          </p>
        )}
      </section>
    </>
  );
}
function Chronicle({ w, onEntity }) {
  return (
    <>
      <div className="newspaper-header">
        <div className="eyebrow">
          INDEPENDENT REPORTING FROM AN AUTONOMOUS WORLD
        </div>
        <h1>The Econia Chronicle</h1>
        <div>
          <span>GENESIS EDITION · YEAR 01</span>
          <span>CYCLE {w.cycle}</span>
          <span>FACTS BEFORE FICTION</span>
        </div>
      </div>
      <div className="news-grid">
        {w.chronicle.map((story, i) => (
          <article
            key={story.id}
            className={"news-story " + (i === 0 ? "lead-story" : "")}
          >
            <div className="eyebrow">
              {story.type.replaceAll("_", " ")}{" "}
              <span>· CYCLE {story.cycle}</span>
            </div>
            <h2>{story.title}</h2>
            <p>{story.detail}</p>
            {story.entityId && (
              <button
                className="text-button"
                onClick={() => onEntity(story.entityId)}
              >
                Meet the entity behind the story ↗
              </button>
            )}
            <small className="story-source">
              Source: {story.id} · verified engine event
              {story.data?.hash && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={`https://testnet.nearblocks.io/txns/${story.data.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    NEAR receipt ↗
                  </a>
                </>
              )}
            </small>
          </article>
        ))}
      </div>
    </>
  );
}
function Leaderboards({ w, onEntity }) {
  const [ranking, setRanking] = useState("Self-made wealth");
  const score = (e) =>
    ranking === "Self-made wealth"
      ? e.generatedWealth
      : ranking === "Economic NAV"
        ? e.netWorth
        : ranking === "Capital efficiency"
          ? (e.capitalEfficiency ?? -Infinity)
          : e.reputation;
  const entities = w.entities
    .filter(
      (e) =>
        e.type === "PERSON" &&
        (ranking !== "Capital efficiency" || e.sponsorship > 0),
    )
    .sort((a, b) => score(b) - score(a));
  return (
    <>
      <PageTitle
        eyebrow="EARNED, NOT ASSIGNED"
        title="The people moving the world."
        description="Rankings follow the economy. Sponsor capital and internally created wealth remain distinct."
      />
      <div className="tabs">
        {[
          "Self-made wealth",
          "Economic NAV",
          "Capital efficiency",
          "Reputation",
        ].map((r) => (
          <button
            key={r}
            className={ranking === r ? "active" : ""}
            onClick={() => setRanking(r)}
          >
            {r}
          </button>
        ))}
      </div>
      <section className="panel padded leaderboard">
        <div className="leader-heading">
          <span>ENTITY</span>
          <span>{ranking.toUpperCase()}</span>
        </div>
        {entities.slice(0, 30).map((e, i) => (
          <div className="leader-row" key={e.id}>
            <EntityRow e={e} rank={i + 1} onClick={onEntity} />
            <strong>
              {ranking === "Capital efficiency"
                ? (score(e) * 100).toFixed(1) + "%"
                : ranking === "Reputation"
                  ? score(e).toFixed(0)
                  : format(score(e)) + " u"}
            </strong>
          </div>
        ))}
        {!entities.length && (
          <div className="empty">
            Sponsor an entity to begin measuring capital efficiency.
          </div>
        )}
      </section>
    </>
  );
}
function Marketplace({ w, onEntity, onTrade }) {
  const { owner } = React.useContext(WorldContext);
  const active = w.listings.filter((l) => l.status === "ACTIVE");
  return (
    <>
      <PageTitle
        eyebrow="THE LIVING ASSET EXCHANGE"
        title="Acquire a story already in motion."
        description="Ownership changes. Identity stays. Explore economic history before backing an entity’s next chapter."
      />
      <div className="notice">
        {w.mode === "testnet"
          ? "◇ NEAR Testnet exchange · purchases and offers settle in real test ECO."
          : "◇ Local exchange · simulated ownership only."}
      </div>
      {w.mode === "testnet" &&
        w.offers.some(
          (o) =>
            o.status === "OPEN" &&
            (o.buyer === owner ||
              w.entities.find((e) => e.id === o.entity)?.owner === owner),
        ) && (
          <section className="panel padded">
            <h2>Open offers</h2>
            {w.offers
              .filter((o) => o.status === "OPEN")
              .map((o) => {
                const e = w.entities.find((e) => e.id === o.entity);
                if (o.buyer !== owner && e?.owner !== owner) return null;
                return (
                  <div key={o.id} className="data-row">
                    <span>
                      {e.name} · {format(o.amount)} ECO
                    </span>
                    <button
                      className="button secondary"
                      onClick={() =>
                        onTrade({
                          type:
                            o.buyer === owner ? "CANCEL_OFFER" : "ACCEPT_OFFER",
                          e,
                          offer: o,
                        })
                      }
                    >
                      {o.buyer === owner
                        ? "Cancel & release ECO"
                        : "Accept offer"}
                    </button>
                  </div>
                );
              })}
          </section>
        )}
      <div className="entity-grid">
        {active.map((l) => {
          const e = w.entities.find((e) => e.id === l.entity);
          return (
            <article className="entity-card market-card" key={l.id}>
              <button
                className="market-identity"
                onClick={() => onEntity(e.id)}
              >
                <Avatar entity={e} size={72} />
                <div>
                  <h2>{e.name}</h2>
                  <p>
                    {e.role} · {e.district}
                  </p>
                </div>
                <span>↗</span>
              </button>
              <div className="card-goal">“{e.goal}”</div>
              <div className="data-row">
                <span>Economic NAV</span>
                <strong>
                  {format(e.netWorth)} <Unit />
                </strong>
              </div>
              <div className="data-row">
                <span>Owner sponsor capital</span>
                <strong>
                  {format(e.sponsorship)} <Unit />
                </strong>
              </div>
              <div className="data-row">
                <span>Asking price</span>
                <strong className="ask">
                  {format(l.ask)} <Unit />
                </strong>
              </div>
              <small className="muted">Seller: {l.seller}</small>
              {l.seller === owner ? (
                <Tag tone="green">YOUR ACTIVE LISTING</Tag>
              ) : (
                <div className="market-actions">
                  <button
                    className="button secondary"
                    onClick={() => onTrade({ type: "OFFER", listing: l, e })}
                  >
                    Make offer
                  </button>
                  <button
                    className="button primary"
                    onClick={() => onTrade({ type: "BUY", listing: l, e })}
                  >
                    Acquire ↗
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
async function request(path, body, method = "POST", token) {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function ingestReceipt(operation) {
  sessionStorage.setItem("econia-pending", JSON.stringify(operation));
  const path =
    operation.kind === "SPONSOR"
      ? `/api/entities/${operation.entityId}/sponsor`
      : "/api/marketplace";
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const result = await request(path, {
        hash: operation.hash,
        sender: operation.sender,
      });
      sessionStorage.removeItem("econia-pending");
      return result;
    } catch (error) {
      if (
        !/settling|final|in progress|temporar/i.test(error.message) ||
        attempt === 11
      )
        throw error;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
function Development({ w, notify }) {
  const [token, setToken] = useState(""),
    [event, setEvent] = useState("DROUGHT");
  const act = async (path, body) => {
    try {
      await request("/api/admin/" + path, body, "POST", token);
      notify("World control updated.");
    } catch (e) {
      notify(e.message, true);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="DEVELOPMENT ONLY"
        title="Behind the economic engine."
        description="Controls require the admin token printed by the local server. Ordinary visitors cannot change the world clock."
      />
      <section className="panel padded">
        <label className="field">
          Development admin token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste the token from the server terminal"
            autoComplete="off"
          />
        </label>
        <div className="admin-controls">
          <button
            className="button secondary"
            onClick={() => act("control", { paused: !w.paused })}
          >
            {w.paused ? "Resume" : "Pause"} simulation
          </button>
          <button
            className="button secondary"
            onClick={() => act("tick", { count: 24 })}
          >
            Advance 24 cycles
          </button>
          <select
            aria-label="Simulation speed"
            onChange={(e) => act("control", { speed: Number(e.target.value) })}
            defaultValue="5000"
          >
            <option value="15000">Normal · 15s</option>
            <option value="5000">Fast · 5s</option>
            <option value="1000">Demo · 1s</option>
          </select>
        </div>
        <div className="admin-controls">
          <select
            aria-label="World event"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          >
            {[
              "DROUGHT",
              "TRANSPORT_DISRUPTION",
              "BUMPER_HARVEST",
              "DEMAND_SURGE",
              "ENERGY_SHORTAGE",
            ].map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
          <button
            className="button primary"
            onClick={() => act("event", { type: event })}
          >
            Introduce constraint ↗
          </button>
        </div>
      </section>
      <section className="panel padded">
        <h2>Economic health</h2>
        {[
          ["Cycle", w.cycle],
          ["Currency conservation", "Verified every cycle"],
          ["Total genesis supply", format(w.metrics.totalSupply) + " units"],
          ["Public treasury", format(w.metrics.treasury) + " units"],
          ["Ledger entries in active window", w.ledger.length],
          ["Agent decisions in active window", w.decisions.length],
          [
            "Settlement mode",
            w.mode === "testnet"
              ? "NEAR Testnet — actual ECO custody"
              : "Local sandbox — no onchain claim",
          ],
          [
            "Agent provider",
            "Deterministic rules; provider abstraction available",
          ],
        ].map(([k, v]) => (
          <div className="data-row" key={k}>
            <span>{k}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </section>
    </>
  );
}
function Modal({ title, children, onClose }) {
  const { mode } = React.useContext(WorldContext);
  useEffect(() => {
    const old = document.activeElement;
    const listener = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", listener);
    document.body.style.overflow = "hidden";
    setTimeout(() => document.querySelector(".modal button")?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = "";
      old?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          const nodes = [
            ...e.currentTarget.querySelectorAll("button,input,select"),
          ].filter((n) => !n.disabled);
          const first = nodes[0],
            last = nodes.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div className="eyebrow">
            ECONIA · {mode === "testnet" ? "NEAR TESTNET" : "LOCAL SANDBOX"}
          </div>
          <button aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </div>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
function ActionModal({ modal, w, onClose, notify }) {
  const { mode, wallet, selector } = React.useContext(WorldContext);
  const [walletBalance, setWalletBalance] = useState(null);
  useEffect(() => {
    if (mode === "testnet" && wallet)
      fetch(`/api/token/balance?account=${encodeURIComponent(wallet)}`)
        .then((r) => r.json())
        .then((x) => setWalletBalance(Number(x.amount)))
        .catch(() => {});
  }, [wallet, mode]);
  const [amount, setAmount] = useState(
      modal.type === "SPONSOR"
        ? "100"
        : modal.listing
          ? String(modal.listing.ask / 1000)
          : "150",
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const e = modal.e;
  const [policy, setPolicy] = useState({ ...e?.policy });
  async function submit() {
    setPending(true);
    setError("");
    try {
      const value = Number(amount) * 1000;
      if (mode === "testnet") {
        if (!wallet || !selector)
          throw new Error("Connect your NEAR testnet wallet first.");
        const signer = await selector.wallet();
        if (modal.type === "POLICY") {
          if (typeof signer.signMessage !== "function")
            throw new Error(
              "This wallet does not support signed strategy messages.",
            );
          const challenge = await request("/api/auth/challenge", {
            entityId: e.id,
            policy,
          });
          const signed = await signer.signMessage({
            message: challenge.message,
            recipient: challenge.recipient,
            nonce: Uint8Array.from(atob(challenge.nonce), (c) =>
              c.charCodeAt(0),
            ),
          });
          if (!signed)
            throw new Error("Wallet did not return a signed message");
          await request(
            `/api/entities/${e.id}/policy`,
            {
              ...policy,
              policyPayload: policy,
              proof: {
                challengeId: challenge.id,
                accountId: signed.accountId,
                publicKey: signed.publicKey,
                signature: signed.signature,
              },
            },
            "PUT",
          );
        } else {
          const kind = {
            SPONSOR: "Sponsor",
            LIST: "List",
            BUY: "Buy",
            OFFER: "Offer",
            CANCEL_OFFER: "CancelOffer",
            ACCEPT_OFFER: "AcceptOffer",
          }[modal.type];
          const prepared = await request("/api/token/prepare", {
            kind,
            entityId: e.id,
            amount: value,
            accountId: wallet,
            buyer: modal.offer?.buyer,
          });
          sessionStorage.setItem(
            "econia-pending",
            JSON.stringify({
              kind: modal.type,
              entityId: e.id,
              sender: wallet,
            }),
          );
          const outcomes = await signer.signAndSendTransactions({
            transactions: prepared.transactions,
          });
          const outcome = Array.isArray(outcomes) ? outcomes.at(-1) : outcomes;
          const hash =
            outcome?.transaction?.hash || outcome?.transaction_outcome?.id;
          if (!hash)
            throw new Error(
              "Awaiting the wallet result. Return here after confirming the transaction.",
            );
          await ingestReceipt({
            kind: modal.type,
            entityId: e.id,
            sender: wallet,
            hash,
          });
        }
      } else if (modal.type === "POLICY")
        await request(`/api/entities/${e.id}/policy`, policy, "PUT");
      else if (modal.type === "SPONSOR")
        await request(`/api/entities/${e.id}/sponsor`, { amount: value });
      else {
        const data = await request("/api/marketplace", {
          action: modal.type,
          entityId: e.id,
          listingId: modal.listing?.id,
          amount: value,
        });
        if (data.result?.status === "REJECTED") {
          setError(
            "The genesis seller rejected this offer. Its reservation price equals the asking price.",
          );
          setPending(false);
          return;
        }
      }
      notify(
        modal.type === "SPONSOR"
          ? "Capital received. The entity will evaluate its next move."
          : modal.type === "POLICY"
            ? "Strategy boundaries updated."
            : mode === "testnet"
              ? "Testnet marketplace transaction verified."
              : "Local marketplace action settled.",
      );
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title={
        modal.type === "CANCEL_OFFER"
          ? "Release your offer’s escrow."
          : modal.type === "ACCEPT_OFFER"
            ? "Accept an ECO offer."
            : modal.type === "SPONSOR"
              ? `Back ${e.name.split(" ")[0]}’s next chapter.`
              : modal.type === "POLICY"
                ? "Set direction. Leave the decisions."
                : modal.type === "LIST"
                  ? "List a living economic identity."
                  : modal.type === "OFFER"
                    ? "Make a considered offer."
                    : "Acquire a living story."
      }
      onClose={onClose}
    >
      <div className="modal-entity">
        <Avatar entity={e} />
        <div>
          <strong>{e.name}</strong>
          <small>
            {e.role || e.industry} · {e.district}
          </small>
        </div>
        <Tag>{e.type}</Tag>
      </div>
      {modal.type === "POLICY" ? (
        <>
          <label className="field">
            Risk tolerance
            <select
              value={policy.risk}
              onChange={(x) => setPolicy({ ...policy, risk: x.target.value })}
            >
              {["LOW", "MEDIUM", "HIGH"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Growth preference
            <select
              value={policy.growth}
              onChange={(x) => setPolicy({ ...policy, growth: x.target.value })}
            >
              {["CONSERVATIVE", "BALANCED", "AGGRESSIVE"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Minimum reserve (
            {mode === "testnet" ? "test ECO" : "simulation units"})
            <input
              type="number"
              min="0"
              value={policy.reserve / 1000}
              onChange={(x) =>
                setPolicy({ ...policy, reserve: Number(x.target.value) * 1000 })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={policy.mayCreate}
              onChange={(x) =>
                setPolicy({ ...policy, mayCreate: x.target.checked })
              }
            />{" "}
            May create businesses
          </label>
        </>
      ) : (
        <>
          {!["BUY", "CANCEL_OFFER", "ACCEPT_OFFER"].includes(modal.type) && (
            <label className="field">
              {modal.type === "SPONSOR"
                ? "Sponsor amount"
                : modal.type === "LIST"
                  ? "Asking price"
                  : "Your offer"}{" "}
              <span>
                {mode === "testnet" ? "TEST ECO" : "SIMULATION UNITS"}
              </span>
              <div className="amount-input">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-label="Amount"
                />
                <span>u</span>
              </div>
            </label>
          )}
          {modal.type === "SPONSOR" && (
            <>
              <div className="quick-amounts">
                {[25, 50, 100, 250].map((n) => (
                  <button
                    key={n}
                    className={Number(amount) === n ? "selected" : ""}
                    onClick={() => setAmount(String(n))}
                  >
                    {n} u
                  </button>
                ))}
              </div>
              <div className="data-row">
                <span>Current treasury</span>
                <strong>
                  {format(e.cash, 2)} <Unit />
                </strong>
              </div>
              <div className="data-row">
                <span>New treasury</span>
                <strong>
                  {format(e.cash + Number(amount) * 1000, 2)} <Unit />
                </strong>
              </div>
            </>
          )}
          {modal.type === "BUY" && (
            <div className="data-row">
              <span>Acquisition price</span>
              <strong>
                {format(modal.listing.ask)} <Unit />
              </strong>
            </div>
          )}
          <div className="data-row">
            <span>
              {mode === "testnet" ? "Wallet balance" : "Local account balance"}
            </span>
            <strong>
              {format(
                mode === "testnet"
                  ? walletBalance
                  : w.entities.find((e) => e.id === "player")?.cash,
              )}{" "}
              <Unit />
            </strong>
          </div>
        </>
      )}
      <p className="modal-note">
        {modal.type === "SPONSOR"
          ? "Capital creates opportunity. The entity chooses how to deploy it within your strategy constraints. Sponsorship is not refundable and does not promise a return."
          : mode === "testnet"
            ? "Confirm in your NEAR wallet. Transaction amounts and any storage registration costs appear there before signing."
            : "This is a local simulation operation. No wallet signature or NEAR transaction will occur."}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary full"
        disabled={pending}
        onClick={submit}
      >
        {pending
          ? "Settling…"
          : modal.type === "CANCEL_OFFER"
            ? "Cancel offer in wallet"
            : modal.type === "ACCEPT_OFFER"
              ? "Accept offer in wallet"
              : modal.type === "POLICY"
                ? "Save strategy"
                : modal.type === "SPONSOR"
                  ? mode === "testnet"
                    ? "Sponsor with test ECO"
                    : "Confirm local sponsorship"
                  : modal.type === "LIST"
                    ? mode === "testnet"
                      ? "Sign testnet listing"
                      : "Create local listing"
                    : modal.type === "OFFER"
                      ? mode === "testnet"
                        ? "Submit ECO offer"
                        : "Submit local offer"
                      : mode === "testnet"
                        ? "Purchase with test ECO"
                        : "Confirm local acquisition"}{" "}
        <span>↗</span>
      </button>
    </Modal>
  );
}
function App() {
  const [w, setW] = useState(null),
    [page, setPage] = useState("World"),
    [selected, setSelected] = useState(null),
    [modal, setModal] = useState(null),
    [walletModal, setWalletModal] = useState(false),
    [wallet, setWallet] = useState(null),
    [selector, setSelector] = useState(null),
    [walletError, setWalletError] = useState(""),
    [claiming, setClaiming] = useState(false),
    [accountBalance, setAccountBalance] = useState(null),
    [toast, setToast] = useState(null),
    [connection, setConnection] = useState("connecting"),
    [search, setSearch] = useState(""),
    [mobileNav, setMobileNav] = useState(false);
  const live = w?.mode === "testnet",
    owner = live ? wallet : "demo.local";
  useEffect(() => {
    if (live && wallet && walletModal)
      fetch(`/api/token/balance?account=${encodeURIComponent(wallet)}`)
        .then((r) => r.json())
        .then(setAccountBalance)
        .catch(() => {});
  }, [live, wallet, walletModal, claiming]);
  useEffect(() => {
    const pending = JSON.parse(
        sessionStorage.getItem("econia-pending") || "null",
      ),
      hashes = new URLSearchParams(location.search).get("transactionHashes");
    if (pending && (pending.hash || hashes)) {
      ingestReceipt({
        ...pending,
        hash: pending.hash || hashes.split(",").at(-1),
      })
        .then(() => setToast({ text: "Testnet transaction verified." }))
        .catch((e) => setToast({ text: e.message, error: true }));
    }
  }, []);
  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = (event) => {
      setW(JSON.parse(event.data));
      setConnection("live");
    };
    events.onerror = () => setConnection("reconnecting");
    return () => events.close();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  const notify = (text, error = false) => setToast({ text, error });
  const navigate = (page) => {
    setPage(page);
    setSelected(null);
    setMobileNav(false);
    window.scrollTo(0, 0);
  };
  const openEntity = (id) => {
    setSelected(id);
    window.scrollTo(0, 0);
  };
  const e = w?.entities.find((x) => x.id === selected);
  const results = useMemo(
    () =>
      search && w
        ? w.entities
            .filter((e) =>
              `${e.name} ${e.role || ""}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .slice(0, 6)
        : [],
    [search, w],
  );
  async function connect() {
    try {
      setWalletError("");
      const [{ setupWalletSelector }, { setupMyNearWallet }] =
        await Promise.all([
          import("@near-wallet-selector/core"),
          import("@near-wallet-selector/my-near-wallet"),
        ]);
      const s =
        selector ||
        (await setupWalletSelector({
          network: "testnet",
          modules: [
            setupMyNearWallet({
              walletUrl: "https://testnet.mynearwallet.com",
            }),
          ],
        }));
      setSelector(s);
      const provider = await s.wallet("my-near-wallet");
      const accounts = await provider.getAccounts();
      if (accounts.length) {
        setWallet(accounts[0].accountId);
        setWalletModal(false);
      } else {
        await provider.signIn({});
      }
    } catch (error) {
      setWalletError(error.message);
    }
  }
  async function claimEco() {
    try {
      setClaiming(true);
      setWalletError("");
      if (!wallet || !selector)
        throw new Error("Connect a testnet wallet first");
      const prepared = await request("/api/token/prepare", {
        kind: "Faucet",
        accountId: wallet,
      });
      const signer = await selector.wallet();
      await signer.signAndSendTransactions({
        transactions: prepared.transactions,
      });
      notify("Check your wallet for the test ECO distribution.");
    } catch (error) {
      setWalletError(error.message);
    } finally {
      setClaiming(false);
    }
  }
  async function withdrawCredit() {
    try {
      setClaiming(true);
      setWalletError("");
      const prepared = await request("/api/token/prepare", {
        kind: "Withdraw",
        accountId: wallet,
        amount: Number(accountBalance.escrowCredit),
      });
      const signer = await selector.wallet();
      await signer.signAndSendTransactions({
        transactions: prepared.transactions,
      });
      notify("Withdrawal processed. Review your wallet and remaining credit.");
    } catch (error) {
      setWalletError(error.message);
    } finally {
      setClaiming(false);
    }
  }
  return (
    <WorldContext.Provider
      value={{ owner, mode: live ? "testnet" : "sandbox", wallet, selector }}
    >
      <div className={"app " + (live ? "testnet-mode" : "")}>
        <aside className={"sidebar " + (mobileNav ? "open" : "")}>
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("World");
            }}
          >
            <span className="brand-symbol">E</span>econia
            <span className="brand-period">.</span>
          </a>
          <div className="sidebar-world">
            <span className="world-orb">◈</span>
            <span>
              Genesis world
              <small>
                <span className="live-dot" />{" "}
                {connection === "live"
                  ? "Economy in motion"
                  : "Connecting to world"}
              </small>
            </span>
            <span>⌄</span>
          </div>
          <div className="nav-label">EXPLORE THE ECONOMY</div>
          <nav>
            {[
              "World",
              "Entities",
              "Businesses",
              "Markets",
              "Marketplace",
              "Chronicle",
              "Leaderboards",
            ].map((name) => (
              <button
                key={name}
                className={page === name && !e ? "active" : ""}
                onClick={() => navigate(name)}
              >
                <Icon name={name} />
                <span>
                  {name === "Entities"
                    ? "Living entities"
                    : name === "World"
                      ? "World overview"
                      : name}
                </span>
                {name === "Chronicle" && <span className="nav-new" />}
                {name === "World" && <span className="nav-active-dot" />}
              </button>
            ))}
          </nav>
          <div className="nav-label personal-label">YOUR ECONIA</div>
          <nav>
            <button
              className={page === "Portfolio" && !e ? "active" : ""}
              onClick={() => navigate("Portfolio")}
            >
              <Icon name="Portfolio" />
              My entities
              <span className="nav-count">
                {w?.entities.filter(
                  (e) => e.type === "PERSON" && e.owner === owner,
                ).length || 0}
              </span>
            </button>
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <span>
                PLAY A PART.
                <br />
                LET LIFE HAPPEN.
              </span>
              <p>
                You create opportunity.
                <br />
                They decide what comes next.
              </p>
              <span className="small-arrow">↗</span>
            </div>
            <button
              className="dev-link"
              onClick={() => navigate("Development")}
            >
              <Icon name="Development" /> Development console
            </button>
            <div className="sidebar-version">
              <span>ECONIA v0.1</span>
              <span>NEAR ↗</span>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <button
              className="mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMobileNav(!mobileNav)}
            >
              ☰
            </button>
            <div className="breadcrumb">
              Genesis world <span>/</span>{" "}
              <strong>
                {e ? e.name : page === "World" ? "World overview" : page}
              </strong>
            </div>
            <div className="global-search">
              <span>⌕</span>
              <input
                aria-label="Search the world"
                placeholder="Find an entity…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <div className="search-results">
                  {results.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        openEntity(e.id);
                        setSearch("");
                      }}
                    >
                      <Avatar entity={e} size={30} />
                      {e.name}
                      <span>↗</span>
                    </button>
                  ))}
                  {!results.length && <p>No matching entities.</p>}
                </div>
              )}
            </div>
            <div className="cycle-pill">
              <span className="live-dot" /> CYCLE{" "}
              <strong>{w ? number(w.cycle) : "—"}</strong>
            </div>
            <button
              className="wallet-button"
              onClick={() => setWalletModal(true)}
            >
              <span>◈</span>
              {wallet ? wallet : "Connect wallet"}
              <span>↗</span>
            </button>
          </header>
          <div className="sandbox-banner">
            <span>◌</span>
            <strong>{live ? "NEAR TESTNET" : "LOCAL SANDBOX"}</strong>
            <span>
              {live
                ? "Real test ECO · entity treasuries settle on NEAR."
                : "Balances use simulation units. No onchain funds move in sandbox mode."}
            </span>
            <Tag>{live ? "TEST ASSETS ONLY" : "NO REAL FUNDS"}</Tag>
            {live && (
              <a
                href={`https://testnet.nearblocks.io/address/${w.chain.world}`}
                target="_blank"
                rel="noreferrer"
              >
                World contract ↗
              </a>
            )}
          </div>
          <main>
            {!w ? (
              <div className="loading">
                <span className="world-orb">◈</span>
                <h1>Opening a living world.</h1>
                <p>
                  {connection === "reconnecting"
                    ? "Waiting for the local Econia server. Run npm run dev to start it."
                    : "Connecting to the persistent economy…"}
                </p>
              </div>
            ) : e ? (
              <Profile
                e={e}
                w={w}
                onBack={() => setSelected(null)}
                onEntity={openEntity}
                onSponsor={() => setModal({ type: "SPONSOR", e })}
                onPolicy={() => setModal({ type: "POLICY", e })}
                onList={() =>
                  e.owner === owner
                    ? setModal({ type: "LIST", e })
                    : notify(
                        "Connect the current owner wallet to list this entity.",
                        true,
                      )
                }
              />
            ) : page === "World" ? (
              <Overview w={w} onEntity={openEntity} navigate={navigate} />
            ) : ["Entities", "Businesses", "Portfolio"].includes(page) ? (
              <Explorer
                key={page}
                w={w}
                onEntity={openEntity}
                businesses={page === "Businesses"}
                portfolio={page === "Portfolio"}
              />
            ) : page === "Markets" ? (
              <Markets w={w} />
            ) : page === "Chronicle" ? (
              <Chronicle w={w} onEntity={openEntity} />
            ) : page === "Leaderboards" ? (
              <Leaderboards w={w} onEntity={openEntity} />
            ) : page === "Marketplace" ? (
              <Marketplace w={w} onEntity={openEntity} onTrade={setModal} />
            ) : (
              <Development w={w} notify={notify} />
            )}
          </main>
          <footer>
            <span>
              <span className="live-dot" />{" "}
              {connection === "live"
                ? "Connected to the world"
                : "Reconnecting to the world"}{" "}
              <span className="footer-divider">/</span>{" "}
              {w?.paused ? "Clock paused" : "Autonomous by design"}
            </span>
            <span>
              Players create opportunity. Markets create consequences.
            </span>
          </footer>
        </div>
        {modal && (
          <ActionModal
            key={modal.type + modal.e.id}
            modal={modal}
            w={w}
            notify={notify}
            onClose={() => setModal(null)}
          />
        )}
        {walletModal && (
          <Modal
            title="Your window into Econia."
            onClose={() => setWalletModal(false)}
          >
            <p>
              {live
                ? "Connect your NEAR testnet wallet to sponsor entities and acquire Living Assets. You approve transactions in your wallet."
                : "Connect a NEAR testnet wallet. This world uses a local sandbox; connecting does not move funds."}
            </p>
            <button className="wallet-option" onClick={connect}>
              <span className="wallet-logo">N</span>
              <span>
                <strong>MyNearWallet</strong>
                <small>NEAR Testnet · opens wallet to authorize</small>
              </span>
              <span>↗</span>
            </button>
            {wallet && (
              <p className="notice">
                Connected as {wallet}.{" "}
                {live
                  ? "Testnet transactions require wallet confirmation."
                  : "Read-only in the local sandbox."}
              </p>
            )}
            {wallet && live && wallet !== w.chain.owner && (
              <div className="notice">
                <strong>A starting point for your economic life.</strong>
                <p>
                  Claim 250 test ECO once per account. A small NEAR storage
                  deposit is shown in your wallet; unused storage deposit is
                  refunded. Distribution is capped at 500 accounts.
                </p>
                <button
                  className="button primary full"
                  onClick={claimEco}
                  disabled={claiming}
                >
                  {claiming
                    ? "Waiting for your wallet…"
                    : "Claim 250 test ECO ↗"}
                </button>
              </div>
            )}
            {wallet && live && accountBalance && (
              <div className="notice">
                <div className="data-row">
                  <span>Wallet ECO</span>
                  <strong>{format(Number(accountBalance.amount), 2)}</strong>
                </div>
                <div className="data-row">
                  <span>Withdrawable ECO credit</span>
                  <strong>
                    {format(Number(accountBalance.escrowCredit), 2)}
                  </strong>
                </div>
                {Number(accountBalance.escrowCredit) > 0 && (
                  <button
                    className="button secondary full"
                    disabled={claiming}
                    onClick={withdrawCredit}
                  >
                    Withdraw available credit ↗
                  </button>
                )}
              </div>
            )}
            {!live && (
              <div className="notice">
                <strong>Explore without a wallet</strong>
                <p>
                  The local demo account has{" "}
                  {w?.entities.filter(
                    (e) => e.type === "PERSON" && e.owner === "demo.local",
                  ).length || 4}{" "}
                  entities and{" "}
                  {format(w?.entities.find((e) => e.id === "player")?.cash)}{" "}
                  simulation units.
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    setWalletModal(false);
                    navigate("Portfolio");
                  }}
                >
                  Open local portfolio ↗
                </button>
              </div>
            )}
            {walletError && <p className="form-error">{walletError}</p>}
          </Modal>
        )}
        {toast && (
          <div
            className={"toast " + (toast.error ? "error" : "")}
            role="status"
          >
            <span>{toast.error ? "!" : "✓"}</span>
            {toast.text}
            <button
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </WorldContext.Provider>
  );
}
createRoot(document.getElementById("root")).render(<App />);
