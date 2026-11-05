import test from "node:test";
import assert from "node:assert/strict";
import {
  genesis,
  tick,
  execute,
  validate,
  triggerEvent,
  sponsorSandbox,
  assertInvariants,
  nav,
  catalog,
  view,
} from "../packages/simulation-core/index.mjs";
import { transfer, addHolding } from "../packages/economy/index.mjs";
import {
  buySandbox,
  listSandbox,
  offerSandbox,
} from "../packages/economy/marketplace.mjs";
import { HybridAgentProvider } from "../packages/agent-sdk/index.mjs";
test("untrusted providers cannot invent recorded economic inputs", () => {
  const w = genesis(),
    before = w.entities.person_199.cash;
  tick(w, {
    name: "untrusted",
    decide() {
      return {
        action: { type: "WAIT" },
        reason: "Wait for an opportunity.",
        facts: { cash: 999999999, prices: { BREAD: 1 } },
      };
    },
  });
  const d = w.decisions.find((d) => d.entityId === "person_199");
  assert.equal(d.facts.cash, before);
  assert.notEqual(d.facts.prices.BREAD, 1);
  assert.equal(w.entities.person_199.cash, before);
});
test("genesis and 100-cycle replay are deterministic", () => {
  const a = genesis("repeat"),
    b = genesis("repeat");
  for (let i = 0; i < 100; i++) {
    tick(a);
    tick(b);
  }
  assert.deepEqual(a, b);
  assert.equal(view(a).metrics.population, 64);
});
test("currency is conserved and goods reconcile through 1000 cycles", () => {
  const w = genesis("soak");
  for (let i = 0; i < 1000; i++) tick(w);
  assertInvariants(w);
  for (const g of Object.keys(catalog.goods)) {
    const stock = Object.values(w.entities).reduce(
      (n, e) => n + (e.inventory[g] || 0),
      0,
    );
    assert.equal(
      stock,
      (w.genesisInventory[g] || 0) +
        (w.produced[g] || 0) -
        (w.consumed[g] || 0),
    );
  }
  assert.ok(w.ledger.some((l) => l.reason.startsWith("Purchase")));
  assert.ok(w.jobs.length > 0);
});
test("ledger transfer equal debits/credits, rejects overdraft and duplicate key", () => {
  const w = genesis(),
    before = w.entities.person_199.cash;
  transfer(w, "player", "person_199", 1000, "test", "same");
  transfer(w, "player", "person_199", 1000, "test", "same");
  assert.equal(w.entities.person_199.cash, before + 1000);
  assert.equal(w.ledger.filter((l) => l.id === "same").length, 1);
  assert.throws(() => transfer(w, "person_199", "player", 1e12, "bad", "bad"));
  assert.throws(() =>
    transfer(w, "player", "person_199", 1.1, "bad", "fraction"),
  );
  assertInvariants(w);
});
test("negative inventory purchases, missing capabilities and reserve breaches reject before mutation", () => {
  const w = genesis(),
    before = JSON.stringify(w.entities);
  assert.match(
    validate(w, "person_199", { type: "BUY", good: "BREAD", quantity: -2 }),
    /quantity/,
  );
  assert.equal(
    execute(w, "person_199", { type: "PRODUCE" }).status,
    "REJECTED",
  );
  assert.match(
    validate(w, "person_199", { type: "BUY", good: "BREAD", quantity: 100 }),
    /reserve/,
  );
  assert.equal(JSON.stringify(w.entities), before);
});
test("sponsorship is idempotent, treasury conserved, autonomous business needs real capital", () => {
  const w = genesis(),
    m = w.entities.person_199;
  assert.ok(!w.holdings.some((h) => h.owner === m.id));
  assert.equal(
    execute(w, m.id, {
      type: "CREATE_BUSINESS",
      industry: "FOOD",
      capital: 90000,
    }).status,
    "REJECTED",
  );
  sponsorSandbox(w, m.id, 100000, "fund-mira-1");
  sponsorSandbox(w, m.id, 100000, "fund-mira-1");
  assert.equal(m.sponsorship, 100000);
  tick(w);
  assert.ok(w.holdings.some((h) => h.owner === m.id));
  for (let i = 0; i < 20; i++) tick(w);
  const businessId = w.holdings.find((h) => h.owner === m.id).entity;
  assert.ok(w.jobs.some((j) => j.business === businessId));
  assert.ok(
    w.events.some((e) => e.type === "BUSINESS_CREATED" && e.entityId === m.id),
  );
  assertInvariants(w);
});
test("policy prevents business creation despite capital; significant decisions retain inputs", () => {
  const w = genesis();
  sponsorSandbox(w, "person_199", 100000, "policy-fund-1");
  w.entities.person_199.policy.mayCreate = false;
  tick(w);
  assert.ok(!w.holdings.some((h) => h.owner === "person_199"));
  const d = w.decisions.find((d) => d.entityId === "person_199");
  assert.equal(d.facts.cash, 124000);
  assert.ok(d.reason);
  assert.equal(d.facts.reserve, 12000);
});
test("ownership graph prevents cycles and excess stakes; NAV includes proportional businesses", () => {
  const w = genesis(),
    h = w.holdings[0];
  assert.throws(() => addHolding(w, h.entity, h.owner, 10000), /Circular/);
  assert.throws(() => addHolding(w, "person_199", h.entity, 1), /100%/);
  assert.ok(nav(w, w.entities[h.owner]) > w.entities[h.owner].cash);
});
test("production consumes configured finite inputs and drought only changes output constraints", () => {
  const a = genesis(),
    b = genesis();
  triggerEvent(b, "DROUGHT");
  const aFarm = a.entities.business_1,
    bFarm = b.entities.business_1;
  aFarm.inventory.GRAIN = 0;
  bFarm.inventory.GRAIN = 0;
  execute(a, aFarm.id, { type: "PRODUCE" });
  execute(b, bFarm.id, { type: "PRODUCE" });
  assert.equal(aFarm.inventory.ENERGY, bFarm.inventory.ENERGY);
  assert.ok(aFarm.inventory.GRAIN > bFarm.inventory.GRAIN);
  assert.equal(aFarm.cash, bFarm.cash);
});
test("NFT sale preserves identity, balances, skills and employment; cannot double purchase", () => {
  const w = genesis(),
    l = w.listings[0],
    before = structuredClone(w.entities[l.entity]);
  buySandbox(w, l.id, "purchase-1");
  assert.equal(w.entities[l.entity].owner, "demo.local");
  assert.deepEqual({ ...w.entities[l.entity], owner: before.owner }, before);
  buySandbox(w, l.id, "purchase-1");
  assert.throws(() => buySandbox(w, l.id, "purchase-2"));
  assertInvariants(w);
});
test("market offers follow seller reservation price; owner listings cannot be self-purchased", () => {
  const w = genesis(),
    l = w.listings[0];
  assert.equal(offerSandbox(w, l.id, 1000, "offer-low").status, "REJECTED");
  assert.equal(l.status, "ACTIVE");
  assert.equal(offerSandbox(w, l.id, l.ask, "offer-high").status, "ACCEPTED");
  const own = listSandbox(w, "person_199", 100000);
  assert.throws(() => buySandbox(w, own.id, "own-purchase"));
  assertInvariants(w);
});
test("provider failure falls back without giving provider mutable world access", async () => {
  const w = genesis(),
    provider = {
      decide(context) {
        context.entity.cash = 999;
        throw new Error("LLM unavailable");
      },
    };
  tick(w, provider);
  assert.notEqual(w.entities.person_199.cash, 999);
  assert.ok(w.events.some((e) => e.type === "PROVIDER_FAILURE"));
  assertInvariants(w);
  const hybrid = new HybridAgentProvider({
    decide() {
      throw new Error("offline");
    },
  });
  const result = await hybrid.decide({
    entity: w.entities.person_199,
    world: { ...w, cycle: 24 },
  });
  assert.ok(result.action.type);
});
