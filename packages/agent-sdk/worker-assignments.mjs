export const WORKER_ASSIGNMENTS = Object.freeze(
  [
    ["person_199", "source-brief"],
    ["person_101", "csv-audit"],
    ["person_102", "copy-edit"],
    ["person_103", "near-account"],
    ["person_104", "near-contract"],
    ["person_105", "near-nft"],
    ["person_106", "near-token"],
    [
      "person_107",
      "mission-coordination",
      "Mission coordinator",
      "Decompose a customer goal and commission a bounded specialist team.",
    ],
    ["person_108", "source-brief"],
    ["person_109", "csv-audit"],
    ["person_110", "near-account"],
    ["person_111", "near-contract"],
    ["person_112", "near-nft"],
    ["person_113", "near-token"],
    ["person_114", "copy-edit"],
    [
      "person_115",
      "report-assembly",
      "Report assembler",
      "Combine checked specialist outputs into a traceable customer deliverable.",
    ],
    ["person_116", "copy-edit"],
  ].map(([agentId, service, label, purpose]) => ({
    agentId,
    service,
    label,
    purpose,
  })),
);
export const workersFor = (service) =>
  WORKER_ASSIGNMENTS.filter((a) => a.service === service);
