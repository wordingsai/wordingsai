export interface KeywordPack {
  bias: "Balanced" | "Cedant" | "Reinsurer";
  theme: string;
  keywords: string[];
}

export interface RuleDefinition {
  appliesTo: string;
  whatToCheck: string[];
  clauseReferences: string[];
  keywordPacks: KeywordPack[];
  greenCriteria: string[];
  amberCriteria: string[];
  redCriteria: string[];
}

export interface RuleToSeed {
  name: string;
  description: string;
  category: "Exclusions" | "Conditions" | string;
  definition: RuleDefinition;
  isGlobal?: boolean;
  status?: "active" | "inactive";
}

export type OrganizationPlan = "basic" | "plus";
