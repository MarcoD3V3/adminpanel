import { execSync } from "node:child_process";

const port = process.argv[2] ?? "1420";

if (process.platform === "win32") {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/LISTENING\s+(\d+)\s*$/i);
      if (m) pids.add(m[1]);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        console.log(`[free-port] Liberado puerto ${port} (PID ${pid})`);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* puerto libre */
  }
} else {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { shell: true, stdio: "ignore" });
  } catch {
    /* ignore */
  }
}
