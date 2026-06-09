import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Java mínimo por versión de Minecraft */
export function requiredJavaMajor(mcVersion) {
  const parts = mcVersion.split(".");
  const minor = parseInt(parts[1] ?? "0", 10);
  if (minor >= 18) return 17;
  if (minor === 17) return 16;
  return 8;
}

function parseJavaMajor(output) {
  const m = output.match(/version "(?:1\.)?(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function probeJava(javaPath) {
  try {
    const result = spawnSync(javaPath, ["-version"], {
      encoding: "utf8",
      timeout: 15_000,
      windowsHide: true,
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (!output.trim()) return null;
    const major = parseJavaMajor(output);
    if (!major) return null;
    return {
      path: javaPath,
      major,
      label: output.split("\n")[0]?.trim() ?? `Java ${major}`,
    };
  } catch {
    return null;
  }
}

function collectJavaCandidates() {
  const seen = new Set();
  const list = [];

  function add(p) {
    const norm = path.normalize(p);
    if (seen.has(norm)) return;
    seen.add(norm);
    list.push(norm);
  }

  add("java");

  if (process.platform === "win32") {
    const roots = [
      process.env["ProgramFiles"],
      process.env["ProgramFiles(x86)"],
      path.join(process.env.LOCALAPPDATA ?? "", "Programs"),
    ].filter(Boolean);

    const folderNames = ["Eclipse Adoptium", "Java", "Microsoft", "Zulu", "BellSoft", "Amazon Corretto"];

    for (const root of roots) {
      for (const name of folderNames) {
        const base = path.join(root, name);
        if (!fs.existsSync(base)) continue;
        try {
          for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            add(path.join(base, entry.name, "bin", "java.exe"));
          }
        } catch {
          /* ignore */
        }
      }
    }

    try {
      const where = execSync("where java", { encoding: "utf8" }).trim().split(/\r?\n/);
      for (const line of where) add(line.trim());
    } catch {
      /* ignore */
    }
  }

  return list;
}

/** Busca Java que cumpla el mínimo para la versión MC */
export function resolveJavaForMinecraft(mcVersion) {
  const minMajor = requiredJavaMajor(mcVersion);
  let best = null;

  for (const candidate of collectJavaCandidates()) {
    const info = probeJava(candidate);
    if (!info || info.major < minMajor) continue;
    if (!best || info.major > best.major) best = info;
  }

  return { minMajor, java: best };
}

export function formatJavaRequirement(mcVersion) {
  const min = requiredJavaMajor(mcVersion);
  return `Java ${min} o superior (https://adoptium.net)`;
}
