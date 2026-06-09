import fs from "node:fs";
import path from "node:path";

const CACHE_FILE = "java-resolved.json";

export function readJavaCache(userDataRoot) {
  const file = path.join(userDataRoot, CACHE_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!data?.path || !fs.existsSync(data.path)) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeJavaCache(userDataRoot, info) {
  fs.mkdirSync(userDataRoot, { recursive: true });
  fs.writeFileSync(
    path.join(userDataRoot, CACHE_FILE),
    JSON.stringify(
      {
        path: info.path,
        major: info.major,
        source: info.source ?? "unknown",
        at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );
}
