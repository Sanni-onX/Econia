import { writeFileSync, mkdirSync } from "node:fs";
import {
  genesis,
  tick,
  assertInvariants,
  view,
} from "../packages/simulation-core/index.mjs";
const cycles = Number(process.argv[2] || 10000),
  w = genesis("econia-soak-v1"),
  start = performance.now();
for (let i = 0; i < cycles; i++) tick(w);
const result = {
  cycles,
  seconds: +((performance.now() - start) / 1000).toFixed(2),
  invariants: assertInvariants(w),
  metrics: view(w).metrics,
};
mkdirSync(".data", { recursive: true });
writeFileSync(".data/soak-report.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
