import { DateTime } from "luxon";
import type { Logger } from "pino";
import type { LinkPolicy } from "./policy-schema.js";

function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }

export async function daemon(policy: LinkPolicy, logger: Logger, runOnce: () => Promise<void>): Promise<never> {
  const completed = new Set<string>();
  for (;;) {
    const now = DateTime.now().setZone(policy.owner.timezone);
    const key = now.toFormat("yyyy-LL-dd-HH");
    if (policy.schedule.hours.includes(now.hour) && !completed.has(key)) {
      completed.add(key);
      try { await runOnce(); }
      catch (error) { logger.error({ err: error }, "scheduled run failed"); }
    }
    for (const prior of completed) if (!prior.startsWith(now.toFormat("yyyy-LL-dd"))) completed.delete(prior);
    await sleep(30_000);
  }
}
