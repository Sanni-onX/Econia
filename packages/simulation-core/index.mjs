import {
  catalog,
  transfer,
  nav,
  addHolding,
  assertInvariants,
  money,
} from "../economy/index.mjs";
import { RuleBasedAgentProvider } from "../agent-sdk/index.mjs";
export { catalog, nav, assertInvariants };
export function random(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const policy = () => ({
  risk: "MEDIUM",
  growth: "BALANCED",
  reserve: 12000,
  debtCeiling: 0,
  mayCreate: true,
  mayInvest: false,
  majorAssetSale: "OWNER_APPROVAL",
});
function entity(id, name, type, cash) {
  return {
    id,
    name,
    type,
    owner: "genesis.testnet",
    generation: 0,
    createdCycle: 0,
    capabilities: ["HOLD_FUNDS", "OWN", "TRADE"],
    cash,
    genesisCapital: cash,
    inventory: {},
    equipment: [],
    skills: {
      cooking: 40,
      farming: 40,
      trading: 40,
      negotiation: 40,
      management: 40,
      transport: 40,
    },
    traits: {
      ambition: 60,
      patience: 50,
      frugality: 50,
      adaptability: 60,
      riskTolerance: 50,
    },
    policy: policy(),
    sponsorship: 0,
    revenue: 0,
    expenses: 0,
    debt: 0,
    reputation: 50,
    interactions: 0,
    status: "ACTIVE",
    district: "Commons",
    goal: "Build a resilient economic life.",
    provider: "rules",
  };
}
export function emit(w, type, entityId, title, detail, data = {}) {
  const event = {
    id: `event-${++w.sequence}`,
    sequence: w.sequence,
    cycle: w.cycle,
    type,
    entityId,
    title,
    detail,
    data,
  };
  w.events.push(event);
  return event;
}
export function genesis(seed = "econia-genesis-1", population = 64) {
  if (!Number.isInteger(population) || population < 4 || population > 1000)
    throw new Error("Population must be 4–1000");
  const rng = random(seed),
    w = {
      version: 1,
      seed,
      mode: "sandbox",
      cycle: 0,
      sequence: 0,
      entities: {},
      holdings: [],
      jobs: [],
      relationships: [],
      ledger: [],
      events: [],
      decisions: [],
      prices: Object.fromEntries(
        Object.entries(catalog.goods).map(([g, x]) => [g, x.price]),
      ),
      priceHistory: [],
      metricsHistory: [],
      worldEvents: [],
      sponsorships: [],
      listings: [],
      offers: [],
      receipts: [],
      produced: {},
      consumed: {},
      genesisInventory: {},
      supply: 0,
      paused: false,
    };
  const treasury = entity(
    "treasury",
    "Econia public treasury",
    "ORGANIZATION",
    500000000,
  );
  treasury.goal = "Fund infrastructure and maintain economic circulation.";
  w.entities.treasury = treasury;
  const names = [
    "Mira",
    "Kofi",
    "Ada",
    "Ren",
    "Sana",
    "Leo",
    "Amara",
    "Nico",
    "Yuki",
    "Ezra",
    "Zara",
    "Ivo",
    "Lena",
    "Omar",
    "Tala",
    "Kai",
  ];
  const roles = ["Food artisan", "Grower", "Merchant", "Courier"];
  for (let i = 0; i < population; i++) {
    const personNumber = i === 0 ? 199 : 100 + i >= 199 ? 101 + i : 100 + i;
    const id = `person_${personNumber}`;
    const e = entity(
      id,
      `${names[i % names.length]} #${personNumber}`,
      "PERSON",
      i === 0 ? 24000 : Math.floor(25 + rng() * 50) * 1000,
    );
    e.owner = i < 4 ? "demo.local" : "genesis.testnet";
    e.capabilities.push("WORK", "CREATE_BUSINESS", "INVEST");
    e.role = roles[i % 4];
    e.district = ["Commons", "Greenfield", "Market quarter", "Harbor"][i % 4];
    for (const s of Object.keys(e.skills))
      e.skills[s] = Math.floor(20 + rng() * 60);
    e.skills[["cooking", "farming", "trading", "transport"][i % 4]] =
      Math.floor(65 + rng() * 25);
    e.traits.ambition = Math.floor(35 + rng() * 60);
    e.goal = [
      "Build a profitable food company.",
      "Supply the city with reliable harvests.",
      "Connect producers with customers.",
      "Keep goods moving across the city.",
    ][i % 4];
    if (i === 0) {
      e.skills.cooking = 91;
      e.traits.ambition = 92;
      e.reputation = 76;
    }
    w.entities[id] = e;
  }
  const companies = [
    ["FARMING", "Greenfield Farm", "Greenfield"],
    ["MILLING", "Common Ground Mill", "Market quarter"],
    ["FOOD", "Hearth & Grain", "Commons"],
    ["TRANSPORT", "Harbor Logistics", "Harbor"],
  ];
  for (let i = 0; i < 12; i++) {
    const [industry, name, district] = companies[i % 4],
      id = `business_${i + 1}`,
      r = catalog.recipes[industry];
    const e = entity(
      id,
      `${name}${i >= 4 ? " " + (Math.floor(i / 4) + 1) : ""}`,
      "BUSINESS",
      120000,
    );
    Object.assign(e, {
      industry,
      district,
      role: industry === "MILLING" ? "RETAIL" : industry,
      capabilities: [...e.capabilities, "HIRE", "PRODUCE"],
      equipment: [r.equipment],
      goal: `Operate a resilient ${industry.toLowerCase()} business.`,
    });
    e.policy.reserve = 4000;
    e.skills[r.skill] = 80;
    e.inventory = Object.fromEntries(
      Object.keys(catalog.goods).map((g) => [g, 0]),
    );
    for (const [g, q] of Object.entries(r.inputs)) e.inventory[g] = q * 20;
    for (const [g, q] of Object.entries(r.outputs)) e.inventory[g] = q * 15;
    w.entities[id] = e;
    addHolding(
      w,
      Object.keys(w.entities).filter((x) => x.startsWith("person_"))[
        (i + 4) % population
      ],
      id,
      10000,
    );
    const person = Object.values(w.entities).filter((x) => x.type === "PERSON")[
      i === 2 ? 0 : (i + 1) % population
    ];
    if (!w.jobs.some((j) => j.person === person.id))
      w.jobs.push({
        id: `job-${i}`,
        business: id,
        person: person.id,
        wage: 1500,
        started: 0,
        skill: r.skill,
      });
  }
  const player = entity(
    "player",
    "Local demo account",
    "ORGANIZATION",
    1000000,
  );
  player.owner = "demo.local";
  w.entities.player = player;
  w.listings = Object.values(w.entities)
    .filter((e) => e.type === "PERSON" && e.owner === "genesis.testnet")
    .slice(0, 8)
    .map((e, i) => ({
      id: `genesis-listing-${i}`,
      entity: e.id,
      seller: e.owner,
      ask: Math.floor(110 + rng() * 90) * 1000,
      status: "ACTIVE",
      cycle: 0,
    }));
  w.supply = Object.values(w.entities).reduce((n, e) => n + e.cash, 0);
  for (const e of Object.values(w.entities))
    for (const [g, q] of Object.entries(e.inventory))
      w.genesisInventory[g] = (w.genesisInventory[g] || 0) + q;
  for (const e of Object.values(w.entities)) e.genesisCapital = nav(w, e);
  emit(
    w,
    "GENESIS",
    null,
    "A city begins its economic life",
    `${population} people and 12 businesses enter a finite, interconnected economy.`,
    { seed, population },
  );
  updateMetrics(w);
  assertInvariants(w);
  return w;
}
function relationship(w, a, b, amount) {
  let r = w.relationships.find((r) => r.from === a && r.to === b);
  if (!r) {
    r = { from: a, to: b, interactions: 0, volume: 0, trust: 50, failures: 0 };
    w.relationships.push(r);
  }
  r.interactions++;
  r.volume += amount;
  r.lastCycle = w.cycle;
  r.trust = Math.min(100, 50 + Math.floor(r.interactions / 3));
}
export function validate(w, id, a) {
  const e = w.entities[id];
  if (!e || !a || typeof a.type !== "string")
    return "Unknown entity or malformed action";
  const capability = {
    BUY: "TRADE",
    PRODUCE: "PRODUCE",
    CREATE_BUSINESS: "CREATE_BUSINESS",
    HIRE: "HIRE",
    WORK: "WORK",
    CONSUME: "WORK",
    WAIT: "HOLD_FUNDS",
  }[a.type];
  if (!capability || !e.capabilities.includes(capability))
    return "Capability not permitted";
  if (e.status !== "ACTIVE" && a.type !== "WAIT") return "Entity inactive";
  if (a.type === "BUY") {
    if (
      !catalog.goods[a.good] ||
      !Number.isInteger(a.quantity) ||
      a.quantity <= 0 ||
      a.quantity > 100
    )
      return "Invalid goods or quantity";
    if (e.cash - a.quantity * w.prices[a.good] < e.policy.reserve)
      return "Insufficient funds after minimum reserve";
  }
  if (a.type === "CREATE_BUSINESS") {
    if (
      !catalog.recipes[a.industry] ||
      !Number.isSafeInteger(a.capital) ||
      a.capital < 75000
    )
      return "Invalid industry or insufficient startup capital";
    if (!e.policy.mayCreate) return "Owner policy prohibits business creation";
    if (e.cash - a.capital < e.policy.reserve)
      return "Insufficient capital after minimum reserve";
    if (
      e.skills[catalog.recipes[a.industry].skill] <
      catalog.recipes[a.industry].threshold
    )
      return "Insufficient founder skill";
    if (w.holdings.some((h) => h.owner === e.id))
      return "Already operating a business";
  }
  if (a.type === "PRODUCE") {
    const r = catalog.recipes[e.industry];
    if (
      !r ||
      !e.equipment.includes(r.equipment) ||
      e.skills[r.skill] < r.threshold
    )
      return "Missing equipment or skill";
  }
  if (a.type === "HIRE") {
    const p = w.entities[a.personId];
    if (
      !p?.capabilities.includes("WORK") ||
      w.jobs.some((j) => j.person === p.id)
    )
      return "Worker unavailable";
    if (e.cash < 18000) return "Cannot cover wage reserve";
  }
  return null;
}
export function execute(
  w,
  id,
  action,
  reason = "Validated autonomous action",
  facts = {},
) {
  const rejection = validate(w, id, action),
    decision = {
      id: `decision-${w.cycle}-${id}-${w.sequence + 1}`,
      cycle: w.cycle,
      entityId: id,
      action: structuredClone(action),
      reason,
      facts: structuredClone(facts),
      status: rejection ? "REJECTED" : "ACCEPTED",
      result: rejection || null,
    };
  if (rejection) {
    w.decisions.push(decision);
    return decision;
  }
  const e = w.entities[id];
  const key = `cycle-${w.cycle}-${id}-${w.sequence + 1}`;
  if (action.type === "BUY") {
    let remaining = action.quantity,
      bought = 0;
    const sellers = Object.values(w.entities)
      .filter(
        (s) =>
          s.id !== id &&
          (s.inventory[action.good] || 0) > 0 &&
          s.capabilities.includes("PRODUCE") &&
          catalog.recipes[s.industry]?.outputs[action.good],
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const s of sellers) {
      const q = Math.min(remaining, s.inventory[action.good]);
      if (!q) continue;
      const cost = q * w.prices[action.good];
      transfer(w, id, s.id, cost, `Purchase ${action.good}`, `${key}-${s.id}`);
      e.inventory[action.good] = (e.inventory[action.good] || 0) + q;
      s.inventory[action.good] -= q;
      remaining -= q;
      bought += q;
      relationship(w, id, s.id, cost);
      e.interactions++;
      s.interactions++;
      if (!remaining) break;
    }
    decision.result = bought
      ? `Purchased ${bought} ${action.good}`
      : "No stock available";
    if (bought)
      emit(
        w,
        "GOODS_PURCHASED",
        id,
        `${e.name} buys ${bought} ${action.good.toLowerCase()}`,
        `${((bought * w.prices[action.good]) / 1000).toFixed(2)} units paid to actual suppliers.`,
        { good: action.good, quantity: bought },
      );
    else decision.status = "REJECTED";
  } else if (action.type === "PRODUCE") {
    const r = catalog.recipes[e.industry],
      staff = w.jobs.filter((j) => j.business === id).length;
    let batches = Math.min(r.capacity, 1 + staff);
    for (const [g, q] of Object.entries(r.inputs))
      batches = Math.min(batches, Math.floor((e.inventory[g] || 0) / q));
    for (const [g] of Object.entries(r.outputs)) {
      const target = 100;
      if ((e.inventory[g] || 0) >= target) batches = 0;
    }
    const effect = w.worldEvents
      .filter(
        (x) =>
          x.start <= w.cycle && x.end > w.cycle && x.type !== "DEMAND_SURGE",
      )
      .reduce(
        (n, x) =>
          Object.keys(r.outputs).includes(catalog.events[x.type].good)
            ? n * catalog.events[x.type].factor
            : n,
        1,
      );
    if (batches > 0) {
      for (const [g, q] of Object.entries(r.inputs)) {
        e.inventory[g] -= q * batches;
        w.consumed[g] = (w.consumed[g] || 0) + q * batches;
      }
      for (const [g, q] of Object.entries(r.outputs)) {
        const output = Math.max(1, Math.floor(q * batches * effect));
        e.inventory[g] = (e.inventory[g] || 0) + output;
        w.produced[g] = (w.produced[g] || 0) + output;
      }
      emit(
        w,
        "PRODUCTION_COMPLETED",
        id,
        `${e.name} completes production`,
        `${batches} batches; constrained by inventory, equipment and labor.`,
        { batches, industry: e.industry, effect },
      );
      decision.result = `Produced ${batches} batches`;
    } else {
      decision.result = "Capacity, inventory or market stock limit reached";
      decision.status = "REJECTED";
    }
  } else if (action.type === "CREATE_BUSINESS") {
    const businessId = `business_${Object.values(w.entities).filter((x) => x.type === "BUSINESS").length + 1}`,
      r = catalog.recipes[action.industry];
    const b = entity(
      businessId,
      `${e.name.split(" ")[0]}’s ${action.industry === "FOOD" ? "Sunrise Bakery" : action.industry === "FARMING" ? "Greenfield Venture" : action.industry === "TRANSPORT" ? "City Logistics" : "Market Mill"}`,
      "BUSINESS",
      0,
    );
    Object.assign(b, {
      owner: e.id,
      industry: action.industry,
      district: e.district,
      capabilities: [...b.capabilities, "HIRE", "PRODUCE"],
      equipment: [r.equipment],
      createdCycle: w.cycle,
      genesisCapital: action.capital,
      skills: { ...e.skills },
      goal: `Build a resilient ${action.industry.toLowerCase()} business.`,
    });
    b.policy.reserve = 4000;
    w.entities[businessId] = b;
    transfer(
      w,
      id,
      businessId,
      action.capital - 10000,
      "Business capitalization",
      `${key}-capital`,
    );
    transfer(
      w,
      id,
      "treasury",
      10000,
      "Equipment and registration",
      `${key}-registration`,
    );
    addHolding(w, id, businessId, 10000);
    emit(
      w,
      "BUSINESS_CREATED",
      id,
      `${e.name} founds ${b.name}`,
      `${action.capital / 1000} units committed, including a 10-unit equipment and registration charge.`,
      { businessId, capital: action.capital },
    );
    decision.result = businessId;
  } else if (action.type === "HIRE") {
    w.jobs.push({
      id: `job-${key}`,
      person: action.personId,
      business: id,
      wage: 1500,
      started: w.cycle,
      skill: catalog.recipes[e.industry].skill,
    });
    relationship(w, id, action.personId, 0);
    emit(
      w,
      "ENTITY_HIRED",
      id,
      `${e.name} hires ${w.entities[action.personId].name}`,
      "A new employment contract pays 1.5 units per completed work shift.",
      { personId: action.personId },
    );
  } else if (action.type === "WORK") {
    const job = w.jobs.find((j) => j.person === id),
      payer = job ? w.entities[job.business] : w.entities.treasury,
      amount = job ? job.wage : 900;
    if (payer.cash >= amount + (job ? payer.policy.reserve : 0)) {
      transfer(
        w,
        payer.id,
        id,
        amount,
        job ? "Wages" : "Public infrastructure shift",
        `${key}-wage`,
      );
      e.reputation = Math.min(100, e.reputation + 0.01);
      if (job) e.skills[job.skill] = Math.min(100, e.skills[job.skill] + 0.02);
      decision.result = `Earned ${amount / 1000}`;
    } else if (job) {
      w.jobs = w.jobs.filter((j) => j !== job);
      emit(
        w,
        "ENTITY_FIRED",
        id,
        `${e.name} leaves an unpaid role`,
        "The employer cannot cover wages without breaching reserves.",
        { businessId: payer.id },
      );
      decision.result = "Employment terminated: insufficient wage funds";
    }
  } else if (action.type === "CONSUME") {
    if ((e.inventory.BREAD || 0) > 0) {
      e.inventory.BREAD--;
      w.consumed.BREAD = (w.consumed.BREAD || 0) + 1;
      decision.result = "Consumed one bread";
    }
  }
  if (!decision.result) decision.result = "Completed";
  w.decisions.push(decision);
  return decision;
}
export function triggerEvent(w, type) {
  if (!catalog.events[type]) throw new Error("Unknown event");
  const event = {
    id: `constraint-${w.sequence + 1}`,
    type,
    start: w.cycle,
    end: w.cycle + catalog.events[type].duration,
  };
  w.worldEvents.push(event);
  emit(
    w,
    "WORLD_EVENT_STARTED",
    null,
    type.replaceAll("_", " "),
    `A temporary constraint changes ${catalog.events[type].good.toLowerCase()} conditions until cycle ${event.end}.`,
    event,
  );
  return event;
}
export function tick(w, provider = new RuleBasedAgentProvider()) {
  if (w.paused) return w;
  w.cycle++;
  for (const event of w.worldEvents)
    if (event.end === w.cycle)
      emit(
        w,
        "WORLD_EVENT_ENDED",
        null,
        `${event.type.replaceAll("_", " ")} ends`,
        "Normal production constraints resume.",
        event,
      );
  if (w.cycle % 60 === 0) {
    const rng = random(`${w.seed}-${w.cycle}`),
      types = Object.keys(catalog.events);
    triggerEvent(w, types[Math.floor(rng() * types.length)]);
  }
  for (const e of Object.values(w.entities))
    if (e.capabilities.includes("WORK") || e.capabilities.includes("PRODUCE")) {
      if (e.capabilities.includes("PRODUCE") && w.cycle % 10 === 0) {
        const fee = Math.min(250, e.cash);
        if (fee)
          transfer(
            w,
            e.id,
            "treasury",
            fee,
            "Infrastructure maintenance",
            `maintenance-${w.cycle}-${e.id}`,
          );
      }
      let proposal;
      try {
        proposal = provider.decide(
          provider instanceof RuleBasedAgentProvider
            ? { entity: e, world: w }
            : {
                entity: structuredClone(e),
                world: structuredClone({
                  cycle: w.cycle,
                  prices: w.prices,
                  jobs: w.jobs,
                  entities: w.entities,
                  holdings: w.holdings,
                }),
              },
        );
        if (proposal?.then) {
          Promise.resolve(proposal).catch(() => {});
          throw new Error("Async provider requires scheduled orchestration");
        }
        if (
          !proposal ||
          !proposal.action ||
          typeof proposal.reason !== "string"
        )
          throw new Error("Malformed agent proposal");
      } catch (error) {
        emit(
          w,
          "PROVIDER_FAILURE",
          e.id,
          "Agent fallback activated",
          String(error.message),
        );
        proposal = new RuleBasedAgentProvider().decide({ entity: e, world: w });
      }
      const facts = {
        cycle: w.cycle,
        cash: e.cash,
        reserve: e.policy.reserve,
        risk: e.policy.risk,
        prices: { ...w.prices },
        goal: e.goal,
        provider: provider.name || "external",
      };
      if (
        proposal.action.type === "CREATE_BUSINESS" &&
        catalog.recipes[proposal.action.industry]
      ) {
        const recipe = catalog.recipes[proposal.action.industry];
        facts.industry = proposal.action.industry;
        facts.expectedBatchMargin =
          Object.entries(recipe.outputs).reduce(
            (n, [g, q]) => n + q * w.prices[g],
            0,
          ) -
          Object.entries(recipe.inputs).reduce(
            (n, [g, q]) => n + q * w.prices[g],
            0,
          ) -
          1500;
        facts.startupCapital = proposal.action.capital;
      }
      execute(w, e.id, proposal.action, proposal.reason, facts);
    }
  for (const [g, base] of Object.entries(catalog.goods)) {
    const stock = Object.values(w.entities)
      .filter((e) => e.type === "BUSINESS")
      .reduce((n, e) => n + (e.inventory[g] || 0), 0);
    const target =
      g === "BREAD"
        ? Object.values(w.entities).filter((e) => e.type === "PERSON").length *
          2
        : 150;
    const shortage = (target - stock) / target;
    const demand =
      w.worldEvents.some((x) => x.type === "DEMAND_SURGE" && x.end > w.cycle) &&
      g === "BREAD"
        ? 1.15
        : 1;
    w.prices[g] = Math.max(
      Math.floor(base.price * 0.5),
      Math.min(
        base.price * 3,
        Math.round(
          (w.prices[g] * 0.97 + base.price * (1 + shortage * 0.5) * 0.03) *
            demand,
        ),
      ),
    );
  }
  w.priceHistory.push({ cycle: w.cycle, ...w.prices });
  w.priceHistory = w.priceHistory.slice(-120);
  updateMetrics(w);
  w.events = w.events.slice(-1500);
  w.decisions = w.decisions.slice(-3000);
  w.ledger = w.ledger.slice(-6000);
  assertInvariants(w);
  return w;
}
export function metrics(w) {
  const people = Object.values(w.entities).filter((e) => e.type === "PERSON"),
    businesses = Object.values(w.entities).filter((e) => e.type === "BUSINESS");
  const recent = w.ledger.filter((l) => l.cycle > w.cycle - 12);
  return {
    population: people.length,
    businesses: businesses.length,
    employment: people.length ? w.jobs.length / people.length : 0,
    circulating: w.supply - w.entities.treasury.cash,
    treasury: w.entities.treasury.cash,
    totalSupply: w.supply,
    volume: recent
      .filter((l) => l.reason.startsWith("Purchase"))
      .reduce((n, l) => n + l.amount, 0),
    production: Object.values(w.produced).reduce((n, q) => n + q, 0),
    sponsorship: people.reduce((n, e) => n + e.sponsorship, 0),
    averageWealth: people.reduce((n, e) => n + nav(w, e), 0) / people.length,
    velocity: recent.reduce((n, l) => n + l.amount, 0) / w.supply,
  };
}
function updateMetrics(w) {
  w.metricsHistory.push({ cycle: w.cycle, ...metrics(w) });
  w.metricsHistory = w.metricsHistory.slice(-120);
}
export function sponsorSandbox(w, id, amount, key) {
  if (w.mode !== "sandbox")
    throw new Error("Testnet sponsorship requires a finalized chain receipt");
  money(amount);
  if (amount < 1000 || amount > 500000)
    throw new Error("Choose 1–500 simulation units");
  if (typeof key !== "string" || key.length < 8 || key.length > 128)
    throw new Error("Idempotency key required");
  if (w.receipts.includes(key)) return;
  const e = w.entities[id];
  if (!e || e.owner !== "demo.local")
    throw new Error("Only the local demo owner can sponsor this entity");
  transfer(w, "player", id, amount, "Sandbox sponsorship", `sponsor-${key}`);
  e.sponsorship += amount;
  w.receipts.push(key);
  w.sponsorships.push({
    id: key,
    entity: id,
    amount,
    cycle: w.cycle,
    sender: "demo.local",
    hash: null,
  });
  emit(
    w,
    "ENTITY_FUNDED",
    id,
    `${e.name} receives sponsor capital`,
    `${amount / 1000} simulation units received. The agent will reevaluate on its next decision.`,
    { amount, key },
  );
  assertInvariants(w);
}
export function view(w) {
  return {
    ...w,
    receipts: undefined,
    ledger: w.ledger.slice(-250),
    events: w.events.slice(-100),
    decisions: w.decisions.slice(-500),
    metrics: metrics(w),
    entities: Object.values(w.entities).map((e) => ({
      ...e,
      netWorth: nav(w, e),
      generatedWealth: nav(w, e) - e.genesisCapital - e.sponsorship,
      capitalEfficiency: e.sponsorship
        ? (nav(w, e) - e.genesisCapital - e.sponsorship) / e.sponsorship
        : null,
      sponsorDependence: e.sponsorship / Math.max(1, e.sponsorship + e.revenue),
    })),
    chronicle: w.events
      .filter((e) =>
        [
          "GENESIS",
          "BUSINESS_CREATED",
          "ENTITY_HIRED",
          "WORLD_EVENT_STARTED",
          "WORLD_EVENT_ENDED",
          "ENTITY_FUNDED",
          "NFT_SOLD",
        ].includes(e.type),
      )
      .slice(-60)
      .reverse(),
  };
}
