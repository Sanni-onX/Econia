# Econia — current build and walkthrough

**Product review: 9 November 2026.** This describes the working build, including its limits, so you can decide what to keep or change.

**Product direction clarified:** The intended experience is a post-mint economy of useful, AI-operated agents. This walkthrough describes the existing implementation, which has not reached that goal. See [the updated product direction](PRODUCT-DIRECTION.md) for the mint lifecycle, NEAR AI integration and service-driven economy.

## 1. What Econia currently is

Econia is an explorable 3D city backed by a persistent economic simulation. People and businesses hold money, have needs and constraints, make recorded choices, trade finite goods and build histories. Players can observe and follow them; connected owners can provide capital and set strategy boundaries, and the exchange supports acquiring an existing Living Asset.

The current experience centers on **observe → understand → follow → own/back → observe the outcome**. It is an engineering preview, rather than a complete city-building game. Players do not yet construct streets, directly run shops or freely command each resident.

The running local testnet checkpoint contains **64 people and 13 businesses**, including Mira’s Sunrise Bakery. Its latest confirmed cycle is **161**. **Settlement is currently delayed by the existing operator gas allowance**, so the city remains explorable but the next economic cycle cannot finish. A connected event stream does not mean the economy is advancing. This operational issue is separate from wallet connection.

## 2. Build outline

| Area        | What is built                                                                                                                                                                                        | What you can assess                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| World       | A real 3D coastal town with four districts, imported buildings/trees/vehicles, custom economic premises, bridges, docks, light and shadows. Orbit, zoom, pan, locate, layers and an accessible list. | Does exploring a place feel like the main experience? Is the town detailed and readable enough?  |
| People      | Persistent identity, portrait, role, ambition, skills, current work, business stakes and economic history.                                                                                           | Do you care about an individual and understand their situation?                                  |
| Businesses  | Farms, mills, bakeries and logistics premises with workers, owners, stock and recorded suppliers/customers.                                                                                          | Can you understand how each livelihood depends on other people and places?                       |
| Decisions   | Recorded actions, reasons and facts captured before execution. Major choices are separated from grouped everyday routines.                                                                           | Can you see why an entity acted without mistaking hindsight for its original reasoning?          |
| Discover    | People, businesses, district browsing and economic achievements.                                                                                                                                     | Can you find an interesting life or place without knowing its name first?                        |
| Chronicle   | Actual milestones and world constraints, with source evidence and links back to affected people/places.                                                                                              | Does it tell a useful story rather than look like a transaction log?                             |
| Exchange    | Separate Living Asset listings and goods/price views. Ask, treasury and estimated economic value are distinct.                                                                                       | Is buying ownership understandable, and are risks and price/value differences clear?             |
| My Econia   | Following, owned entities and sponsorship records; updates for followed stories when available.                                                                                                      | Does returning to the city feel personal?                                                        |
| Wallets     | Nightly, MyNearWallet, Sender, OKX Wallet and Intear through the official NEAR Wallet Selector adapters. Restoration, account changes, switching and disconnecting.                                  | Does your preferred wallet connect and remain connected after reload?                            |
| Persistence | A durable journal and saved checkpoints; local SQLite and a PostgreSQL deployment path.                                                                                                              | The world survives a server restart; it is not recreated on each page visit.                     |
| NEAR        | Deployed test ECO and Living Entity NFT/world contracts, sponsorship, marketplace purchases/offers, withdrawal credit and batched treasury settlement.                                               | Real testnet receipts exist; the app distinguishes this from its separate local simulation mode. |

## 3. How it works

Every economic cycle follows a controlled sequence:

1. A person or business evaluates its current needs, money, inventory, skills, job and owner policy.
2. Its controller proposes an action and records the reason and inputs.
3. The engine checks whether the action is permitted and affordable. It rejects invalid actions before changing money or stock.
4. Valid work, purchases, consumption, hiring, founding or production change the ledger and inventory. Money always has a source and destination.
5. The server saves the result and publishes it to the interface. In testnet mode, prepared treasury movements must settle on NEAR before the candidate cycle becomes the confirmed world.
6. Profiles, business connections, goods charts and the Chronicle reflect those records.

The previously running checkpoint was generated by **deterministic rules**. An asynchronous NEAR AI provider, planning scheduler and persistent outcome memory are now implemented. Live inference awaits account credentials/credits and is not yet verified; the existing settlement delay also remains. In AI mode, missing configuration pauses decisions and inference failures produce explicit waits, rather than silently substituting rule-generated actions. See [NEAR AI setup](NEAR-AI-SETUP.md). Free-form agent conversation is not enabled.

The basic supply chain is **energy/transport capacity → grain → flour → bread → people**, with wages and purchases moving money between actual counterparties. Production uses finite inputs and capacity. Prices respond to stock levels; the goods market is an inventory-sensitive quote system, not a bid/ask order book.

### What lives where

| On NEAR testnet                                                                                                                                                          | Controlled by the application/server                                                                                                                                              | Saved on your device                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ECO token balances and contract custody; Living Entity NFT ownership; sponsorship receipts; asset sales/offers and withdrawal credit; batched entity treasury movements. | Agent decisions, skills, jobs, recipes, business-stake graph, inventories, world constraints, visual placement and journals. The world operator validates and submits settlement. | Followed entities and last-seen cycle. Wallet Selector keeps its connection state and the wallet handles signing. |

This is an **operator-controlled economy with onchain ownership and custody**, not a fully trustless onchain simulation. The app does not receive your wallet’s recovery phrase. Some wallet adapters may create their own revocable connection credentials according to their provider flow; those remain under the wallet integration, not the agent controllers.

## 4. A walkthrough you can do now

### A. Explore without a wallet

1. Open [the local preview](http://127.0.0.1:3003/). Check the connection and settlement/clock label first. The current delayed state is historical confirmed data, not a live advancing economy.
2. Drag the city to orbit, scroll to zoom and right-drag to pan. On mobile use one finger to orbit and two fingers to pan/pinch. Use a district label or the accessible list to explore.
3. Choose **Meet Mira**. Her Life tab shows her food-artisan role, ambition, recent action and connections.
4. Open **Mira’s Sunrise Bakery** from her profile. Inspect its actual worker, stock and trade relationships. Follow a supplier or employee link to see the wider network.
5. Return to Mira and inspect her **cycle 6 founding decision**. Its recorded inputs include capital, reserve, quoted margin and prices. The explanation is evidence for that decision, not a guarantee that the business will remain profitable.
6. Open **Sponsor**. Review the recipient, amount, treasury change and discretion. Close the preview without submitting a transaction.
7. Choose **Follow**, then **My Econia → Following**. Reload and verify Mira is still there. Following currently belongs to this browser/device, rather than a synced user account.
8. Open the **Chronicle**, revisit the bakery’s founding or a drought event, and inspect its evidence. Then compare **Exchange → Goods & prices** with **Exchange → Living Assets**.

### B. Connect Nightly or another wallet

1. Select **Connect wallet**. Choose **Nightly**, **MyNearWallet**, **Sender**, **OKX Wallet** or **Intear**.
2. In Nightly select the **NEAR** ecosystem and **Testnet**. Unlock and approve the connection inside the wallet. Other chains and mainnet balances are separate from this preview.
3. Reopen the wallet panel to see the provider and connected account. If the wallet exposes multiple accounts, use **Active account**. You can choose another provider or disconnect there.
4. Reload the app to check restoration. Connecting alone does not sponsor an entity, buy an NFT or guarantee that the account is funded on testnet.
5. The panel offers a finite **250 test ECO claim** if eligible. Its storage transaction needs wallet approval and may need test NEAR. Do not treat a connected account or a zero token balance as a completed claim.

Nightly’s connection was confirmed successfully by the user during this build. The other adapters are implemented and available according to their browser/device support; a full live signing matrix across all five wallets has not been completed.

### C. Understand participation before spending test assets

A player acquires an available Living Asset through the Exchange, then reviews its history and strategy before providing more capital. The NFT represents the persistent economic identity: an ownership change preserves the person’s skills, job, business holdings and recorded story.

**Current sponsorship is owner-only.** A visitor can preview Mira’s sponsorship, but cannot fund an entity they do not own through the current contract. Supporting anybody as a public patron requires a contract/product change. Sponsorship grants no ownership, is not refundable and promises no return. Buying the NFT and funding its treasury are separate operations.

The owner can set limited strategy boundaries such as risk, growth, minimum reserve and permission to found a business. The owner does not directly choose every work or purchase action. Signed strategy support depends on the wallet’s message-signing capabilities.

Because settlement is currently delayed, finish this review using exploration and previews. Participation that depends on world settlement needs the operator issue resolved first.

## 5. What is deliberately not built yet

- A mainnet release, real-money investment product, public hosted production service or external security audit.
- Free-form AI conversation, an active external LLM controller or fully onchain agent intelligence.
- Public sponsorship of arbitrary non-owned entities.
- Player road/building placement, first-person walking, real route-based shipping, a separate power-grid simulation or a full construction game. Vehicle/house scenery is not a claim that additional economic entities or trips exist.
- Autonomous loans, acquisitions, dividends, property rents or rich business negotiations. Having a capability/type name in the code does not implement those systems.
- Wallet-synced following, multiplayer social features, a general chain-event indexer, and proven large-population scaling.
- Complete signing/rejection/mobile-redirect testing for every supported wallet.

## 6. Product choices worth making next

| Choice                                                                                                  | Why it changes the product                                                                                                                      |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Is the player primarily an observer/patron, an owner setting boundaries, or a direct business operator? | The current build emphasizes observation and ownership with bounded influence. Direct operation would change the core loop.                     |
| Should anybody be able to sponsor anybody?                                                              | Today funding is owner-only. Public patronage changes contract permissions and the meaning of sponsorship.                                      |
| How much intelligence should come from rules versus language models?                                    | Rules are reproducible and auditable. LLM agents need additional queueing, budgets, validation and evaluation before they run the economy.      |
| Should the city become a navigable game world or remain an explorable economic diorama?                 | Walking, construction, pathfinding and interiors are substantial gameplay systems beyond the current 3D presentation.                           |
| What should make a player return tomorrow?                                                              | Local follows and recorded milestones are present; stronger ambitions, consequences, alerts and long-running story arcs would deepen retention. |

## 7. Technical handover and validation

React/Vite and Three.js render the client; the Node API streams confirmed snapshots. A deterministic simulation/ledger, durable database and NEAR adapter sit behind it. Rust contracts implement ECO and the Living Entity/world boundary. The GitHub repository is public; private recovery/runtime files are excluded.

The wallet update adds official adapters, Selector-driven session/account synchronization, browser Buffer support for NEAR serialization and correct 32-byte message-signing nonces. Tests cover selecting an already exposed extension account through Selector sign-in, cancellation/redirect behavior, active-account selection and nonce validation. Browser checks verify the five-option picker at desktop and mobile widths, the user-approved Nightly connection and restoration after a page refresh. No purchase or sponsorship was submitted during wallet verification.

Further implementation detail: [architecture](ARCHITECTURE.md), [economy](ECONOMY.md), [agent controllers](AGENTS.md), [contracts](CONTRACTS.md), [3D world](world3d.md), and [deployment](DEPLOYMENT.md).
