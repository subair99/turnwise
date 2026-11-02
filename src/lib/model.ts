// Model provider abstraction. Uses OpenRouter (OpenAI-compatible API); swap providers here only.
import { createOpenAI } from "@ai-sdk/openai";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  compatibility: "compatible",
  headers: {
    "HTTP-Referer": "https://turnwise-web.onrender.com",
    "X-Title": "Turnwise",
  },
});

// Pick a model that supports tool calling and structured outputs, e.g. an OpenAI GPT model on OpenRouter.
export const model = openrouter(process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini");

// Recorded in every audit log row and shown in the audit drawer.
export const MODEL_LABEL = process.env.MODEL_LABEL ?? `openrouter/${process.env.OPENROUTER_MODEL ?? "unset"}`;
