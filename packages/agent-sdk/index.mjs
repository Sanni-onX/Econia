import { catalog } from "../economy/index.mjs";
export class RuleBasedAgentProvider {
  name = "rules";
  decide({ entity: e, world: w }) {
    const facts = {
      cash: e.cash,
      reserve: e.policy.reserve,
      cycle: w.cycle,
      risk: e.policy.risk,
      prices: { ...w.prices },
      goal: e.goal,
    };
    const proposal = (action, reason) => ({ action, reason, facts });
    if (e.status !== "ACTIVE")
      return proposal(
        { type: "WAIT" },
        "Activity is suspended while the business has no operating capital.",
      );
    if (e.capabilities.includes("PRODUCE")) {
      const r = catalog.recipes[e.industry];
      if (!r)
        return proposal({ type: "WAIT" }, "No configured production recipe.");
      for (const [good, q] of Object.entries(r.inputs))
        if (
          (e.inventory[good] || 0) < q * 3 &&
          e.cash > w.prices[good] + e.policy.reserve
        ) {
          const quantity = Math.min(
            6 * q,
            Math.floor((e.cash - e.policy.reserve) / w.prices[good]),
          );
          if (quantity > 0)
            return proposal(
              { type: "BUY", good, quantity },
              `Restock ${good.toLowerCase()} to protect production capacity.`,
            );
        }
      const staff = w.jobs.filter((j) => j.business === e.id);
      if (!staff.length && e.cash > 18000) {
        const person = Object.values(w.entities)
          .filter(
            (p) =>
              p.capabilities.includes("WORK") &&
              !w.jobs.some((j) => j.person === p.id),
          )
          .sort(
            (a, b) =>
              b.skills[r.skill] - a.skills[r.skill] || a.id.localeCompare(b.id),
          )[0];
        if (person)
          return proposal(
            { type: "HIRE", personId: person.id },
            `Production needs a ${r.skill} worker; select the best available skill fit.`,
          );
      }
      return proposal(
        { type: "PRODUCE" },
        "Convert available inputs into goods, constrained by equipment, skills, workers and reserves.",
      );
    }
    const startupCapital = {
      CONSERVATIVE: 75000,
      BALANCED: 90000,
      AGGRESSIVE: 105000,
    }[e.policy.growth];
    if (
      e.capabilities.includes("CREATE_BUSINESS") &&
      e.policy.mayCreate &&
      e.cash >= startupCapital + e.policy.reserve &&
      !w.holdings.some((h) => h.owner === e.id)
    ) {
      const industry =
        e.skills.cooking >= 65
          ? "FOOD"
          : e.skills.farming >= 65
            ? "FARMING"
            : e.skills.transport >= 65
              ? "TRANSPORT"
              : "MILLING";
      const r = catalog.recipes[industry];
      const revenue = Object.entries(r.outputs).reduce(
        (n, [g, q]) => n + q * w.prices[g],
        0,
      );
      const costs =
        Object.entries(r.inputs).reduce((n, [g, q]) => n + q * w.prices[g], 0) +
        1500;
      facts.expectedBatchMargin = revenue - costs;
      facts.industry = industry;
      facts.entrepreneurship = e.traits.ambition;
      const hurdle = { LOW: 1.3, MEDIUM: 1.15, HIGH: 1.08 }[e.policy.risk];
      facts.marginHurdle = hurdle;
      facts.startupCapital = startupCapital;
      if (revenue > costs * hurdle && e.traits.ambition >= 55)
        return proposal(
          { type: "CREATE_BUSINESS", industry, capital: startupCapital },
          `Available capital covers the reserve and startup cost; ${industry.toLowerCase()} meets the risk policy’s quoted margin hurdle. This estimate does not guarantee sales.`,
        );
    }
    if (
      w.cycle % 3 === 0 &&
      (e.inventory.BREAD || 0) < 1 &&
      e.cash > w.prices.BREAD + e.policy.reserve
    )
      return proposal(
        { type: "BUY", good: "BREAD", quantity: 1 },
        "Buy food while preserving the owner’s minimum cash reserve.",
      );
    if ((e.inventory.BREAD || 0) > 0)
      return proposal(
        { type: "CONSUME" },
        "Use purchased bread to satisfy the current food need.",
      );
    return proposal(
      { type: "WORK" },
      w.jobs.some((j) => j.person === e.id)
        ? "Fulfil an employment contract and earn the agreed wage."
        : "Perform a public infrastructure shift when private employment is unavailable.",
    );
  }
}
export class HybridAgentProvider {
  name = "hybrid";
  constructor(optionalProvider) {
    this.optional = optionalProvider;
    this.fallback = new RuleBasedAgentProvider();
  }
  async decide(context) {
    try {
      if (this.optional && context.world.cycle % 24 === 0)
        return await Promise.race([
          this.optional.decide(structuredClone(context)),
          new Promise((_, reject) => {
            const t = setTimeout(
              () => reject(new Error("Provider timeout")),
              1500,
            );
            t.unref?.();
          }),
        ]);
    } catch (error) {
      this.onFailure?.(error);
    }
    return this.fallback.decide(context);
  }
}
