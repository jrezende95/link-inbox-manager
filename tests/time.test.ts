import { DateTime } from "luxon";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { olderThan, parseLinkedInTimestamp } from "../src/time.js";

describe("LinkedIn display timestamps", () => {
  const now = DateTime.fromISO("2026-09-01T12:00:00-07:00");

  it("parses same-day display times", () => {
    assert.equal(parseLinkedInTimestamp("9:15 AM", "America/Los_Angeles", now)?.toISO(), "2026-09-01T09:15:00.000-07:00");
  });

  it("parses month and day in the current year", () => {
    assert.equal(parseLinkedInTimestamp("Aug 20", "America/Los_Angeles", now)?.toISODate(), "2026-08-20");
  });

  it("parses yesterday labels", () => {
    assert.equal(parseLinkedInTimestamp("Yesterday at 4:30 PM", "America/Los_Angeles", now)?.toISO(), "2026-08-31T16:30:00.000-07:00");
  });

  it("detects old ISO timestamps", () => {
    assert.equal(olderThan("2020-01-01T12:00:00-08:00", 30, "America/Los_Angeles"), true);
  });
});
