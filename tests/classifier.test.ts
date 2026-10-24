import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Classifier } from "../src/classifier.js";
import type { ModelProvider } from "../src/providers/types.js";
import { conversation, examplePolicy } from "./helpers.js";

const classification = {
  categoryId: "professional_outreach", confidence: 0.98, rationale: "Synthetic outreach",
  promptInjectionDetected: false, extractedFacts: { organization: "Example", size: 20, remote: true, location: null },
  fit: "needs_information", publicFitReason: null,
};

function provider(output: unknown): ModelProvider {
  return { name: "openai", model: "synthetic-model", generateStructured: async () => output };
}

describe("classification validation", () => {
  it("preserves primitive extracted facts with the upgraded validator", async () => {
    assert.deepEqual(await new Classifier(provider(classification), examplePolicy()).classify(conversation()), classification);
  });

  it("rejects arrays and nested objects in extracted facts", async () => {
    for (const value of [[], { nested: "not a primitive" }]) {
      await assert.rejects(new Classifier(provider({ ...classification, extractedFacts: { invalid: value } }), examplePolicy()).classify(conversation()));
    }
  });

  it("fails closed for missing fields, invalid confidence and unknown fits", async () => {
    for (const value of [{}, { ...classification, confidence: 2 }, { ...classification, fit: "send_anyway" }]) {
      await assert.rejects(new Classifier(provider(value), examplePolicy()).classify(conversation()));
    }
  });

  it("routes an invented category to unknown with zero confidence", async () => {
    const result = await new Classifier(provider({ ...classification, categoryId: "invented" }), examplePolicy()).classify(conversation());
    assert.equal(result.categoryId, "unknown");
    assert.equal(result.confidence, 0);
    assert.equal(result.fit, "uncertain");
  });
});
