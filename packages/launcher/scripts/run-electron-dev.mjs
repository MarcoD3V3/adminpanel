/**
 * Arranca Vite + Electron en desarrollo.
 * --prod-api  → admin Railway (VITE_ADMIN_API_URL), sin priorizar local
 * --devtools  → abre DevTools al iniciar (también con --prod-api)
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const launcherRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const concurrentlyPkg = path.dirname(require.resolve("concurrently/package.json"));
const concurrentlyBin = path.join(concurrentlyPkg, "dist", "bin", "concurrently.js");

const prodApi = process.argv.includes("--prod-api");
const devtools = process.argv.includes("--devtools") || prodApi;

const env = { ...process.env };
if (prodApi) env.VITE_ADMIN_API_PREFER_LOCAL = "false";
if (devtools) env.CRAFTLAUNCHER_OPEN_DEVTOOLS = "1";

const freePort = spawnSync(process.execPath, ["scripts/free-port.mjs", "1420"], {
  cwd: launcherRoot,
  env,
  stdio: "inherit",
});
if (freePort.status !== 0 && freePort.status != null) process.exit(freePort.status);

// http:// (no tcp:127.0.0.1) — en Windows Vite suele escuchar solo en ::1.
const electronCmd =
  "wait-on http://localhost:1420 && nodemon --watch electron --ext mjs --exec electron .";

const child = spawn(
  process.execPath,
  [concurrentlyBin, "-k", "vite", electronCmd],
  {
    cwd: launcherRoot,
    env,
    stdio: "inherit",
    shell: false,
  }
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
