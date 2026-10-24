import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppConfig } from "../src/config.js";
import type { ReviewRecord } from "../src/domain.js";
import { appendReviewRecords, sheetsConfigured, type SheetsRequester } from "../src/review/google-sheets.js";
import { examplePolicy } from "./helpers.js";

function config(): AppConfig {
  return {
    env: {
      LINK_MODEL_PROVIDER: "openai", LINK_MODEL: "synthetic-model", LINK_POLICY_PATH: "config/policy.example.json",
      LINK_DATABASE_PATH: "data/test.sqlite", LINK_BROWSER_PROFILE: "browser-profile",
      LINK_CHROME_EXECUTABLE: "unused", LINK_LOG_LEVEL: "info", LINK_VALIDATION_MODE: true,
      LINK_AUTO_SEND: false, LINK_AUTO_MARK_READ: false, GOOGLE_CLIENT_ID: "synthetic-client",
      GOOGLE_CLIENT_SECRET: "synthetic-secret", GOOGLE_REFRESH_TOKEN: "synthetic-token",
      LINK_GOOGLE_TOKEN_PATH: ".link/test-token.json", LINK_GOOGLE_SHEET_ID: "synthetic-sheet",
      LINK_GOOGLE_SHEET_TAB: "Owner's Review",
    },
    policy: examplePolicy(),
    paths: { policy: "unused", database: "unused", browserProfile: "unused", launchApproval: "unused", historicalApproval: "unused", onboardingState: "unused" },
  };
}

const record: ReviewRecord = {
  batchId: "batch-1", conversationId: "conversation-1", conversationUrl: "https://example.com/thread/1",
  senderName: "Alex Example", senderHeadline: "Synthetic sender", receivedAt: "2026-01-01T00:00:00Z",
  inboundMessage: "=not a formula", context: "Synthetic context", category: "unknown", confidence: 0.5,
  rationale: "Needs review", proposedActions: "escalate", proposedResponse: "", escalation: "Yes", ownerFeedback: "",
};

describe("small Google Sheets adapter", () => {
  it("writes headers only when absent and preserves the 15-column RAW contract", async () => {
    const calls: Parameters<SheetsRequester>[0][] = [];
    const requester: SheetsRequester = async (request) => { calls.push(request); return { data: {} }; };
    await appendReviewRecords(config(), [record], requester);
    assert.deepEqual(calls.map((call) => call.method), ["GET", "PUT", "POST"]);
    assert.equal(calls[0].url, `https://sheets.googleapis.com/v4/spreadsheets/synthetic-sheet/values/${encodeURIComponent("'Owner''s Review'!A1:O1")}`);
    assert.equal(calls[1].data?.values[0].length, 15);
    assert.equal(calls[2].url.endsWith(`${encodeURIComponent("'Owner''s Review'!A:O")}:append`), true);
    assert.deepEqual(calls[2].params, { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" });
    assert.deepEqual(calls[2].data?.values[0], [
      record.batchId, record.conversationId, record.conversationUrl, record.senderName, record.senderHeadline,
      record.receivedAt, record.inboundMessage, record.context, record.category, record.confidence,
      record.rationale, record.proposedActions, record.proposedResponse, record.escalation, record.ownerFeedback,
    ]);
    assert.ok(calls.every((call) => call.retry === false && call.timeout === 30_000));
  });

  it("does not overwrite existing headers or feedback", async () => {
    const calls: Parameters<SheetsRequester>[0][] = [];
    await appendReviewRecords(config(), [record], async (request) => {
      calls.push(request);
      return { data: { values: [["Existing header"]] } };
    });
    assert.deepEqual(calls.map((call) => call.method), ["GET", "POST"]);
  });

  it("does not retry an uncertain append failure", async () => {
    let appendCalls = 0;
    await assert.rejects(appendReviewRecords(config(), [record], async (request) => {
      if (request.method === "POST") { appendCalls++; throw new Error("Synthetic uncertain write"); }
      return { data: { values: [["Existing header"]] } };
    }), /uncertain write/);
    assert.equal(appendCalls, 1);
  });

  it("does not contact Google when disabled or given no records", async () => {
    const requester: SheetsRequester = async () => { assert.fail("Unexpected Google request"); };
    const disabled = config();
    disabled.env.GOOGLE_CLIENT_ID = undefined;
    assert.equal(sheetsConfigured(disabled), false);
    await appendReviewRecords(disabled, [record], requester);
    await appendReviewRecords(config(), [], requester);
  });
});
