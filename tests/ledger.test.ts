import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
    expect(ledger.hasDecision(input.id, input.latestInbound.id)).toBe(true);
    expect(ledger.pendingActions()).toHaveLength(1);
    ledger.close();
  });

  it("persists permanent owner handoff", () => {
    const ledger = new Ledger(join(mkdtempSync(join(tmpdir(), "link-test-")), "ledger.sqlite"));
    const input = conversation();
    ledger.upsertConversation(input);
    const classification = { categoryId: "personal_outreach", confidence: 0.99, rationale: "Synthetic personal outreach", promptInjectionDetected: false, extractedFacts: {}, fit: "not_applicable" as const, publicFitReason: null };
    const decision = { categoryId: "personal_outreach", actions: ["escalate" as const], autoSend: false, draft: null, escalationReason: "Synthetic personal outreach", permanentHandoff: true };
    ledger.recordDecision(input, classification, decision);
    expect(ledger.isOwnerControlled(input.id)).toBe(true);
    ledger.close();
  });
});
