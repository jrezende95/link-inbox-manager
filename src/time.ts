import { DateTime } from "luxon";

export function parseLinkedInTimestamp(raw: string | undefined, timezone: string, now = DateTime.now().setZone(timezone)): DateTime | null {
  if (!raw?.trim()) return null;
  const zonedNow = now.setZone(timezone);
  const value = raw.replace(/^\s*[•·]\s*/, "").trim();
  const iso = DateTime.fromISO(value, { setZone: true });
  if (iso.isValid) return iso;
  const today = zonedNow.startOf("day");
  const timeOnly = DateTime.fromFormat(value, "h:mm a", { zone: timezone, locale: "en-US" });
  if (timeOnly.isValid) return today.set({ hour: timeOnly.hour, minute: timeOnly.minute });
  const relative = value.match(/^(Today|Yesterday)(?:\s+at\s+(\d{1,2}:\d{2}\s+[AP]M))?$/i);
  if (relative) {
    let day = relative[1].toLowerCase() === "yesterday" ? today.minus({ days: 1 }) : today;
    if (relative[2]) {
      const time = DateTime.fromFormat(relative[2].toUpperCase(), "h:mm a", { zone: timezone, locale: "en-US" });
      if (time.isValid) day = day.set({ hour: time.hour, minute: time.minute });
    }
    return day;
  }
  const normalized = value.replace(/\s+at\s+/i, ", ");
  for (const format of ["MMM d, yyyy, h:mm a", "MMMM d, yyyy, h:mm a", "MMM d, h:mm a", "MMMM d, h:mm a", "MMM d, yyyy", "MMMM d, yyyy", "MMM d", "MMMM d"]) {
    const parsed = DateTime.fromFormat(normalized, format, { zone: timezone, locale: "en-US" });
    if (!parsed.isValid) continue;
    if (format.includes("yyyy")) return parsed;
    let inferred = parsed.set({ year: zonedNow.year });
    if (inferred > zonedNow.plus({ days: 1 })) inferred = inferred.minus({ years: 1 });
    return inferred;
  }
  return null;
}

export function withinLookback(timestamp: string | undefined, days: number, timezone: string): boolean {
  const parsed = parseLinkedInTimestamp(timestamp, timezone);
  return Boolean(parsed?.isValid && parsed >= DateTime.now().setZone(timezone).minus({ days }));
}

export function olderThan(timestamp: string | undefined, days: number, timezone: string): boolean {
  const parsed = parseLinkedInTimestamp(timestamp, timezone);
  return Boolean(parsed?.isValid && parsed < DateTime.now().setZone(timezone).minus({ days }));
}
