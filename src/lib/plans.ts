export type PlanId = "fast" | "basic" | "plus" | "enterprise";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  priceLabel: string;
  intervalLabel: string;
  features: string[];
  highlight?: boolean;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "fast",
    name: "Fast",
    description: "Lightning-fast automated checklist for rapid triage.",
    priceLabel: "Trial",
    intervalLabel: "soft launch",
    features: [
      "Upload Contract",
      "Static Clause Library",
      "No Editing",
      "No Analytics",
    ],
  },
  {
    id: "basic",
    name: "Intelligence",
    description: "Operational analysis for wordings assessment.",
    priceLabel: "Trial",
    intervalLabel: "soft launch",
    features: ["Upload Contract", "Editing Clause Library", "Analytics"],
    highlight: true,
  },
  {
    id: "plus",
    name: "Plus",
    description: "Strategic infrastructure for enterprise wordings.",
    priceLabel: "Trial",
    intervalLabel: "soft launch",
    features: ["Full Functionality"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for large organizations.",
    priceLabel: "Custom",
    intervalLabel: "contact us",
    features: [
      "All features in Plus",
      "Custom integrations",
      "Dedicated support",
      "Enterprise billing",
    ],
  },
];

export const CHATBOT_DAILY_LIMITS: Record<
  PlanId,
  { messages: number; tokens: number }
> = {
  fast: { messages: 5, tokens: 25000 },
  basic: { messages: 20, tokens: 100000 },
  plus: { messages: 150, tokens: 1000000 },
  enterprise: { messages: 500, tokens: 5000000 },
};
