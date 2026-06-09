/**
 * Encuentra java.exe en el sistema aunque no esté en PATH (Windows Temurin/Adoptium, JAVA_HOME, registro).
 */
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function parseJavaMajor(output) {
  const m = String(output).match(/version "(?:1\.)?(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export function probeJava(javaPath) {
  if (!javaPath || !fs.existsSync(javaPath)) return null;
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
    return { path: javaPath, major, home: path.dirname(path.dirname(javaPath)) };
  } catch {
    return null;
  }
}

function readWindowsJavaHomes() {
  const exes = [];
  const regRoots = [
    "HKLM\\SOFTWARE\\Eclipse Adoptium\\JDK",
    "HKLM\\SOFTWARE\\Eclipse Adoptium\\JRE",
    "HKLM\\SOFTWARE\\Eclipse Foundation\\JDK",
    "HKLM\\SOFTWARE\\JavaSoft\\JDK",
    "HKLM\\SOFTWARE\\JavaSoft\\JRE",
    "HKLM\\SOFTWARE\\WOW6432Node\\JavaSoft\\JDK",
    "HKLM\\SOFTWARE\\WOW6432Node\\JavaSoft\\JRE",
    "HKLM\\SOFTWARE\\Microsoft\\JDK",
  ];

  for (const root of regRoots) {
    for (const valueName of ["JavaHome", "Path", "InstallationPath"]) {
      try {
        const out = execSync(`reg query "${root}" /s /v ${valueName} 2>nul`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        for (const line of out.split(/\r?\n/)) {
          const m = line.match(new RegExp(`${valueName}\\s+REG_(?:SZ|EXPAND_SZ)\\s+(.+)`, "i"));
          if (!m) continue;
          const home = m[1].trim().replace(/^"|"$/g, "");
          exes.push(/java\.exe$/i.test(home) ? home : path.join(home, "bin", "java.exe"));
        }
      } catch {
        /* key missing */
      }
    }
  }
  return exes;
}

function collectJavaCandidates() {
  const seen = new Set();
  const list = [];

  function add(p) {
    if (!p) return;
    const norm = path.normalize(p);
    if (seen.has(norm)) return;
    seen.add(norm);
    list.push(norm);
  }

  if (process.env.JAVA_HOME) {
    add(path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java"));
  }

  add("java");

  if (process.platform === "win32") {
    for (const exe of readWindowsJavaHomes()) add(exe);

    const roots = [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      path.join(process.env.LOCALAPPDATA ?? "", "Programs"),
    ].filter(Boolean);

    for (const root of roots) {
      for (const vendor of [
        "Eclipse Adoptium",
        "Eclipse Temurin",
        "Eclipse Foundation",
        "Java",
        "Microsoft",
        "Zulu",
        "BellSoft",
        "Amazon Corretto",
        "Temurin",
      ]) {
        const base = path.join(root, vendor);
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
      const lines = execSync("where java", { encoding: "utf8" }).trim().split(/\r?\n/);
      for (const line of lines) add(line.trim());
    } catch {
      /* ignore */
    }
  }

  return list;
}

/** @param {number} [minMajor=17] */
export function findLocalJava(minMajor = 17) {
  const candidates = collectJavaCandidates();
  let best = null;

  for (const candidate of candidates) {
    const info = candidate === "java" ? probeJava("java") : probeJava(candidate);
    if (!info || info.major < minMajor) continue;
    if (!best || info.major < best.major) best = info;
    if (info.major === minMajor) return info;
  }

  return best;
}
