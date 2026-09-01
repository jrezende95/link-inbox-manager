import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

if (process.platform !== "darwin") throw new Error("The first release supports macOS only.");
const uid = process.getuid?.();
if (uid === undefined) throw new Error("Unable to resolve the macOS user id.");
const label = "io.link-inbox-manager";
const plist = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
try { execFileSync("/bin/launchctl", ["bootout", `gui/${uid}/${label}`], { stdio: "ignore" }); }
catch { /* Already stopped. */ }
rmSync(plist, { force: true });
console.log(JSON.stringify({ uninstalled: true, plist }, null, 2));
