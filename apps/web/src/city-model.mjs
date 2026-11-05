export const districts = [
  {
    id: "Greenfield",
    label: "Greenfield",
    subtitle: "Where the city takes root",
    x: 320,
    y: 238,
    color: "#5C8954",
  },
  {
    id: "Commons",
    label: "The Commons",
    subtitle: "Bread, neighbors & new beginnings",
    x: 610,
    y: 565,
    color: "#C86748",
  },
  {
    id: "Market quarter",
    label: "Market Quarter",
    subtitle: "Ideas become livelihoods",
    x: 798,
    y: 282,
    color: "#D1A341",
  },
  {
    id: "Harbor",
    label: "Harbor",
    subtitle: "Keeping the city connected",
    x: 1090,
    y: 510,
    color: "#438FC4",
  },
];
export const importantActions = new Set([
  "CREATE_BUSINESS",
  "HIRE",
  "FIRE",
  "INVEST",
  "BORROW",
  "REPAY",
  "QUIT_JOB",
]);
const eventPriority = {
  BUSINESS_CREATED: 100,
  ENTITY_FUNDED: 90,
  WORLD_EVENT_STARTED: 85,
  ENTITY_HIRED: 80,
  NFT_SOLD: 75,
  WORLD_EVENT_ENDED: 65,
  GENESIS: 20,
};
export const money = (n) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(
    (n || 0) / 1000,
  );
export const unit = (w) =>
  w.mode === "testnet" ? "test ECO" : "simulation units";
export function mergeRecords(...collections) {
  return [
    ...new Map(
      collections
        .flat()
        .filter(Boolean)
        .map((x) => [x.id, x]),
    ).values(),
  ].sort((a, b) => b.cycle - a.cycle || (b.sequence || 0) - (a.sequence || 0));
}
export function cityStories(w, archive = []) {
  return mergeRecords(
    archive,
    w.chronicle || [],
    w.events.filter((e) => eventPriority[e.type]),
  )
    .filter((e) => eventPriority[e.type])
    .slice(0, 80);
}
export function cityMoments(w, archive = []) {
  return [...cityStories(w, archive)]
    .sort(
      (a, b) =>
        (eventPriority[b.type] || 0) +
          (b.cycle > w.cycle - 12 ? 30 : 0) -
          ((eventPriority[a.type] || 0) + (a.cycle > w.cycle - 12 ? 30 : 0)) ||
        b.cycle - a.cycle,
    )
    .slice(0, 3);
}
export function businessOf(w, id) {
  return w.holdings
    .filter((h) => h.owner === id)
    .map((h) => ({
      ...w.entities.find((e) => e.id === h.entity),
      stake: h.bps / 100,
    }))
    .filter((e) => e.id);
}
export function placement(w) {
  const places = new Map();
  const count = {};
  for (const e of w.entities.filter((e) => e.type === "BUSINESS")) {
    const district = districts.find((d) => d.id === e.district) || districts[1],
      n = count[district.id] || 0;
    count[district.id] = n + 1;
    const offsets = [
      [-92, 28],
      [14, -28],
      [104, 64],
      [-48, 108],
      [76, 154],
      [-140, -34],
      [150, -22],
      [-155, 120],
    ];
    const [dx, dy] = offsets[n % offsets.length];
    places.set(e.id, {
      x: district.x + dx,
      y: district.y + dy + Math.floor(n / 8) * 45,
      district: district.id,
    });
  }
  for (const [i, e] of w.entities
    .filter((e) => e.type === "PERSON")
    .entries()) {
    const job = w.jobs.find((j) => j.person === e.id),
      work = job && places.get(job.business),
      district = districts.find((d) => d.id === e.district) || districts[1];
    places.set(
      e.id,
      work
        ? {
            x: work.x + 46 + (i % 3) * 15,
            y: work.y + 44 + (i % 2) * 18,
            district: work.district,
          }
        : {
            x: district.x - 100 + ((i * 47) % 240),
            y: district.y + 95 + ((i * 23) % 95),
            district: district.id,
          },
    );
  }
  return places;
}
export function routineSummary(decisions) {
  const groups = new Map();
  for (const d of decisions.filter(
    (d) => !importantActions.has(d.action?.type),
  )) {
    const kind = d.action?.type || "WAIT";
    let g = groups.get(kind);
    if (!g) {
      g = { kind, count: 0, first: d.cycle, last: d.cycle, latest: d };
      groups.set(kind, g);
    }
    g.count++;
    g.first = Math.min(g.first, d.cycle);
    g.last = Math.max(g.last, d.cycle);
  }
  return [...groups.values()].sort((a, b) => b.last - a.last);
}
export function storyContext(story, w) {
  const entity = w.entities.find((e) => e.id === story.entityId),
    business =
      story.data?.businessId &&
      w.entities.find((e) => e.id === story.data.businessId);
  const constraint = w.worldEvents.find(
    (e) =>
      e.id === story.data?.id ||
      (e.type === story.data?.type && e.start === story.cycle),
  );
  const affected = constraint
    ? w.entities.filter(
        (e) =>
          e.type === "BUSINESS" &&
          (constraint.type === "DROUGHT" || constraint.type === "BUMPER_HARVEST"
            ? e.industry === "FARMING"
            : constraint.type === "DEMAND_SURGE"
              ? e.industry === "FOOD"
              : true),
      )
    : [];
  return {
    entity,
    business,
    constraint,
    affected,
    location:
      entity?.district ||
      (constraint?.type === "DROUGHT" || constraint?.type === "BUMPER_HARVEST"
        ? "Greenfield"
        : null),
  };
}
