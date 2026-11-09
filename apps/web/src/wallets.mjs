import { Buffer } from "buffer/index.js";
// Official Selector adapters use Buffer for NEAR serialization and NEP-413 nonces.
if (typeof window !== "undefined" && !globalThis.Buffer)
  globalThis.Buffer = Buffer;
export function nonceFromChallenge(base64) {
  const nonce = Buffer.from(base64, "base64");
  if (nonce.length !== 32)
    throw new Error("Invalid strategy challenge. Please try again.");
  return nonce;
}

export const walletChoices = [
  {
    id: "nightly",
    name: "Nightly",
    kind: "extension",
    description: "Browser extension or Nightly’s in-app browser",
    url: "https://nightly.app/download",
    mark: "N",
    color: "#756AF0",
  },
  {
    id: "my-near-wallet",
    name: "MyNearWallet",
    kind: "web",
    description: "Connect through the testnet web wallet",
    url: "https://testnet.mynearwallet.com",
    mark: "N",
    color: "#68BFA3",
  },
  {
    id: "sender",
    name: "Sender",
    kind: "extension",
    description: "NEAR browser extension",
    url: "https://chrome.google.com/webstore/detail/sender-wallet/epapihdplajcdnnkdeiahlgigofloibg",
    mark: "S",
    color: "#59AE82",
  },
  {
    id: "okx-wallet",
    name: "OKX Wallet",
    kind: "extension",
    description: "NEAR browser extension · desktop",
    url: "https://www.okx.com/web3",
    mark: "▦",
    color: "#E0E5E8",
  },
  {
    id: "intear-wallet",
    name: "Intear Wallet",
    kind: "web",
    description: "Web wallet with an in-page connection window",
    url: "https://wallet.intear.tech",
    mark: "I",
    color: "#EBA16E",
  },
];

let selectorPromise;
export function getWalletSelector() {
  if (!selectorPromise)
    selectorPromise = Promise.all([
      import("@near-wallet-selector/core"),
      import("@near-wallet-selector/nightly"),
      import("@near-wallet-selector/my-near-wallet"),
      import("@near-wallet-selector/sender"),
      import("@near-wallet-selector/okx-wallet"),
      import("@near-wallet-selector/intear-wallet"),
    ])
      .then(([core, nightly, mynear, sender, okx, intear]) =>
        core.setupWalletSelector({
          network: "testnet",
          modules: [
            nightly.setupNightly(),
            mynear.setupMyNearWallet({
              walletUrl: "https://testnet.mynearwallet.com",
            }),
            sender.setupSender(),
            okx.setupOKXWallet(),
            intear.setupIntearWallet(),
          ],
        }),
      )
      .catch((error) => {
        selectorPromise = undefined;
        throw error;
      });
  return selectorPromise;
}

export function connectionFromState(state) {
  const accounts = (state.accounts || []).filter(
    (a) => typeof a.accountId === "string" && a.accountId.length > 0,
  );
  const current = accounts.find((a) => a.active) || accounts[0];
  return {
    walletId: state.selectedWalletId || null,
    account: state.selectedWalletId ? current?.accountId || null : null,
    accounts,
  };
}

export async function connectWallet(selector, id) {
  if (!walletChoices.some((w) => w.id === id))
    throw new Error("Choose a supported NEAR wallet.");
  const provider = await selector.wallet(id);
  // Always use Selector's decorated signIn: an extension may already expose accounts
  // while Selector still has no selected wallet for subsequent transactions.
  await provider.signIn({});
  const connection = connectionFromState(selector.store.getState());
  if (connection.walletId === id && connection.account) return connection;
  return null; // A web wallet may be redirecting; restoration comes from Selector.
}

export function walletErrorMessage(error, id) {
  const text =
    typeof error === "string"
      ? error
      : error?.message || "Connection could not be completed.";
  const name = walletChoices.find((w) => w.id === id)?.name || "your wallet";
  if (/reject|denied|cancel|declin/i.test(text))
    return `Connection cancelled in ${name}. You can choose a wallet again whenever you’re ready.`;
  if (
    /inject|not installed|not available|not found|could not find|unavailable/i.test(
      text,
    )
  )
    return `${name} wasn’t detected in this browser. Enable its NEAR extension on this site, or open Econia in its wallet browser, then reload. Select NEAR Testnet in the wallet.`;
  if (/network|mainnet|testnet|rpc/i.test(text))
    return `Select NEAR Testnet in ${name}, then try again. ${text}`;
  return text;
}
