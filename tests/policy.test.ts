import { describe, expect, it } from "vitest";
import { parsePolicy } from "../src/policy-schema.js";
import { examplePolicy } from "./helpers.js";

describe("private policy schema", () => {
  it("accepts the sanitized starter policy", () => {
    const policy = examplePolicy();
    expect(policy.categories.map((category) => category.id)).toContain("unknown");
    expect(policy.categories.every((category) => category.autoSend === false)).toBe(true);
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
    expect(parsePolicy(input).categories.at(-1)?.id).toBe("community_invitation");
  });

  it("requires an old-message policy beyond 30 days", () => {
    const input = examplePolicy();
    input.validation.historicalLookbackDays = 31;
    input.validation.olderMessageGuidance = null;
    expect(() => parsePolicy(input)).toThrow(/older-message guidance/i);
  });

  it("rejects duplicate category ids", () => {
    const input = examplePolicy();
    input.categories.push({ ...input.categories[0] });
    expect(() => parsePolicy(input)).toThrow(/duplicate category id/i);
  });
});
