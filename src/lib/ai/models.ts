export const DEFAULT_CHAT_MODEL = "openai/gpt-oss-120b";

export const titleModel = {
  id: "openai/gpt-oss-120b",
  name: "GPT OSS 120B",
  provider: "huggingface",
  description: "Open-source 120B parameter model from Hugging Face",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  gatewayOrder?: string[];
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const chatModels: ChatModel[] = [
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "huggingface",
    description: "Open-source 120B parameter model from Hugging Face",
    reasoningEffort: "low",
  },
];

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  return {
    "openai/gpt-oss-120b": {
      tools: false,
      vision: false,
      reasoning: true,
    },
  };
}

export const isDemo = process.env.IS_DEMO === "1";

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>,
);
