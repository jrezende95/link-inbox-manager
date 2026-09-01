import type { AppConfig } from "../config.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { OpenAIProvider } from "./openai.js";
import type { ModelProvider } from "./types.js";

export function createProvider(config: AppConfig): ModelProvider {
  const { env } = config;
  if (env.LINK_MODEL_PROVIDER === "openai") return new OpenAIProvider(env.LINK_MODEL, env.OPENAI_API_KEY!);
  if (env.LINK_MODEL_PROVIDER === "anthropic") return new AnthropicProvider(env.LINK_MODEL, env.ANTHROPIC_API_KEY!);
  return new GeminiProvider(env.LINK_MODEL, env.GEMINI_API_KEY!);
}
