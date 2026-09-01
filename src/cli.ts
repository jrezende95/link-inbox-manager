#!/usr/bin/env node
import { accessSync, closeSync, constants, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig, requiredApiKeyName } from "./config.js";
import { Ledger } from "./ledger.js";
import { LinkedInClient } from "./linkedin.js";
import { createLogger } from "./logger.js";
import { onboardingProgress, onboardingSections, readOnboardingState } from "./onboarding.js";
import { Orchestrator } from "./orchestrator.js";
import { daemon } from "./scheduler.js";

const command = process.argv[2] ?? "doctor";

function exists(path: string): boolean {
  try { accessSync(path, constants.F_OK); return true; }
  catch { return false; }
}

async function withLock(databasePath: string, task: () => Promise<void>): Promise<void> {
  const path = resolve(dirname(databasePath), "run.lock");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  let fd: number;
  try { fd = openSync(path, "wx", 0o600); }
  catch { throw new Error("Another Link run is active; overlapping browser activity is blocked."); }
  try { await task(); }
  finally { closeSync(fd); rmSync(path, { force: true }); }
}

function readApproval(path: string): { ownerApproved: boolean; approvedAt: string; lookbackDays?: number } {
  if (!exists(path)) throw new Error(`Required user approval is missing: ${path}`);
  const value = JSON.parse(readFileSync(path, "utf8")) as { ownerApproved?: unknown; approvedAt?: unknown; lookbackDays?: unknown };
  if (value.ownerApproved !== true || typeof value.approvedAt !== "string") throw new Error(`Approval file is invalid: ${path}`);
  return { ownerApproved: true, approvedAt: value.approvedAt, lookbackDays: typeof value.lookbackDays === "number" ? value.lookbackDays : undefined };
}

async function run(mode: "validation" | "historical_preview" | "steady" | "historical"): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.env);
  const limitArg = process.argv.find((value) => value.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : config.policy.validation.defaultBatchSize;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("--limit must be an integer from 1 to 500");
  await withLock(config.paths.database, async () => {
    const orchestrator = new Orchestrator(config, logger);
    try {
      const launch = mode === "validation" || mode === "historical_preview" ? undefined : readApproval(config.paths.launchApproval);
      const historical = mode === "historical" ? readApproval(config.paths.historicalApproval) : undefined;
      const lookbackDays = historical?.lookbackDays ?? (mode === "historical_preview" ? config.policy.validation.historicalLookbackDays : undefined);
      const result = await orchestrator.run({ limit, mode, launchApprovedAt: launch?.approvedAt, lookbackDays });
      console.log(JSON.stringify({ records: result.records.length, artifact: result.artifact, sheets: Boolean(config.env.LINK_GOOGLE_SHEET_ID) }, null, 2));
    } finally { orchestrator.close(); }
  });
}

if (command === "doctor") {
  const config = loadConfig({ requireApiKey: false });
  const keyName = requiredApiKeyName(config.env.LINK_MODEL_PROVIDER);
  const report = {
    platform: { ok: process.platform === "darwin", value: process.platform, required: "darwin" },
    node: { ok: Number(process.versions.node.split(".")[0]) >= 22, value: process.versions.node },
    chrome: { ok: exists(config.env.LINK_CHROME_EXECUTABLE), path: config.env.LINK_CHROME_EXECUTABLE },
    policy: { ok: exists(config.paths.policy), path: config.paths.policy },
    provider: { ok: Boolean(config.env[keyName]), name: config.env.LINK_MODEL_PROVIDER, modelConfigured: Boolean(config.env.LINK_MODEL), credential: config.env[keyName] ? "present" : "missing" },
    sheets: { mode: config.env.LINK_GOOGLE_SHEET_ID ? "oauth" : "agent-connector-or-local-artifact" },
    launchApproval: { present: exists(config.paths.launchApproval) },
  };
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(report).some((item) => "ok" in item && !item.ok)) process.exitCode = 1;
} else if (command === "policy-validate") {
  const config = loadConfig({ requireApiKey: false });
  console.log(JSON.stringify({ valid: true, schemaVersion: config.policy.schemaVersion, categories: config.policy.categories.map((category) => category.id) }, null, 2));
} else if (command === "onboarding-status") {
  const path = resolve(".link/onboarding.json");
  const state = readOnboardingState(path);
  console.log(JSON.stringify({ ...onboardingProgress(state), acknowledgedOverview: state.acknowledgedOverview, acknowledgedLinkedInRisk: state.acknowledgedLinkedInRisk, unresolvedQuestions: state.unresolvedQuestions }, null, 2));
} else if (command === "launch-approve") {
  const config = loadConfig({ requireApiKey: false });
  if (!process.argv.includes("--owner-approved")) throw new Error("Launch approval requires --owner-approved after the user explicitly approves launch.");
  const state = readOnboardingState(config.paths.onboardingState);
  const progress = onboardingProgress(state);
  if (progress.completed !== onboardingSections.length || !state.acknowledgedOverview || !state.acknowledgedLinkedInRisk || state.unresolvedQuestions.length) {
    throw new Error("Onboarding, risk acknowledgment, and unresolved questions must be complete before launch approval.");
  }
  mkdirSync(dirname(config.paths.launchApproval), { recursive: true, mode: 0o700 });
  writeFileSync(config.paths.launchApproval, `${JSON.stringify({ ownerApproved: true, approvedAt: new Date().toISOString(), policySchemaVersion: config.policy.schemaVersion }, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ approved: true, path: config.paths.launchApproval }, null, 2));
} else if (command === "validation-run") {
  await run("validation");
} else if (command === "cleanup-preview") {
  await run("historical_preview");
} else if (command === "cleanup-approve") {
  const config = loadConfig({ requireApiKey: false });
  readApproval(config.paths.launchApproval);
  if (!process.argv.includes("--owner-approved")) throw new Error("Historical cleanup approval requires --owner-approved after direct user confirmation.");
  const daysArg = process.argv.find((value) => value.startsWith("--days="));
  const days = daysArg ? Number(daysArg.split("=")[1]) : config.policy.validation.historicalLookbackDays;
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("--days must be a positive whole number.");
  if (days > 30 && !config.policy.validation.olderMessageGuidance) throw new Error("Lookbacks beyond 30 days require olderMessageGuidance in the private policy.");
  mkdirSync(dirname(config.paths.historicalApproval), { recursive: true, mode: 0o700 });
  writeFileSync(config.paths.historicalApproval, `${JSON.stringify({ ownerApproved: true, approvedAt: new Date().toISOString(), lookbackDays: days }, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ approved: true, lookbackDays: days }, null, 2));
} else if (command === "cleanup-run") {
  await run("historical");
} else if (command === "run-once") {
  await run("steady");
} else if (command === "daemon") {
  const config = loadConfig();
  const logger = createLogger(config.env);
  await daemon(config.policy, logger, () => withLock(config.paths.database, async () => {
    const orchestrator = new Orchestrator(config, logger);
    try {
      const launch = readApproval(config.paths.launchApproval);
      await orchestrator.run({ limit: 50, mode: "steady", launchApprovedAt: launch.approvedAt });
    }
    finally { orchestrator.close(); }
  }));
} else if (command === "status") {
  const config = loadConfig({ requireApiKey: false });
  const ledger = new Ledger(config.paths.database);
  try { console.log(JSON.stringify(ledger.status(), null, 2)); }
  finally { ledger.close(); }
} else if (command === "browser-login") {
  const config = loadConfig({ requireApiKey: false });
  const linkedin = new LinkedInClient(config);
  await linkedin.start();
  await linkedin.openLogin();
  console.log("A dedicated Chrome profile is open. Sign in manually, confirm LinkedIn Messaging loads, then press Ctrl+C here.");
  await new Promise<never>(() => undefined);
} else {
  throw new Error(`Unknown command: ${command}`);
}
