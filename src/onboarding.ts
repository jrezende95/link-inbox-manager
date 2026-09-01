import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

export const onboardingSections = [
  "goals_and_boundaries",
  "classifications",
  "per_category_controls",
  "preferences_and_thresholds",
  "voice_and_identity",
  "escalations_and_review",
  "technical_setup",
  "validation_and_launch",
] as const;

const onboardingSchema = z.object({
  version: z.literal(1),
  acknowledgedOverview: z.boolean().default(false),
  acknowledgedLinkedInRisk: z.boolean().default(false),
  completedSections: z.array(z.enum(onboardingSections)).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
  updatedAt: z.string(),
});

export type OnboardingState = z.infer<typeof onboardingSchema>;

export function initialOnboardingState(): OnboardingState {
  return { version: 1, acknowledgedOverview: false, acknowledgedLinkedInRisk: false, completedSections: [], unresolvedQuestions: [], updatedAt: new Date().toISOString() };
}

export function readOnboardingState(path: string): OnboardingState {
  try { return onboardingSchema.parse(JSON.parse(readFileSync(path, "utf8"))); }
  catch { return initialOnboardingState(); }
}

export function writeOnboardingState(path: string, state: OnboardingState): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(onboardingSchema.parse({ ...state, updatedAt: new Date().toISOString() }), null, 2)}\n`, { mode: 0o600 });
}

export function onboardingProgress(state: OnboardingState): { completed: number; total: number; percent: number; remaining: string[] } {
  const completed = new Set(state.completedSections);
  const remaining = onboardingSections.filter((section) => !completed.has(section));
  return { completed: completed.size, total: onboardingSections.length, percent: Math.round(completed.size / onboardingSections.length * 100), remaining };
}
