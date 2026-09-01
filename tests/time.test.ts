import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { olderThan, parseLinkedInTimestamp } from "../src/time.js";

describe("LinkedIn display timestamps", () => {
  const now = DateTime.fromISO("2026-09-01T12:00:00-07:00");

  it("parses same-day display times", () => {
    expect(parseLinkedInTimestamp("9:15 AM", "America/Los_Angeles", now)?.toISO()).toBe("2026-09-01T09:15:00.000-07:00");
  });

  it("parses month and day in the current year", () => {
    expect(parseLinkedInTimestamp("Aug 20", "America/Los_Angeles", now)?.toISODate()).toBe("2026-08-20");
  });

  it("parses yesterday labels", () => {
    expect(parseLinkedInTimestamp("Yesterday at 4:30 PM", "America/Los_Angeles", now)?.toISO()).toBe("2026-08-31T16:30:00.000-07:00");
  });

  it("detects old ISO timestamps", () => {
    expect(olderThan("2020-01-01T12:00:00-08:00", 30, "America/Los_Angeles")).toBe(true);
  });
});
