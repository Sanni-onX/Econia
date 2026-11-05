import { transfer, money } from "./index.mjs";
import { emit } from "../simulation-core/index.mjs";
export function listSandbox(w, id, ask) {
  const e = w.entities[id];
  money(ask);
  if (
    w.mode !== "sandbox" ||
    !e ||
    e.owner !== "demo.local" ||
    ask < 1000 ||
    ask > 1000000
  )
    throw new Error("Invalid listing or owner");
  if (w.listings.some((l) => l.entity === id && l.status === "ACTIVE"))
    throw new Error("Already listed");
  const listing = {
    id: `listing-${++w.sequence}`,
    entity: id,
    seller: e.owner,
    ask,
    status: "ACTIVE",
    cycle: w.cycle,
  };
  w.listings.push(listing);
  emit(
    w,
    "NFT_LISTED",
    id,
    `${e.name} is listed on the local exchange`,
    `${ask / 1000} simulation units asking price. Identity and history persist.`,
  );
  return listing;
}
export function buySandbox(w, listingId, key) {
  if (w.mode !== "sandbox") throw new Error("Requires testnet settlement");
  if (w.receipts.includes(key)) return;
  const l = w.listings.find((l) => l.id === listingId && l.status === "ACTIVE");
  if (!l) throw new Error("Listing is no longer available");
  const e = w.entities[l.entity];
  if (e.owner !== l.seller || l.seller === "demo.local")
    throw new Error("Ownership changed or cannot buy own listing");
  transfer(
    w,
    "player",
    "treasury",
    l.ask,
    "Genesis asset distribution",
    `market-${key}`,
  );
  e.owner = "demo.local";
  l.status = "SOLD";
  w.receipts.push(key);
  emit(
    w,
    "NFT_SOLD",
    e.id,
    `${e.name} changes ownership`,
    `${l.ask / 1000} simulation units settled. Economic identity, businesses and history are preserved.`,
    { listingId: l.id, from: l.seller, to: "demo.local", hash: null },
  );
}
export function offerSandbox(w, listingId, amount, key) {
  money(amount);
  if (amount < 1000 || amount > 1000000)
    throw new Error("Invalid offer amount");
  if (w.receipts.includes(key)) return;
  const l = w.listings.find((l) => l.id === listingId && l.status === "ACTIVE");
  if (!l || l.seller === "demo.local") throw new Error("Invalid offer target");
  if (w.entities.player.cash < amount) throw new Error("Insufficient funds");
  // Genesis distribution agent has a published reservation price: the ask. No fabricated bids.
  const offer = {
    id: key,
    listingId,
    amount,
    buyer: "demo.local",
    status: amount >= l.ask ? "ACCEPTED" : "REJECTED",
    cycle: w.cycle,
  };
  if (amount >= l.ask) buySandbox(w, listingId, key);
  else w.receipts.push(key);
  w.offers.push(offer);
  return offer;
}
