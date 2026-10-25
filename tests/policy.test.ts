import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePolicy } from "../src/policy-schema.js";
import { examplePolicy } from "./helpers.js";

describe("private policy schema", () => {
  it("accepts the sanitized starter policy", () => {
    const policy = examplePolicy();
    assert.ok(policy.categories.some((category) => category.id === "unknown"));
    assert.equal(policy.categories.every((category) => category.autoSend === false), true);
  });

  it("allows users to add their own classifications", () => {
    const input = examplePolicy();
    input.categories.push({
      id: "community_invitation",
      label: "Community invitation",
      description: "Synthetic custom category",
      precedence: 60,
      enabled: true,
      examples: [],
      actions: ["escalate"],
      autoSend: false,
      permanentHandoff: false,
      firstResponseTemplate: null,
      followUpTemplate: null,
      requiredFacts: [],
      privateRules: [],
      publicRejectionGuidance: null,
      outcomes: {},
    });
    assert.equal(parsePolicy(input).categories.at(-1)?.id, "community_invitation");
  });

  it("requires an old-message policy beyond 30 days", () => {
    const input = examplePolicy();
    input.validation.historicalLookbackDays = 31;
    input.validation.olderMessageGuidance = null;
    assert.throws(() => parsePolicy(input), /older-message guidance/i);
  });

  it("rejects duplicate category ids", () => {
    const input = examplePolicy();
    input.categories.push({ ...input.categories[0] });
    assert.throws(() => parsePolicy(input), /duplicate category id/i);
  });

  it("preserves conservative defaults and custom categories without a policy migration", () => {
    const input = examplePolicy();
    const policy = parsePolicy({ ...input, categories: [{
      id: "custom_category", label: "Custom", description: "Synthetic custom category", precedence: 1, actions: ["escalate"],
    }] });
    const category = policy.categories[0];
    assert.equal(category.enabled, true);
    assert.equal(category.autoSend, false);
    assert.equal(category.permanentHandoff, false);
    assert.equal(category.firstResponseTemplate, null);
    assert.deepEqual(category.actions, ["escalate"]);
    assert.deepEqual(category.requiredFacts, []);
    assert.deepEqual(category.privateRules, []);
    assert.deepEqual(category.outcomes, {});
  });

  it("rejects invalid safety settings instead of coercing them", () => {
    for (const safety of [
      { ...examplePolicy().safety, minimumAutoActionConfidence: 2 },
      { ...examplePolicy().safety, minimumDelaySeconds: 60, maximumDelaySeconds: 20 },
      { ...examplePolicy().safety, stopOnChallenge: "false" },
    ]) {
      assert.throws(() => parsePolicy({ ...examplePolicy(), safety }));
    }
  });
});
