import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialOnboardingState, onboardingProgress, onboardingSections } from "../src/onboarding.js";

describe("onboarding progress", () => {
  it("reports remaining conversational sections", () => {
    const state = initialOnboardingState();
    state.completedSections = ["goals_and_boundaries", "classifications"];
    const progress = onboardingProgress(state);
    assert.equal(progress.completed, 2);
    assert.equal(progress.total, onboardingSections.length);
    assert.equal(progress.percent, 25);
    assert.ok(progress.remaining.includes("validation_and_launch"));
  });
});
