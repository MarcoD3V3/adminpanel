import fs from "node:fs";
import path from "node:path";
import pkg from "adm-zip";
import { getActiveInstance, updateInstance } from "./instances.mjs";
import {
  instanceDir,
  instanceGameRoot,
  instanceModsDir,
  instanceResourcePacksDir,
  resolveDataDir,
} from "./launcher-paths.mjs";
import { resolveForgeVersion } from "./forge-versions.mjs";
import {
  getFileDownloadUrl,
  getModFileById,
  getModFiles,
  getModById,
  MODPACKS_CLASS_ID,
  RESOURCE_PACKS_CLASS_ID,
} from "./curseforge.mjs";

const AdmZip = pkg.default ?? pkg;

function installedModsRegistryPath(dataDir, instanceId) {
  return path.join(instanceDir(dataDir, instanceId), "installed-mods.json");
}

function readInstalledModsRegistry(dataDir, instanceId) {
  const file = installedModsRegistryPath(dataDir, instanceId);
  if (!fs.existsSync(file)) return { mods: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    return { mods: raw?.mods && typeof raw.mods === "object" ? raw.mods : {} };
  } catch {
    return { mods: {} };
  }
}

function writeInstalledModsRegistry(dataDir, instanceId, registry) {
  fs.mkdirSync(instanceDir(dataDir, instanceId), { recursive: true });
  fs.writeFileSync(
    installedModsRegistryPath(dataDir, instanceId),
    JSON.stringify({ mods: registry.mods ?? {}, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8"
  );
}

function registerInstalledMod(dataDir, instanceId, entry) {
  const registry = readInstalledModsRegistry(dataDir, instanceId);
  registry.mods[entry.fileName] = {
    modId: entry.modId,
    fileId: entry.fileId,
    displayName: entry.displayName ?? entry.fileName,
    installedAt: new Date().toISOString(),
  };
  writeInstalledModsRegistry(dataDir, instanceId, registry);
}

function unregisterInstalledMod(dataDir, instanceId, fileName) {
  const registry = readInstalledModsRegistry(dataDir, instanceId);
  delete registry.mods[fileName];
  writeInstalledModsRegistry(dataDir, instanceId, registry);
}

function normalizeModFileName(fileName) {
  const base = String(fileName ?? "").trim();
  if (!base) return "mod.jar";
  if (base.toLowerCase().endsWith(".jar")) return base;
  return `${base}.jar`;
}

function isJarLikeFile(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".jar") || lower.endsWith(".jar.disabled")) return true;
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf[0] === 0x50 && buf[1] === 0x4b;
  } catch {
    return false;
  }
}

function listModFilesOnDisk(modsDir) {
  if (!fs.existsSync(modsDir)) return [];
  return fs
    .readdirSync(modsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .filter((name) => isJarLikeFile(path.join(modsDir, name)));
}

function isDisabledModFileName(fileName) {
  return String(fileName ?? "").toLowerCase().endsWith(".jar.disabled");
}

function enabledModFileName(fileName) {
  const name = String(fileName ?? "");
  if (isDisabledModFileName(name)) return name.slice(0, -".disabled".length);
  return name;
}

function disabledModFileName(fileName) {
  const name = String(fileName ?? "");
  if (isDisabledModFileName(name)) return name;
  if (name.toLowerCase().endsWith(".jar")) return `${name}.disabled`;
  return `${name}.disabled`;
}

function resolveRegistryMeta(registry, fileName) {
  if (registry.mods[fileName]) return registry.mods[fileName];
  const enabledName = enabledModFileName(fileName);
  if (enabledName !== fileName && registry.mods[enabledName]) return registry.mods[enabledName];
  return undefined;
}

function migrateRegistryKey(registry, fromName, toName) {
  if (!registry.mods[fromName]) return;
  registry.mods[toName] = registry.mods[fromName];
  delete registry.mods[fromName];
}

function log(onProgress, level, message, detail) {
  onProgress?.({
    stage: "install-log",
    level,
    message,
    detail,
    time: new Date().toISOString(),
  });
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

async function downloadFile(url, dest, onProgress, label) {
  log(onProgress, "step", `Descargando ${label}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Descarga fallida (${res.status}): ${label}`);

  const total = Number(res.headers.get("content-length")) || 0;
  let received = 0;

  const body = res.body;
  if (!body) throw new Error("Respuesta vacía al descargar");

  const reader = body.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) {
      onProgress?.({
        stage: "progress",
        type: "download",
        current: received,
        total,
        percent: Math.min(99, Math.round((received / total) * 100)),
        message: `${label}: ${Math.round(received / 1024)} KB / ${Math.round(total / 1024)} KB`,
      });
    }
  }

  const buf = Buffer.concat(chunks);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  log(onProgress, "ok", `${label} guardado`, path.basename(dest));
  return dest;
}

function pickModpackArchive(files, mcVersion, loader) {
  const archives = files.filter(
    (f) => f.fileName.endsWith(".zip") || f.fileName.endsWith(".mrpack")
  );
  if (!archives.length) return null;

  const score = (f) => {
    let s = 0;
    if (mcVersion && f.gameVersions?.includes(mcVersion)) s += 10;
    if (f.fileName.endsWith(".zip")) s += 2;
    return s;
  };

  return [...archives].sort((a, b) => score(b) - score(a))[0];
}

function parseForgeFromManifest(manifest) {
  const loaders = manifest?.minecraft?.modLoaders ?? [];
  const primary = loaders.find((l) => l.primary) ?? loaders[0];
  if (!primary?.id) return null;
  const match = /^forge-(.+)$/i.exec(String(primary.id));
  return match ? match[1] : null;
}

async function installFromManifest(manifest, extractDir, gameRoot, onProgress) {
  const modsDir = path.join(gameRoot, "mods");
  fs.mkdirSync(modsDir, { recursive: true });

  const overridesDir = manifest.overrides
    ? path.join(extractDir, manifest.overrides)
    : path.join(extractDir, "overrides");

  if (fs.existsSync(overridesDir)) {
    log(onProgress, "step", "Aplicando overrides del modpack…");
    copyDirRecursive(overridesDir, gameRoot);
  }

  const entries = manifest.files ?? [];
  let done = 0;
  for (const entry of entries) {
    const modId = entry.projectID ?? entry.projectId;
    const fileId = entry.fileID ?? entry.fileId;
    if (!modId || !fileId) continue;
    done += 1;
    log(onProgress, "step", `Mod ${done}/${entries.length}`, `CF ${modId} · archivo ${fileId}`);
    try {
      const meta = await getModFileById(modId, fileId);
      let url = meta.downloadUrl;
      if (!url) url = await getFileDownloadUrl(modId, fileId);
      const destName = normalizeModFileName(meta.fileName);
      const dest = path.join(modsDir, destName);
      if (!fs.existsSync(dest)) {
        await downloadFile(url, dest, onProgress, destName);
        const { settings } = getActiveInstance();
        const dataDir = resolveDataDir(settings.dataDir);
        const { instance } = getActiveInstance();
        if (instance?.id) {
          registerInstalledMod(dataDir, instance.id, {
            fileName: destName,
            modId,
            fileId,
            displayName: meta.displayName ?? meta.fileName,
          });
        }
      }
    } catch (err) {
      log(
        onProgress,
        "warn",
        `No se pudo bajar mod ${modId}`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return { modCount: done };
}

export async function installModToActiveInstance(modId, opts = {}, onProgress) {
  const kind = opts.kind === "resourcepack" ? "resourcepack" : "mod";
  const { instance } = getActiveInstance();
  if (!instance) throw new Error("No hay instancia activa. Crea una en Perfiles.");

  log(onProgress, "info", `Instancia: ${instance.name}`, `${instance.mcVersion} · ${instance.loader}`);

  const fileOpts = {
    mcVersion: opts.mcVersion ?? instance.mcVersion,
    loader: opts.loader ?? instance.loader,
    classId: kind === "resourcepack" ? RESOURCE_PACKS_CLASS_ID : undefined,
  };

  const files = await getModFiles(modId, fileOpts);

  if (!files.length) {
    throw new Error(
      `No hay archivos compatibles con ${fileOpts.mcVersion}${kind === "mod" ? ` (${fileOpts.loader})` : ""}`
    );
  }

  const file = files[0];
  log(onProgress, "step", `Archivo: ${file.displayName}`);

  let url = file.downloadUrl;
  if (!url) {
    url = await getFileDownloadUrl(modId, file.id);
  }

  const settings = getActiveInstance().settings;
  const dataDir = resolveDataDir(settings.dataDir);
  const destDir =
    kind === "resourcepack"
      ? instanceResourcePacksDir(dataDir, instance.id)
      : instanceModsDir(dataDir, instance.id);
  const fileName = normalizeModFileName(file.fileName);
  const dest = path.join(destDir, fileName);

  await downloadFile(url, dest, onProgress, fileName);

  if (kind === "mod") {
    registerInstalledMod(dataDir, instance.id, {
      fileName,
      modId,
      fileId: file.id,
      displayName: file.displayName ?? file.fileName,
    });
  }

  return { path: dest, fileName, instanceId: instance.id, kind, modId, fileId: file.id };
}

export async function installModpackToActiveInstance(modId, opts = {}, onProgress) {
  const { instance } = getActiveInstance();
  if (!instance) throw new Error("No hay instancia activa");

  const mcVersion = opts.mcVersion ?? instance.mcVersion;
  const loader = opts.loader ?? instance.loader;

  log(onProgress, "info", `Modpack en instancia: ${instance.name}`, `${mcVersion} · ${loader}`);

  const files = await getModFiles(modId, {
    mcVersion,
    loader,
    classId: MODPACKS_CLASS_ID,
  });

  const zipFile = pickModpackArchive(files, mcVersion, loader);
  if (!zipFile) throw new Error("No se encontró archivo de modpack (.zip / .mrpack)");

  let url = zipFile.downloadUrl;
  if (!url) url = await getFileDownloadUrl(modId, zipFile.id);

  const settings = getActiveInstance().settings;
  const dataDir = resolveDataDir(settings.dataDir);
  const gameRoot = instanceGameRoot(dataDir, instance.id);
  const downloadsDir = path.join(instanceGameRoot(dataDir, instance.id), "..", "downloads");
  const tmpZip = path.join(downloadsDir, zipFile.fileName);
  const extractDir = path.join(downloadsDir, `_extract-${modId}-${Date.now()}`);

  fs.mkdirSync(gameRoot, { recursive: true });
  fs.mkdirSync(path.join(gameRoot, "mods"), { recursive: true });

  await downloadFile(url, tmpZip, onProgress, zipFile.fileName);

  log(onProgress, "step", "Extrayendo modpack…");
  const zip = new AdmZip(tmpZip);
  zip.extractAllTo(extractDir, true);

  const manifestPath = path.join(extractDir, "manifest.json");
  let modCount = 0;

  let manifest = null;
  if (fs.existsSync(manifestPath)) {
    log(onProgress, "step", "Instalando mods desde manifest.json…");
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const result = await installFromManifest(manifest, extractDir, gameRoot, onProgress);
    modCount = result.modCount;
    log(onProgress, "ok", `Modpack instalado (${modCount} mods desde CurseForge)`);
  } else {
    log(onProgress, "step", "Sin manifest — copiando contenido al juego…");
    copyDirRecursive(extractDir, gameRoot);
    const modsDir = path.join(gameRoot, "mods");
    modCount = fs.existsSync(modsDir)
      ? fs.readdirSync(modsDir).filter((f) => f.endsWith(".jar")).length
      : 0;
    log(onProgress, "ok", "Modpack extraído en la instancia");
  }

  try {
    fs.rmSync(extractDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(tmpZip);
  } catch {
    /* ignore */
  }

  if (instance.id) {
    const manifestMc = manifest?.minecraft?.version;
    const forgeFromManifest = manifest ? parseForgeFromManifest(manifest) : null;
    const patch = { curseForgeId: modId };
    if (manifestMc && manifestMc !== instance.mcVersion) patch.mcVersion = manifestMc;
    else if (mcVersion !== instance.mcVersion) patch.mcVersion = mcVersion;
    if (loader && loader !== instance.loader) patch.loader = loader;
    if (forgeFromManifest) patch.forgeVersion = forgeFromManifest;
    else if (!instance.forgeVersion && loader === "forge") {
      patch.forgeVersion = resolveForgeVersion(patch.mcVersion ?? mcVersion).forgeVersion;
    }
    try {
      const modMeta = await getModById(modId);
      if (modMeta?.logoUrl) patch.iconUrl = modMeta.logoUrl;
    } catch {
      /* avatar opcional */
    }
    try {
      updateInstance(instance.id, patch);
    } catch {
      /* ignore */
    }
  }

  return { instanceId: instance.id, gameRoot, modCount, mcVersion, fileName: zipFile.fileName };
}

async function resolveUpdateInfo(registryEntry, instance) {
  if (!registryEntry?.modId || !registryEntry?.fileId) {
    return { updateAvailable: false };
  }
  try {
    const files = await getModFiles(registryEntry.modId, {
      mcVersion: instance.mcVersion,
      loader: instance.loader,
    });
    const latest = files[0];
    if (!latest) return { updateAvailable: false };
    if (latest.id === registryEntry.fileId) {
      return { updateAvailable: false, latestFileName: latest.fileName };
    }
    return {
      updateAvailable: true,
      latestFileId: latest.id,
      latestFileName: latest.fileName,
      latestDisplayName: latest.displayName,
    };
  } catch {
    return { updateAvailable: false };
  }
}

export async function listInstalledMods(instanceId, opts = {}) {
  const { settings, instances } = getActiveInstance();
  const dataDir = resolveDataDir(settings.dataDir);
  const modsDir = instanceModsDir(dataDir, instanceId);
  const instance = instances.find((i) => i.id === instanceId) ?? null;
  const registry = readInstalledModsRegistry(dataDir, instanceId);
  const allNames = listModFilesOnDisk(modsDir).sort((a, b) => a.localeCompare(b));
  const offset = Math.max(0, Number(opts.offset) || 0);
  const limit = opts.limit != null ? Math.max(1, Number(opts.limit) || 1) : null;
  const pageNames = limit != null ? allNames.slice(offset, offset + limit) : allNames.slice(offset);

  const rows = pageNames.map((fileName) => {
    const meta = resolveRegistryMeta(registry, fileName);
    return {
      fileName,
      size: fs.statSync(path.join(modsDir, fileName)).size,
      modId: meta?.modId,
      fileId: meta?.fileId,
      displayName: meta?.displayName ?? enabledModFileName(fileName),
      disabled: isDisabledModFileName(fileName),
      updateAvailable: false,
    };
  });

  let result = rows;
  if (opts.checkUpdates && instance) {
    const concurrency = 8;
    let cursor = 0;
    const checked = new Array(rows.length);
    async function worker() {
      while (cursor < rows.length) {
        const i = cursor++;
        const row = rows[i];
        if (row.disabled) {
          checked[i] = row;
          continue;
        }
        const meta = resolveRegistryMeta(registry, row.fileName);
        const update = await resolveUpdateInfo(meta, instance);
        checked[i] = {
          ...row,
          displayName: meta?.displayName ?? row.displayName,
          modId: meta?.modId ?? row.modId,
          fileId: meta?.fileId ?? row.fileId,
          updateAvailable: update.updateAvailable,
          latestFileName: update.latestFileName,
          latestFileId: update.latestFileId,
          latestDisplayName: update.latestDisplayName,
        };
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()));
    result = checked;
  }

  if (limit != null) {
    return {
      rows: result,
      total: allNames.length,
      hasMore: offset + pageNames.length < allNames.length,
    };
  }
  return result;
}

export async function setInstalledModEnabled(instanceId, fileName, enabled) {
  const { settings } = getActiveInstance();
  const dataDir = resolveDataDir(settings.dataDir);
  const modsDir = instanceModsDir(dataDir, instanceId);
  const safeName = path.basename(String(fileName ?? ""));
  if (!safeName) throw new Error("Nombre de archivo inválido");

  const src = path.join(modsDir, safeName);
  if (!fs.existsSync(src)) throw new Error("El mod no existe en este perfil");

  const currentlyDisabled = isDisabledModFileName(safeName);
  const wantEnabled = Boolean(enabled);
  if (currentlyDisabled === !wantEnabled) {
    return { ok: true, fileName: safeName, enabled: wantEnabled };
  }

  const nextName = wantEnabled ? enabledModFileName(safeName) : disabledModFileName(safeName);
  const dest = path.join(modsDir, nextName);
  if (fs.existsSync(dest)) throw new Error("Ya existe un archivo con ese nombre");

  fs.renameSync(src, dest);

  const registry = readInstalledModsRegistry(dataDir, instanceId);
  const meta = resolveRegistryMeta(registry, safeName);
  migrateRegistryKey(registry, safeName, nextName);
  if (meta && !registry.mods[nextName]) registry.mods[nextName] = meta;
  writeInstalledModsRegistry(dataDir, instanceId, registry);

  return { ok: true, fileName: nextName, enabled: wantEnabled };
}

export async function deleteInstalledMod(instanceId, fileName) {
  const { settings } = getActiveInstance();
  const dataDir = resolveDataDir(settings.dataDir);
  const modsDir = instanceModsDir(dataDir, instanceId);
  const safeName = path.basename(String(fileName ?? ""));
  if (!safeName) throw new Error("Nombre de archivo inválido");

  const target = path.join(modsDir, safeName);
  if (!fs.existsSync(target)) throw new Error("El mod no existe en este perfil");
  fs.unlinkSync(target);
  unregisterInstalledMod(dataDir, instanceId, safeName);
  const enabledName = enabledModFileName(safeName);
  if (enabledName !== safeName) unregisterInstalledMod(dataDir, instanceId, enabledName);
  return { ok: true, fileName: safeName };
}

export async function updateInstalledMod(instanceId, fileName, onProgress) {
  const { settings, instances } = getActiveInstance();
  const dataDir = resolveDataDir(settings.dataDir);
  const instance = instances.find((i) => i.id === instanceId);
  if (!instance) throw new Error("Perfil no encontrado");

  const safeName = path.basename(String(fileName ?? ""));
  if (isDisabledModFileName(safeName)) {
    throw new Error("Activa el mod antes de actualizarlo.");
  }
  const registry = readInstalledModsRegistry(dataDir, instanceId);
  const meta = resolveRegistryMeta(registry, safeName);
  if (!meta?.modId) {
    throw new Error("Este mod no tiene datos de CurseForge. Reinstálalo desde el catálogo.");
  }

  const files = await getModFiles(meta.modId, {
    mcVersion: instance.mcVersion,
    loader: instance.loader,
  });
  const latest = files[0];
  if (!latest) throw new Error("No hay actualización compatible con tu versión de Minecraft");

  if (latest.id === meta.fileId) {
    log(onProgress, "ok", "Ya tienes la última versión", safeName);
    return { ok: true, updated: false, fileName: safeName };
  }

  let url = latest.downloadUrl;
  if (!url) url = await getFileDownloadUrl(meta.modId, latest.id);

  const modsDir = instanceModsDir(dataDir, instanceId);
  const nextName = normalizeModFileName(latest.fileName);
  const dest = path.join(modsDir, nextName);
  await downloadFile(url, dest, onProgress, nextName);

  const oldPath = path.join(modsDir, safeName);
  if (safeName !== nextName && fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
    unregisterInstalledMod(dataDir, instanceId, safeName);
  }

  registerInstalledMod(dataDir, instanceId, {
    fileName: nextName,
    modId: meta.modId,
    fileId: latest.id,
    displayName: latest.displayName ?? meta.displayName,
  });

  log(onProgress, "ok", "Mod actualizado", nextName);
  return { ok: true, updated: true, fileName: nextName, previousFileName: safeName };
}

export async function listInstalledResourcePacks(instanceId) {
  const { settings } = getActiveInstance();
  const dataDir = resolveDataDir(settings.dataDir);
  const dir = instanceResourcePacksDir(dataDir, instanceId);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".zip") || f.endsWith(".jar"))
    .map((f) => ({
      fileName: f,
      size: fs.statSync(path.join(dir, f)).size,
    }));
}

export async function getInstanceContentStats(instanceId) {
  const { settings } = getActiveInstance();
  const dataDir = resolveDataDir(settings.dataDir);
  const modsDir = instanceModsDir(dataDir, instanceId);
  const modCount = listModFilesOnDisk(modsDir).filter((name) => !isDisabledModFileName(name)).length;
  const resourcePacks = await listInstalledResourcePacks(instanceId);
  return { modCount, resourcePackCount: resourcePacks.length };
}
