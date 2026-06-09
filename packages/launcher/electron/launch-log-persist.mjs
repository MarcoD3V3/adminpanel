import fs from "node:fs";
import path from "node:path";

const FILE_NAME = "launch-session-log.json";

export function launchLogFile(userDataRoot) {
  return path.join(userDataRoot, FILE_NAME);
}

export function saveLaunchLog(userDataRoot, data) {
  const file = launchLogFile(userDataRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = {
    savedAt: new Date().toISOString(),
    versionLabel: data.versionLabel ?? "",
    message: data.message ?? "",
    phase: data.phase ?? "closed",
    percent: data.percent ?? null,
    logs: Array.isArray(data.logs) ? data.logs.slice(-200) : [],
    structuredLogs: Array.isArray(data.structuredLogs) ? data.structuredLogs.slice(-120) : [],
    metrics: data.metrics ?? null,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
  return payload;
}

export function loadLaunchLog(userDataRoot) {
  const file = launchLogFile(userDataRoot);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}
