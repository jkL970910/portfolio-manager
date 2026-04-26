export const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5.5";
export const DEFAULT_OPENAI_REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT?.trim() || "medium";

export function getOpenAiRuntimeConfig() {
  return {
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    model: DEFAULT_OPENAI_MODEL,
    reasoningEffort: DEFAULT_OPENAI_REASONING_EFFORT
  };
}
