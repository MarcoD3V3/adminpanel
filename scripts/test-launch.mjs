#!/usr/bin/env node
import { launchForgeMinecraft } from "../packages/launcher/electron/minecraft-launcher.mjs";

process.env.CRAFTLAUNCHER_DATA_DIR = process.env.CRAFTLAUNCHER_DATA_DIR || "C:\\Users\\sinis\\.craftlauncher";
process.env.CRAFTLAUNCHER_USER_DATA = process.env.CRAFTLAUNCHER_USER_DATA || process.env.CRAFTLAUNCHER_DATA_DIR;
process.env.CRAFTLAUNCHER_WORKER = "1";

const lines = [];
await launchForgeMinecraft(
  "1.18.2-forge",
  (p) => {
    if (p.message) lines.push(`[${p.stage ?? "?"}] ${p.message}`);
    if (lines.length <= 50 || p.stage === "error" || p.stage === "close") {
      console.log(`[${p.stage}]`, p.message?.slice(0, 500) ?? "");
    }
  },
  { waitForClose: true, instanceId: "ashe" }
).catch((e) => console.error("LAUNCH ERR", e));

console.log("--- last lines ---");
console.log(lines.slice(-15).join("\n"));
