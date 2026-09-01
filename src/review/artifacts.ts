import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ReviewRecord } from "../domain.js";

export async function writeReviewArtifact(records: ReviewRecord[], batchId: string): Promise<string> {
  const path = resolve(`artifacts/review-${batchId}.jsonl`);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, "", { mode: 0o600 });
  if (records.length) await appendFile(path, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
  return path;
}
