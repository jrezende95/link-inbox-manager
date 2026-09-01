import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

if (process.platform !== "darwin") throw new Error("The first release supports macOS only.");
const uid = process.getuid?.();
if (uid === undefined) throw new Error("Unable to resolve the macOS user id.");

const repo = resolve(".");
const node = process.execPath;
const tsx = resolve("node_modules/tsx/dist/cli.mjs");
const cli = resolve("src/cli.ts");
const label = "io.link-inbox-manager";
const plist = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
const logs = join(homedir(), "Library", "Logs", "LinkInboxManager");

function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

mkdirSync(dirname(plist), { recursive: true });
mkdirSync(logs, { recursive: true, mode: 0o700 });
const contents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array>
    <string>${xml(node)}</string><string>${xml(tsx)}</string><string>${xml(cli)}</string><string>daemon</string>
  </array>
  <key>WorkingDirectory</key><string>${xml(repo)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${xml(join(logs, "service.log"))}</string>
  <key>StandardErrorPath</key><string>${xml(join(logs, "service-error.log"))}</string>
</dict></plist>
`;
writeFileSync(plist, contents, { mode: 0o600 });
try { execFileSync("/bin/launchctl", ["bootout", `gui/${uid}/${label}`], { stdio: "ignore" }); }
catch { /* Not installed yet. */ }
execFileSync("/bin/launchctl", ["bootstrap", `gui/${uid}`, plist], { stdio: "inherit" });
console.log(JSON.stringify({ installed: true, plist, workingDirectory: repo, logs }, null, 2));
