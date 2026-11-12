import { SERVICES, PROFESSIONS } from "./genesis.mjs";
export function createDiscoveryService(store) {
  return {
    search({ service, profession, query = "", requester, limit = 12 } = {}) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      return store
        .agents()
        .filter(
          (a) =>
            (!service || a.services.includes(service)) &&
            (!profession || a.profession === profession) &&
            a.id !== requester,
        )
        .map((a) => {
          const history = requester
            ? store.db
                .prepare(
                  "SELECT completed,failed,rating_total,rating_count FROM relationships WHERE agent_id=? AND peer_id=?",
                )
                .get(requester, a.id)
            : null;
          const haystack =
            `${a.name} ${a.specialization} ${a.biography} ${a.services.map((s) => SERVICES[s].name).join(" ")}`.toLowerCase();
          return {
            ...a,
            professionName: PROFESSIONS[a.profession].name,
            offers: a.services.map((id) => ({
              id,
              ...SERVICES[id],
              asset: "near:testnet:NEAR",
              network: "testnet",
            })),
            history: history || {
              completed: 0,
              failed: 0,
              rating_total: 0,
              rating_count: 0,
            },
            relevance: terms.reduce(
              (n, t) => n + (haystack.includes(t) ? 1 : 0),
              0,
            ),
          };
        })
        .sort((a, b) => b.relevance - a.relevance || a.id.localeCompare(b.id))
        .slice(0, Math.min(24, Math.max(1, limit)));
    },
  };
}
