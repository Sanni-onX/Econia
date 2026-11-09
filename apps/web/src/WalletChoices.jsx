import React, { useEffect, useState } from "react";
import { walletChoices } from "./wallets.mjs";
import "./wallets.css";

export function WalletChoices({
  selector,
  loading,
  connecting,
  connection,
  onConnect,
  onDisconnect,
  onAccount,
  error,
}) {
  const [, refresh] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => refresh((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const modules = selector?.store.getState().modules || [];
  return (
    <div className="wallet-choices">
      <div className="wallet-network">
        <i /> NEAR TESTNET <span>Test assets only</span>
      </div>
      <p className="wallet-network-help">
        Choose NEAR and Testnet inside your wallet. Mainnet balances and other
        chains won’t appear in this preview.
      </p>
      {connection.account && (
        <section className="wallet-connected-card">
          <small>
            CONNECTED WITH{" "}
            {walletChoices
              .find((w) => w.id === connection.walletId)
              ?.name.toUpperCase() || "NEAR WALLET"}
          </small>
          <strong>{connection.account}</strong>
          {connection.accounts.length > 1 && (
            <label>
              Active account
              <select
                aria-label="Active NEAR account"
                value={connection.account}
                onChange={(e) => onAccount(e.target.value)}
              >
                {connection.accounts.map((a) => (
                  <option key={a.accountId}>{a.accountId}</option>
                ))}
              </select>
            </label>
          )}
          <button
            className="text-button"
            onClick={onDisconnect}
            disabled={Boolean(connecting)}
          >
            Disconnect wallet
          </button>
        </section>
      )}
      <div className="wallet-picker-heading">
        <strong>
          {connection.account ? "Switch wallet" : "Choose your wallet"}
        </strong>
        <span>
          {loading ? "Preparing wallets…" : "Your keys stay in your wallet"}
        </span>
      </div>
      <div className="wallet-picker-list">
        {walletChoices.map((choice) => {
          const module = modules.find((m) => m.id === choice.id);
          const available =
            choice.id === "nightly"
              ? Boolean(window.nightly?.near)
              : choice.kind === "web"
                ? true
                : Boolean(module?.metadata.available);
          const selected =
            choice.id === connection.walletId && Boolean(connection.account);
          return (
            <div
              className={"wallet-choice-row " + (selected ? "connected" : "")}
              key={choice.id}
            >
              <button
                className="wallet-option"
                aria-label={`Connect ${choice.name}`}
                disabled={loading || Boolean(connecting)}
                onClick={() => onConnect(choice.id)}
              >
                {module?.metadata.iconUrl ? (
                  <img
                    src={module.metadata.iconUrl}
                    alt=""
                    width="38"
                    height="38"
                  />
                ) : (
                  <span
                    className="wallet-choice-mark"
                    style={{ background: choice.color }}
                  >
                    {choice.mark}
                  </span>
                )}
                <span>
                  <strong>
                    {choice.name}
                    {choice.id === "nightly" && <em>NEW</em>}
                  </strong>
                  <small>
                    {connecting === choice.id
                      ? `Waiting for ${choice.name}…`
                      : choice.description}
                  </small>
                </span>
                <span className="wallet-choice-status">
                  {selected
                    ? "Connected"
                    : available
                      ? choice.kind === "extension"
                        ? "Detected"
                        : "Open wallet"
                      : "Not detected"}
                </span>
              </button>
              {!available && !loading && (
                <a
                  href={module?.metadata.downloadUrl || choice.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get {choice.name} ↗
                </a>
              )}
            </div>
          );
        })}
      </div>
      {connecting && connecting !== "disconnect" && (
        <p className="wallet-pending" role="status">
          Approve the connection in{" "}
          {walletChoices.find((w) => w.id === connecting)?.name}. If your wallet
          is locked, unlock it there.
        </p>
      )}
      {error && (
        <p className="form-error wallet-connect-error" role="alert">
          {error}
        </p>
      )}
      <p className="wallet-connection-note">
        Connecting lets Econia read your public account. Spending and signed
        strategy changes require a separate wallet approval. Following people
        needs no wallet.
      </p>
    </div>
  );
}
