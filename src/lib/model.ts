// Model provider abstraction. Azure OpenAI by default; swap in any tool-calling model here only.
import { createAzure } from "@ai-sdk/azure";

const azure = createAzure({
  resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
});

export const model = azure(process.env.AZURE_OPENAI_DEPLOYMENT ?? "missing-deployment");

// Recorded in every audit log row and shown in the audit drawer.
export const MODEL_LABEL = process.env.MODEL_LABEL ?? "unset";
