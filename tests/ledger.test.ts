import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Ledger } from "../src/ledger.js";
import { conversation } from "./helpers.js";

describe("local ledger", () => {
  it("deduplicates decisions and pending actions by inbound message", () => {
    const ledger = new Ledger(join(mkdtempSync(join(tmpdir(), "link-test-")), "ledger.sqlite"));
    const input = conversation();
    ledger.upsertConversation(input);
    const classification = { categoryId: "unknown", confidence: 0.5, rationale: "Unclear", promptInjectionDetected: false, extractedFacts: {}, fit: "uncertain" as const, publicFitReason: null };
    const decision = { categoryId: "unknown", actions: ["escalate" as const], autoSend: false, draft: null, escalationReason: "Unclear", permanentHandoff: false };
    ledger.recordDecision(input, classification, decision);
    ledger.recordDecision(input, classification, decision);
    ledger.queueAction(input, decision);
    ledger.queueAction(input, decision);
    assert.equal(ledger.hasDecision(input.id, input.latestInbound.id), true);
    assert.equal(ledger.pendingActions().length, 1);
    ledger.close();
  });

  it("persists permanent owner handoff", () => {
    const ledger = new Ledger(join(mkdtempSync(join(tmpdir(), "link-test-")), "ledger.sqlite"));
    const input = conversation();
    ledger.upsertConversation(input);
    const classification = { categoryId: "personal_outreach", confidence: 0.99, rationale: "Synthetic personal outreach", promptInjectionDetected: false, extractedFacts: {}, fit: "not_applicable" as const, publicFitReason: null };
    const decision = { categoryId: "personal_outreach", actions: ["escalate" as const], autoSend: false, draft: null, escalationReason: "Synthetic personal outreach", permanentHandoff: true };
    ledger.recordDecision(input, classification, decision);
    assert.equal(ledger.isOwnerControlled(input.id), true);
    ledger.close();
  });

  it("retains deduplication and human control after a restart", () => {
    const path = join(mkdtempSync(join(tmpdir(), "link-test-")), "ledger.sqlite");
    const ledger = new Ledger(path);
    const input = conversation();
    const classification = { categoryId: "personal_outreach", confidence: 0.99, rationale: "Synthetic personal outreach", promptInjectionDetected: false, extractedFacts: {}, fit: "not_applicable" as const, publicFitReason: null };
    const decision = { categoryId: "personal_outreach", actions: ["escalate" as const], autoSend: false, draft: null, escalationReason: "Owner review", permanentHandoff: true };
    ledger.upsertConversation(input);
    ledger.recordDecision(input, classification, decision);
    ledger.queueAction(input, decision);
    ledger.close();

    const reopened = new Ledger(path);
    try {
      reopened.upsertConversation(input);
      assert.equal(reopened.hasDecision(input.id, input.latestInbound.id), true);
      assert.equal(reopened.isOwnerControlled(input.id), true);
      reopened.queueAction(input, decision);
      assert.equal(reopened.pendingActions().length, 1);
    } finally {
      reopened.close();
    }
  });
});
