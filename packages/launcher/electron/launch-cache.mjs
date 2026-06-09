import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const ASSET_MARKER = ".craftlauncher-assets-ok";
const LIB_MARKER = ".craftlauncher-libraries-ok";

export function sharedMinecraftCache(dataDir, mcVersion) {
  return path.join(dataDir, "cache", mcVersion);
}

export function readMarker(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function isAssetsVerified(assetRoot, assetId) {
  const markerPath = path.join(assetRoot, ASSET_MARKER);
  const marker = readMarker(markerPath);
  if (!marker || marker.id !== assetId) return false;

  const indexPath = path.join(assetRoot, "indexes", `${assetId}.json`);
  if (!fs.existsSync(indexPath)) return false;

  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    return Object.keys(index.objects ?? {}).length === marker.count;
  } catch {
    return false;
  }
}

export function markAssetsVerified(assetRoot, assetId) {
  const indexPath = path.join(assetRoot, "indexes", `${assetId}.json`);
  if (!fs.existsSync(indexPath)) return;
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    fs.mkdirSync(assetRoot, { recursive: true });
    fs.writeFileSync(
      path.join(assetRoot, ASSET_MARKER),
      JSON.stringify({
        id: assetId,
        count: Object.keys(index.objects ?? {}).length,
        at: new Date().toISOString(),
      }),
      "utf8"
    );
  } catch {
    /* ignore */
  }
}

export function isLibrariesVerified(libraryRoot) {
  return fs.existsSync(path.join(libraryRoot, LIB_MARKER));
}

const LEGACY_ESSENTIAL_LIBS = [
  "net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar",
  "com/google/guava/guava/21.0/guava-21.0.jar",
  "com/mojang/patchy/1.3.9/patchy-1.3.9.jar",
  "net/java/dev/jna/jna/4.4.0/jna-4.4.0.jar",
];

function countLibraryJars(libraryRoot) {
  let count = 0;
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith(".jar")) count += 1;
    }
  };
  try {
    walk(libraryRoot);
  } catch {
    return 0;
  }
  return count;
}

/** Comprueba JARs críticos (evita marcar caché lista con solo Forge + launchwrapper). */
export function essentialLibrariesPresent(libraryRoot, mcVersion) {
  if (!libraryRoot || !fs.existsSync(libraryRoot)) return false;
  const minor = parseInt(String(mcVersion ?? "").split(".")[1] ?? "0", 10);

  if (minor > 0 && minor <= 12) {
    for (const rel of LEGACY_ESSENTIAL_LIBS) {
      if (!fs.existsSync(path.join(libraryRoot, rel))) return false;
    }
    if (!legacyForgeLibsPresent(libraryRoot)) return false;
    return countLibraryJars(libraryRoot) >= 30;
  }

  const fwJar = path.join(
    libraryRoot,
    "io/github/zekerzhayard/ForgeWrapper/1.6.0/ForgeWrapper-1.6.0.jar"
  );
  if (minor > 12 && (!fs.existsSync(fwJar) || fs.statSync(fwJar).size < 5000)) {
    return false;
  }

  return countLibraryJars(libraryRoot) >= 25;
}

export function invalidateLibraryMarkerIfIncomplete(libraryRoot, mcVersion) {
  if (!isLibrariesVerified(libraryRoot)) return;
  if (!essentialLibrariesPresent(libraryRoot, mcVersion)) {
    try {
      fs.unlinkSync(path.join(libraryRoot, LIB_MARKER));
    } catch {
      /* ignore */
    }
  }
}

export function markLibrariesVerified(libraryRoot) {
  fs.mkdirSync(libraryRoot, { recursive: true });
  fs.writeFileSync(
    path.join(libraryRoot, LIB_MARKER),
    JSON.stringify({ at: new Date().toISOString() }),
    "utf8"
  );
}

export function bootstrapAssetMarkerIfPresent(assetRoot, assetId) {
  if (isAssetsVerified(assetRoot, assetId)) return true;

  const indexPath = path.join(assetRoot, "indexes", `${assetId}.json`);
  if (!fs.existsSync(indexPath)) return false;

  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    const objects = index.objects ?? {};
    const keys = Object.keys(objects);
    if (keys.length < 50) return false;

    const sample = keys.filter((_, i) => i % Math.max(1, Math.floor(keys.length / 24)) === 0);
    for (const key of sample) {
      const hash = objects[key].hash;
      const file = path.join(assetRoot, "objects", hash.substring(0, 2), hash);
      if (!fs.existsSync(file)) return false;
    }

    markAssetsVerified(assetRoot, assetId);
    return true;
  } catch {
    return false;
  }
}

export function legacyForgeLibsPresent(libraryRoot) {
  if (!libraryRoot || !fs.existsSync(libraryRoot)) return false;
  return (
    fs.existsSync(path.join(libraryRoot, "net", "minecraft", "launchwrapper")) &&
    fs.existsSync(path.join(libraryRoot, "net", "minecraftforge", "forge"))
  );
}

function pickLibraryRoot(instanceLibs, sharedLibs, mcVersion) {
  const instanceReady = essentialLibrariesPresent(instanceLibs, mcVersion);
  const sharedReady = essentialLibrariesPresent(sharedLibs, mcVersion);

  if (instanceReady && !sharedReady) return instanceLibs;
  if (sharedReady && !instanceReady) return sharedLibs;
  if (legacyForgeLibsPresent(instanceLibs) && !legacyForgeLibsPresent(sharedLibs)) return instanceLibs;
  if (legacyForgeLibsPresent(sharedLibs) && !legacyForgeLibsPresent(instanceLibs)) return sharedLibs;
  if (fs.existsSync(instanceLibs)) return instanceLibs;
  return sharedLibs;
}

export function bootstrapLibraryMarkerIfPresent(libraryRoot, mcVersion) {
  invalidateLibraryMarkerIfIncomplete(libraryRoot, mcVersion);
  if (!essentialLibrariesPresent(libraryRoot, mcVersion)) return false;
  if (isLibrariesVerified(libraryRoot)) return true;
  markLibrariesVerified(libraryRoot);
  return true;
}

export async function prepareLaunchCache(instanceRoot, dataDir, mcVersion) {
  applyMclcFastLaunchPatch();

  const sharedRoot = sharedMinecraftCache(dataDir, mcVersion);
  await new Promise((r) => setImmediate(r));

  bootstrapAssetMarkerIfPresent(path.join(instanceRoot, "assets"), mcVersion);
  await new Promise((r) => setImmediate(r));
  bootstrapLibraryMarkerIfPresent(path.join(instanceRoot, "libraries"), mcVersion);
  await new Promise((r) => setImmediate(r));

  bootstrapAssetMarkerIfPresent(path.join(sharedRoot, "assets"), mcVersion);
  await new Promise((r) => setImmediate(r));
  bootstrapLibraryMarkerIfPresent(path.join(sharedRoot, "libraries"), mcVersion);

  return inspectLaunchCache(instanceRoot, dataDir, mcVersion);
}

export function resolveMinecraftCachePaths(instanceRoot, dataDir, mcVersion) {
  const sharedRoot = sharedMinecraftCache(dataDir, mcVersion);
  const sharedAssets = path.join(sharedRoot, "assets");
  const sharedLibs = path.join(sharedRoot, "libraries");
  const instanceAssets = path.join(instanceRoot, "assets");
  const instanceLibs = path.join(instanceRoot, "libraries");

  const instanceHasAssets = fs.existsSync(
    path.join(instanceAssets, "indexes", `${mcVersion}.json`)
  );
  const sharedHasAssets = fs.existsSync(
    path.join(sharedAssets, "indexes", `${mcVersion}.json`)
  );

  const libraryRoot = pickLibraryRoot(instanceLibs, sharedLibs, mcVersion);

  let assetRoot = sharedAssets;
  if (isAssetsVerified(sharedAssets, mcVersion) || sharedHasAssets) {
    assetRoot = sharedAssets;
  } else if (instanceHasAssets) {
    assetRoot = instanceAssets;
  } else {
    fs.mkdirSync(sharedRoot, { recursive: true });
    assetRoot = sharedAssets;
  }

  return {
    assetRoot,
    libraryRoot,
    sharedRoot,
    legacyInstancePaths: libraryRoot === instanceLibs,
  };
}

export function inspectLaunchCache(instanceRoot, dataDir, mcVersion) {
  const paths = resolveMinecraftCachePaths(instanceRoot, dataDir, mcVersion);
  const { assetRoot, libraryRoot } = paths;
  const forgeJson = path.join(instanceRoot, "forge", mcVersion, "version.json");
  const assetsReady = isAssetsVerified(assetRoot, mcVersion);
  const libsReady = essentialLibrariesPresent(libraryRoot, mcVersion);
  const forgeReady = fs.existsSync(forgeJson);

  return {
    ...paths,
    assetsReady,
    libsReady,
    forgeReady,
    quickLaunch: assetsReady && libsReady && forgeReady,
    firstLaunch: !assetsReady || !libsReady || !forgeReady,
  };
}

/** Parchea MCLC para omitir re-escaneo SHA1 de miles de assets si ya se verificaron. */
export function applyMclcFastLaunchPatch() {
  if (applyMclcFastLaunchPatch._applied) return;
  applyMclcFastLaunchPatch._applied = true;

  const Handler = require("minecraft-launcher-core/components/handler.js");
  const origGetAssets = Handler.prototype.getAssets;
  const origDownloadToDirectory = Handler.prototype.downloadToDirectory;

  Handler.prototype.getAssets = async function patchedGetAssets() {
    const assetDirectory = path.resolve(
      this.options.overrides.assetRoot || path.join(this.options.root, "assets")
    );
    const assetId = this.options.version.custom || this.options.version.number;

    if (isAssetsVerified(assetDirectory, assetId)) {
      this.client.emit("debug", "[CraftLauncher] Atlas en caché — omitiendo verificación SHA1");
      this.client.emit("progress", { type: "assets", task: 1, total: 1, current: 1 });
      return;
    }

    await origGetAssets.call(this);
    markAssetsVerified(assetDirectory, assetId);
  };

  Handler.prototype.downloadToDirectory = async function patchedDownloadToDirectory(
    directory,
    libraries,
    eventName
  ) {
    const libraryDirectory = path.resolve(directory);
    const mcVersion = this.options.version?.number ?? "";
    const skipVerify =
      typeof eventName === "string" &&
      eventName.includes("classes") &&
      essentialLibrariesPresent(libraryDirectory, mcVersion);

    if (skipVerify) {
      const present = [];
      const missing = [];
      for (const library of libraries) {
        if (!library || this.parseRule(library)) continue;
        const lib = library.name.split(":");
        let jarPath;
        let name;
        if (library.downloads?.artifact?.path) {
          name = library.downloads.artifact.path.split("/").pop();
          jarPath = path.join(libraryDirectory, this.popString(library.downloads.artifact.path));
        } else {
          name = `${lib[1]}-${lib[2]}${lib[3] ? `-${lib[3]}` : ""}.jar`;
          jarPath = path.join(libraryDirectory, `${lib[0].replace(/\./g, "/")}/${lib[1]}/${lib[2]}`);
        }
        const full = path.join(jarPath, name);
        if (fs.existsSync(full)) present.push(full);
        else missing.push(library);
      }

      if (missing.length > 0) {
        this.client.emit(
          "debug",
          `[CraftLauncher] Faltan ${missing.length} librerías (p. ej. ForgeWrapper) — descargando…`
        );
        const downloaded = await origDownloadToDirectory.call(this, directory, missing, eventName);
        return [...present, ...(downloaded ?? [])];
      }

      this.client.emit("debug", "[CraftLauncher] Librerías en caché — omitiendo verificación SHA1");
      this.client.emit("progress", {
        type: eventName,
        task: libraries.length,
        total: libraries.length,
        current: libraries.length,
      });
      return present;
    }

    const result = await origDownloadToDirectory.call(this, directory, libraries, eventName);
    if (
      typeof eventName === "string" &&
      eventName.includes("classes") &&
      essentialLibrariesPresent(libraryDirectory, mcVersion)
    ) {
      markLibrariesVerified(libraryDirectory);
    }
    return result;
  };
}

applyMclcFastLaunchPatch._applied = false;
