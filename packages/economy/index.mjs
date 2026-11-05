import { readFileSync } from "node:fs";
export const catalog = JSON.parse(
  readFileSync(new URL("../config/catalog.json", import.meta.url)),
);
export const money = (value) => {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Amount must be a nonnegative safe integer");
  return value;
};
export function transfer(world, from, to, amount, reason, key) {
  money(amount);
  if (!amount) return;
  if (world.ledger.some((x) => x.id === key)) return;
  const a = world.entities[from],
    b = world.entities[to];
  if (!a || !b || a.cash < amount || from === to)
    throw new Error("Invalid or insufficient transfer");
  money(b.cash + amount);
  a.cash -= amount;
  b.cash += amount;
  const capital = /sponsorship|capitalization/i.test(reason);
  if (!capital) {
    a.expenses += amount;
    b.revenue += amount;
  }
  world.ledger.push({
    id: key,
    cycle: world.cycle,
    debit: from,
    credit: to,
    amount,
    asset: world.mode === "sandbox" ? "SIM" : "ECO",
    reason,
  });
}
export function nav(world, e, visited = new Set()) {
  if (visited.has(e.id)) throw new Error("Circular ownership");
  const seen = new Set([...visited, e.id]);
  const inventory = Object.entries(e.inventory).reduce(
    (n, [g, q]) => n + q * world.prices[g],
    0,
  );
  const equity = world.holdings
    .filter((h) => h.owner === e.id)
    .reduce(
      (n, h) =>
        n +
        Math.floor(
          (nav(world, world.entities[h.entity], seen) * h.bps) / 10000,
        ),
      0,
    );
  return (
    e.cash + inventory + equity + (e.equipment?.length || 0) * 10000 - e.debt
  );
}
export function addHolding(world, owner, entity, bps) {
  if (
    !world.entities[owner] ||
    !world.entities[entity] ||
    owner === entity ||
    !Number.isInteger(bps) ||
    bps <= 0 ||
    bps > 10000
  )
    throw new Error("Invalid stake");
  if (
    world.holdings
      .filter((h) => h.entity === entity)
      .reduce((n, h) => n + h.bps, 0) +
      bps >
    10000
  )
    throw new Error("Ownership exceeds 100%");
  const reaches = (id, target, seen = new Set()) =>
    id === target ||
    (!seen.has(id) &&
      (seen.add(id),
      world.holdings
        .filter((h) => h.owner === id)
        .some((h) => reaches(h.entity, target, seen))));
  if (reaches(entity, owner)) throw new Error("Circular ownership");
  world.holdings.push({ owner, entity, bps });
}
export function assertInvariants(w) {
  let total = 0;
  for (const e of Object.values(w.entities)) {
    money(e.cash);
    total += e.cash;
    for (const q of Object.values(e.inventory))
      if (!Number.isSafeInteger(q) || q < 0)
        throw new Error("Invalid inventory");
  }
  if (total !== w.supply)
    throw new Error(`Currency conservation: ${total} != ${w.supply}`);
  for (const id of new Set(w.holdings.map((h) => h.entity)))
    if (
      w.holdings.filter((h) => h.entity === id).reduce((n, h) => n + h.bps, 0) >
      10000
    )
      throw new Error("Invalid ownership");
  if (new Set(w.jobs.map((j) => j.person)).size !== w.jobs.length)
    throw new Error("Duplicate employment");
  return { total, balanced: true, entities: Object.keys(w.entities).length };
}
