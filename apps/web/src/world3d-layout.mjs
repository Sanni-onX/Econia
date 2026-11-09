export const worldDistricts = [
  {
    id: "Greenfield",
    x: -23,
    z: -12,
    label: "GREENFIELD",
    subtitle: "FIELDS & ORCHARDS",
    color: "#5C8954",
  },
  {
    id: "Commons",
    x: -14,
    z: 12,
    label: "THE COMMONS",
    subtitle: "A NEIGHBORHOOD TAKES SHAPE",
    color: "#C86748",
  },
  {
    id: "Market quarter",
    x: 17,
    z: -10,
    label: "MARKET QUARTER",
    subtitle: "IDEAS MEET OPPORTUNITY",
    color: "#C89E45",
  },
  {
    id: "Harbor",
    x: 24,
    z: 14,
    label: "HARBOR",
    subtitle: "THE CITY’S CONNECTION",
    color: "#438FC4",
  },
];

const plots = {
  Greenfield: [
    [-28, -14],
    [-20, -14],
    [-28, -5],
    [-20, -5],
    [-28, -22],
    [-20, -22],
  ],
  Commons: [
    [-25, 7],
    [-16, 7],
    [-7, 7],
    [-16, 17],
    [-7, 17],
    [-25, 17],
  ],
  "Market quarter": [
    [15, -15],
    [24, -15],
    [15, -6],
    [24, -6],
    [15, -23],
    [24, -23],
  ],
  Harbor: [
    [18, 7],
    [27, 7],
    [18, 17],
    [27, 17],
    [18, -1],
    [27, -1],
  ],
};

export function worldPositions(w) {
  const positions = new Map(),
    counts = {};
  for (const e of w.entities.filter((e) => e.type === "BUSINESS")) {
    const district = plots[e.district] ? e.district : "Commons";
    const n = counts[district] || 0;
    counts[district] = n + 1;
    const p = plots[district][n % plots[district].length];
    positions.set(e.id, {
      x: p[0] + Math.floor(n / plots[district].length) * 0.7,
      z: p[1],
      district,
    });
  }
  const people = w.entities.filter((e) => e.type === "PERSON");
  for (const [i, e] of people.entries()) {
    // Business owners are located at their own premises; employed residents at their recorded job.
    const owned = w.holdings.find((h) => h.owner === e.id && h.bps >= 5000);
    const job = w.jobs.find((j) => j.person === e.id);
    const at = positions.get(owned?.entity) || positions.get(job?.business);
    const d =
      worldDistricts.find((d) => d.id === e.district) || worldDistricts[1];
    positions.set(
      e.id,
      at
        ? {
            x: at.x + 2.4 + (i % 3) * 0.6,
            z: at.z + 2.4 + (i % 2) * 0.7,
            district: at.district,
          }
        : {
            x: d.x - 3 + (i % 5) * 1.2,
            z: d.z + 3 + (Math.floor(i / 5) % 3),
            district: d.id,
          },
    );
  }
  return positions;
}

export function recordedDeliveries(w, positions) {
  return w.ledger
    .filter(
      (t) =>
        t.cycle === w.cycle &&
        t.reason.startsWith("Purchase") &&
        positions.has(t.debit) &&
        positions.has(t.credit),
    )
    .slice(-8);
}
