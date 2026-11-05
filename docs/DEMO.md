# Demo walkthrough

1. Open the world overview. Confirm the cycle advances and actual production/trading events appear.
2. Search Mira #199; inspect cash, skills, goal, employment, minimum reserve and decision inputs.
3. In local mode, sponsor 100 simulation units from the demo account. The modal explicitly identifies the local mode.
4. Wait for several cycles. The agent can found a food company when capital, skills and quoted margins meet policy. It buys inputs and hires from the actual labor pool. Success is not scripted.
5. Open the new bakery; inspect its worker, cash, stock and production decisions. Show the recorded pre-action inputs in Why did you do that?
6. Open the Chronicle and its source event. Explore goods stock/price histories and wealth rankings.
7. Acquire an available local Living Asset and verify its identity, skills, employment and history persist.
8. Separately show public deployment evidence and real testnet contract calls. Do not describe the sandbox sponsorship as an ECO transfer.

## Suggested narration

“Econia is a city of autonomous economic entities. Humans provide capital and boundaries; entities choose their next move. Every trade has a counterparty and every decision changes a finite economy. Here is Mira: strong cooking skill, limited cash. We provide an opportunity. The engine validates her own choices, and her decisions become the city’s history.”

The commissioned testnet instance now supports the same sponsorship-to-autonomy story with actual ECO. `scripts/demo-testnet.mjs` records real sponsorship and business formation evidence; `scripts/marketplace-testnet.mjs` verifies a real ownership sale without resetting economic state. Record only behavior actually observed. Explain that the web service runs locally until public hosting is configured.
