import OpenAI from "openai";

// Constructed lazily, not as a module-level `const`: the SDK throws
// synchronously if OPENAI_API_KEY is missing/empty, and a module-level throw
// would crash every route that imports lib/guardrails/moderation.ts at
// import time -- before moderateContent's own try/catch ever runs. That
// contradicts this feature's fail-open design (a missing/invalid key should
// skip moderation and log an error, not take down the whole Feed API).
let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}
