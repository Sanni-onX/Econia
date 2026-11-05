export type EntityType =
  | "PERSON"
  | "BUSINESS"
  | "PROPERTY"
  | "MACHINE"
  | "ORGANIZATION";
export type Capability =
  | "HOLD_FUNDS"
  | "OWN"
  | "WORK"
  | "CREATE_BUSINESS"
  | "TRADE"
  | "HIRE"
  | "PRODUCE"
  | "INVEST";
export interface Policy {
  risk: "LOW" | "MEDIUM" | "HIGH";
  growth: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";
  reserve: number;
  debtCeiling: number;
  mayCreate: boolean;
  mayInvest: boolean;
  majorAssetSale: "AUTO" | "OWNER_APPROVAL";
}
export interface EconomicEntity {
  id: string;
  name: string;
  type: EntityType;
  owner: string;
  capabilities: Capability[];
  cash: number;
  inventory: Record<string, number>;
  skills: Record<string, number>;
  policy: Policy;
  sponsorship: number;
  revenue: number;
  expenses: number;
  goal: string;
}
export type Action =
  | { type: "BUY"; good: string; quantity: number }
  | { type: "PRODUCE" }
  | { type: "CREATE_BUSINESS"; industry: string; capital: number }
  | { type: "HIRE"; personId: string }
  | { type: "WORK" }
  | { type: "CONSUME" }
  | { type: "MAINTAIN" }
  | { type: "WAIT" };
export interface AgentProvider {
  decide(
    context: Readonly<{
      entity: EconomicEntity;
      cycle: number;
      prices: Record<string, number>;
    }>,
  ): { action: Action; reason: string; facts: Record<string, unknown> };
}
export interface PaymentAdapter {
  mode: string;
  settle(batch: {
    id: string;
    transfers: unknown[];
  }): Promise<{ hash: string }>;
}
