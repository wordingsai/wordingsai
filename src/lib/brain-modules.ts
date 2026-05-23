type RuleLike = {
  name?: string | null;
  category?: string | null;
  currentVersion?: {
    ruleDefinition?: Record<string, unknown> | null;
  } | null;
};

export type BrainModuleKey =
  | "reinsurance-core"
  | "property-core"
  | "risk-clauses";

export interface BrainModuleDefinition {
  key: BrainModuleKey;
  name: string;
  workspaceTypes: string[];
  contractTypes: string[];
  ruleKeywords: string[];
  categories: string[];
}

export const BRAIN_MODULES: BrainModuleDefinition[] = [
  {
    key: "reinsurance-core",
    name: "Reinsurance Core",
    workspaceTypes: ["reinsurance"],
    contractTypes: ["reinsurance", "insurance", "other"],
    ruleKeywords: [
      "reinsurance",
      "cedant",
      "reinsurer",
      "slip",
      "treaty",
      "follow the fortunes",
      "follow settlements",
    ],
    categories: ["claims", "premium", "placement", "compliance"],
  },
  {
    key: "property-core",
    name: "Property Core",
    workspaceTypes: ["property"],
    contractTypes: ["insurance", "property", "other"],
    ruleKeywords: [
      "property",
      "physical damage",
      "insured location",
      "business interruption",
      "deductible",
    ],
    categories: ["claims", "parties", "termination", "compliance"],
  },
  {
    key: "risk-clauses",
    name: "Risk Clauses",
    workspaceTypes: ["reinsurance", "property", "general"],
    contractTypes: ["insurance", "reinsurance", "aviation", "other"],
    ruleKeywords: [
      "war",
      "sanction",
      "terrorism",
      "exclusion",
      "limitation",
      "arbitration",
      "governing law",
    ],
    categories: ["exclusions", "disputes", "compliance", "termination"],
  },
];

export function getAutoSelectedBrainModules(input: {
  workspaceType?: string | null;
  contractType?: string | null;
}): BrainModuleKey[] {
  const workspaceType = (input.workspaceType ?? "general").toLowerCase();
  const contractType = (input.contractType ?? "other").toLowerCase();

  const selected = BRAIN_MODULES.filter((module) => {
    const workspaceMatch = module.workspaceTypes.includes(workspaceType);
    const contractMatch = module.contractTypes.includes(contractType);
    return workspaceMatch || contractMatch;
  }).map((module) => module.key);

  return selected.length > 0 ? selected : ["risk-clauses"];
}

export function inferRuleModuleKey(rule: RuleLike): BrainModuleKey {
  const explicitKey = rule.currentVersion?.ruleDefinition?.moduleKey;
  if (
    explicitKey === "reinsurance-core" ||
    explicitKey === "property-core" ||
    explicitKey === "risk-clauses"
  ) {
    return explicitKey;
  }

  const haystack = `${rule.name ?? ""} ${rule.category ?? ""}`.toLowerCase();
  for (const module of BRAIN_MODULES) {
    if (
      module.categories.some((category) => haystack.includes(category)) ||
      module.ruleKeywords.some((keyword) => haystack.includes(keyword))
    ) {
      return module.key;
    }
  }

  return "risk-clauses";
}
