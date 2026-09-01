import { describe, expect, it } from "vitest";
import { initialOnboardingState, onboardingProgress, onboardingSections } from "../src/onboarding.js";

describe("onboarding progress", () => {
  it("reports remaining conversational sections", () => {
    const state = initialOnboardingState();
    state.completedSections = ["goals_and_boundaries", "classifications"];
    const progress = onboardingProgress(state);
    expect(progress.completed).toBe(2);
    expect(progress.total).toBe(onboardingSections.length);
    expect(progress.percent).toBe(25);
    expect(progress.remaining).toContain("validation_and_launch");
  });
});
