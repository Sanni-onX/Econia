import test from "node:test";
import assert from "node:assert/strict";
import {
  cityStories,
  routineSummary,
  mergeRecords,
} from "../apps/web/src/city-model.mjs";
test("city stories suppress settlements and preserve recorded milestones", () => {
  const w = {
    events: [{ id: "tx", type: "CHAIN_SETTLED", cycle: 40 }],
    chronicle: [],
  };
  const founded = {
    id: "founded",
    type: "BUSINESS_CREATED",
    cycle: 6,
    title: "Mira founds a bakery",
  };
  assert.deepEqual(cityStories(w, [founded]), [founded]);
});
test("routine choices group without burying major decisions", () => {
  const records = [
    { id: "a", cycle: 4, action: { type: "WORK" } },
    { id: "b", cycle: 3, action: { type: "WORK" } },
    { id: "c", cycle: 2, action: { type: "CREATE_BUSINESS" } },
  ];
  assert.equal(routineSummary(records)[0].count, 2);
  assert.equal(routineSummary(records)[0].latest.id, "a");
  assert.equal(mergeRecords(records, records).length, 3);
});
