import { randomBytes } from "node:crypto";
import { verifyMessage } from "near-api-js/nep413";
export function createServiceAuth({
  provider,
  verify = verifyMessage,
  now = Date.now,
  network = "mainnet",
}) {
  if (!["mainnet", "testnet"].includes(network))
    throw Error("Explicit NEAR authentication network required");
  const challenges = new Map(),
    sessions = new Map();
  const clean = () => {
    for (const m of [challenges, sessions])
      for (const [k, v] of m) if (v.expires < now()) m.delete(k);
  };
  return {
    challenge(accountId) {
      clean();
      if (
        typeof accountId !== "string" ||
        !(
          network === "mainnet"
            ? /^([a-f0-9]{64}|[a-z0-9._-]+\.near)$/
            : /^([a-f0-9]{64}|[a-z0-9._-]+\.testnet)$/
        ).test(accountId) ||
        accountId.length > 64
      )
        throw Error(`Use a ${network} NEAR account`);
      if (challenges.size >= 200) throw Error("Sign-in limit; retry later");
      const c = {
        id: randomBytes(20).toString("hex"),
        accountId,
        nonce: randomBytes(32).toString("base64"),
        recipient: `econia.services.${network}`,
        message:
          network === "testnet"
            ? `Sign in to Econia 2.0 as ${accountId}. This authorizes private professional conversations and bounded inference requests. Owner actions require fresh NFT ownership checks. This does not transfer funds or change any agent's profession.`
            : `Sign in to the Econia service workspace as ${accountId}. This authorizes task requests within the displayed trial allowance and owner brief changes. It does not transfer funds.`,
        expires: now() + 300000,
      };
      challenges.set(c.id, c);
      return c;
    },
    async login(proof) {
      clean();
      const c = challenges.get(proof?.challengeId);
      if (!c || c.accountId !== proof.accountId)
        throw Error("Expired or mismatched sign-in challenge");
      challenges.delete(c.id);
      if (
        typeof proof.signature !== "string" ||
        proof.signature.length > 200 ||
        typeof proof.publicKey !== "string" ||
        proof.publicKey.length > 100
      )
        throw Error("Invalid wallet proof");
      await verify({
        signerAccountId: proof.accountId,
        signerPublicKey: proof.publicKey,
        payload: {
          message: c.message,
          recipient: c.recipient,
          nonce: Buffer.from(c.nonce, "base64"),
        },
        signature: Buffer.from(proof.signature, "base64"),
        provider,
      });
      const token = randomBytes(32).toString("hex"),
        expires = now() + 3600000;
      sessions.set(token, { accountId: c.accountId, expires });
      return { token, accountId: c.accountId, expires };
    },
    require(header) {
      clean();
      const token = (header || "").replace(/^Bearer /, "");
      const s = sessions.get(token);
      if (!s)
        throw Object.assign(
          Error("Sign in with your wallet to use the service workspace"),
          { status: 401 },
        );
      return s.accountId;
    },
    logout(header) {
      sessions.delete((header || "").replace(/^Bearer /, ""));
    },
  };
}
