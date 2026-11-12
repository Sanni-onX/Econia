export function createOwnershipService(store, { resolveOwnership } = {}) {
  return {
    async observe(agentId) {
      store.professional(agentId);
      if (!resolveOwnership)
        throw Object.assign(
          Error("Genesis testnet NFT deployment has not been verified"),
          { status: 503 },
        );
      const result = await resolveOwnership(agentId);
      if (
        !result ||
        typeof result.ownerId !== "string" ||
        !result.reference ||
        result.network !== "testnet"
      )
        throw Error("Fresh testnet NFT ownership proof required");
      return store.transaction(() => {
        const previous = store.db
          .prepare("SELECT * FROM ownership WHERE agent_id=?")
          .get(agentId);
        const epoch = previous
          ? previous.epoch + (previous.owner_id !== result.ownerId ? 1 : 0)
          : 1;
        store.db
          .prepare(
            "INSERT INTO ownership VALUES(?,?,?,?,?) ON CONFLICT(agent_id) DO UPDATE SET owner_id=excluded.owner_id,epoch=excluded.epoch,verified_at=excluded.verified_at,chain_reference=excluded.chain_reference",
          )
          .run(agentId, result.ownerId, epoch, store.now(), result.reference);
        if (!previous || previous.owner_id !== result.ownerId) {
          store.db
            .prepare(
              "INSERT INTO ownership_history(agent_id,prior_owner,new_owner,epoch,observed_at,chain_reference) VALUES(?,?,?,?,?,?)",
            )
            .run(
              agentId,
              previous?.owner_id || null,
              result.ownerId,
              epoch,
              store.now(),
              result.reference,
            );
          store.event(
            agentId,
            "OWNERSHIP_OBSERVED",
            result.reference,
            "Current testnet NFT ownership verified. Professional history is retained; private owner conversations remain restricted.",
          );
        }
        return { ownerId: result.ownerId, epoch, reference: result.reference };
      });
    },
    async requireOwner(agentId, account) {
      const record = await this.observe(agentId);
      if (record.ownerId !== account)
        throw Object.assign(Error("Current NFT owner only"), { status: 403 });
      return record;
    },
  };
}
