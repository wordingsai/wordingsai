import { huggingface } from "@ai-sdk/huggingface";

export function getLanguageModel(modelId: string) {
  return huggingface("openai/gpt-oss-120b");
}

export function getTitleModel() {
  return huggingface("openai/gpt-oss-120b");
}
