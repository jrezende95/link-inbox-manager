import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { parsePolicy, type LinkPolicy } from "./policy-schema.js";

loadDotenv({ path: [".env.local", ".env"], quiet: true });

const bool = z.preprocess(
  (value) => typeof value === "string" ? value.toLowerCase() === "true" : value,
  z.boolean(),
);

const environmentSchema = z.object({
  LINK_MODEL_PROVIDER: z.enum(["openai", "anthropic", "gemini"]),
  LINK_MODEL: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  LINK_POLICY_PATH: z.string().default("./config/policy.local.json"),
  LINK_DATABASE_PATH: z.string().default("./data/link.sqlite"),
  LINK_BROWSER_PROFILE: z.string().default("./browser-profile"),
  LINK_CHROME_EXECUTABLE: z.string().default("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
  LINK_LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LINK_VALIDATION_MODE: bool.default(true),
  LINK_AUTO_SEND: bool.default(false),
  LINK_AUTO_MARK_READ: bool.default(false),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  LINK_GOOGLE_TOKEN_PATH: z.string().default("./.link/google-oauth.json"),
  LINK_GOOGLE_SHEET_ID: z.string().optional(),
  LINK_GOOGLE_SHEET_TAB: z.string().default("Validation"),
});

export type Environment = z.infer<typeof environmentSchema>;

export interface AppConfig {
  env: Environment;
  policy: LinkPolicy;
  paths: {
    policy: string;
    database: string;
    browserProfile: string;
    launchApproval: string;
    historicalApproval: string;
    onboardingState: string;
  };
}

export function requiredApiKeyName(provider: Environment["LINK_MODEL_PROVIDER"]): keyof Environment {
  if (provider === "openai") return "OPENAI_API_KEY";
  if (provider === "anthropic") return "ANTHROPIC_API_KEY";
  return "GEMINI_API_KEY";
}

export function loadConfig(options: { requireApiKey?: boolean } = {}): AppConfig {
  const env = environmentSchema.parse(process.env);
  const policyPath = resolve(env.LINK_POLICY_PATH);
  const policy = parsePolicy(JSON.parse(readFileSync(policyPath, "utf8")));
  if (options.requireApiKey !== false) {
    const keyName = requiredApiKeyName(env.LINK_MODEL_PROVIDER);
    if (!env[keyName]) throw new Error(`${String(keyName)} is required for provider ${env.LINK_MODEL_PROVIDER}`);
  }
  return {
    env,
    policy,
    paths: {
      policy: policyPath,
      database: resolve(env.LINK_DATABASE_PATH),
      browserProfile: resolve(env.LINK_BROWSER_PROFILE),
      launchApproval: resolve(".link/launch-approval.json"),
      historicalApproval: resolve(".link/historical-approval.json"),
      onboardingState: resolve(".link/onboarding.json"),
    },
  };
}

export function assertWritesAllowed(config: AppConfig): void {
  if (config.env.LINK_VALIDATION_MODE || !config.env.LINK_AUTO_SEND) {
    throw new Error("Live replies are disabled by validation or auto-send configuration.");
  }
  const approval = JSON.parse(readFileSync(config.paths.launchApproval, "utf8")) as { ownerApproved?: unknown };
  if (approval.ownerApproved !== true) throw new Error("Explicit user launch approval is missing.");
}
