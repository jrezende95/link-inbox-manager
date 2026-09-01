import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const tracked = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" })
  .split(/\r?\n/).filter(Boolean);
const textExtensions = new Set([".ts", ".js", ".json", ".md", ".yml", ".yaml", ".txt", ".example", ""]);
const findings: Array<{ file: string; rule: string }> = [];
const rules: Array<{ name: string; pattern: RegExp; allow?: (match: string) => boolean }> = [
  { name: "absolute-mac-user-path", pattern: /\/Users\/[A-Za-z0-9._-]+\//g },
  { name: "linkedin-profile-url", pattern: /https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_%=-]+/gi },
  { name: "private-api-key", pattern: /\b(?:sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g },
  { name: "non-example-email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, allow: (match) => /@example\.(?:com|org|net)$/i.test(match) || /@users\.noreply\.github\.com$/i.test(match) },
];

for (const file of tracked) {
  if (file === "package-lock.json") continue;
  if (!textExtensions.has(extname(file)) && !file.endsWith(".env.example")) continue;
  if (/^(?:node_modules|dist|artifacts|data|browser-profile|credentials)\//.test(file)) {
    findings.push({ file, rule: "private-runtime-path-tracked" });
    continue;
  }
  const content = readFileSync(file, "utf8");
  for (const rule of rules) {
    for (const match of content.matchAll(rule.pattern)) {
      if (!rule.allow?.(match[0])) findings.push({ file, rule: rule.name });
    }
  }
}

if (findings.length) {
  console.error(JSON.stringify({ ok: false, findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, filesScanned: tracked.length, telemetry: "none" }, null, 2));
