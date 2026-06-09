import fs from "node:fs";
import { FORGE_VERSIONS } from "./forge-versions.mjs";
import {
  ensureInstanceDirs,
  instanceDir,
  instanceMetaPath,
  instancesRoot,
  resolveDataDir,
} from "./launcher-paths.mjs";
import {
  isLegacyUuidFolder,
  listInstanceFolderNames,
  resolveUniqueInstanceSlug,
} from "./instance-slug.mjs";
import { loadSettings, saveSettings, setActiveInstance } from "./launcher-settings.mjs";

function readInstanceMeta(dataDir, folderName) {
  const file = instanceMetaPath(dataDir, folderName);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function writeInstanceMeta(dataDir, instance) {
  ensureInstanceDirs(dataDir, instance.id);
  fs.writeFileSync(instanceMetaPath(dataDir, instance.id), JSON.stringify(instance, null, 2), "utf-8");
}

function syncActiveInstanceId(dataDir, oldId, newId) {
  const settings = loadSettings();
  if (settings.activeInstanceId === oldId) {
    saveSettings({ ...settings, activeInstanceId: newId });
  }
}

/** Renombra carpetas UUID → nombre legible y alinea instance.id con el nombre de carpeta. */
function migrateLegacyInstanceFolder(dataDir, folderName) {
  const meta = readInstanceMeta(dataDir, folderName);
  if (!meta) return null;

  const displayName = meta.name?.trim() || meta.mcVersion || "instancia";
  const slug = resolveUniqueInstanceSlug(dataDir, displayName, meta.mcVersion, folderName);

  if (folderName !== slug) {
    const from = instanceDir(dataDir, folderName);
    const to = instanceDir(dataDir, slug);
    try {
      fs.renameSync(from, to);
    } catch (err) {
      const locked = err?.code === "EPERM" || err?.code === "EBUSY" || err?.code === "EACCES";
      if (locked) return meta;
      throw err;
    }
  }

  const oldIds = [folderName, meta.id].filter(Boolean);
  const updated = {
    ...meta,
    id: slug,
    name: displayName,
    updatedAt: new Date().toISOString(),
  };
  writeInstanceMeta(dataDir, updated);

  for (const oldId of oldIds) {
    syncActiveInstanceId(dataDir, oldId, slug);
  }

  return updated;
}

function migrateAllLegacyInstanceFolders(dataDir) {
  for (const folderName of listInstanceFolderNames(dataDir)) {
    if (isLegacyUuidFolder(folderName)) {
      migrateLegacyInstanceFolder(dataDir, folderName);
    }
  }
}

function maybeRenameInstanceFolder(dataDir, current, patch) {
  const nextName = patch.name !== undefined ? String(patch.name).trim() : current.name?.trim();
  const nextVersion = patch.mcVersion ?? current.mcVersion;
  const displayName = nextName || nextVersion;
  const newSlug = resolveUniqueInstanceSlug(dataDir, displayName, nextVersion, current.id);

  if (newSlug === current.id) {
    return { ...current, ...patch, id: current.id, name: displayName, updatedAt: new Date().toISOString() };
  }

  const from = instanceDir(dataDir, current.id);
  const to = instanceDir(dataDir, newSlug);
  if (fs.existsSync(from)) {
    try {
      fs.renameSync(from, to);
    } catch (err) {
      const locked = err?.code === "EPERM" || err?.code === "EBUSY" || err?.code === "EACCES";
      if (locked) {
        throw new Error(
          "Cierra Minecraft y el launcher, luego vuelve a cambiar el nombre del perfil."
        );
      }
      throw err;
    }
  }

  const updated = {
    ...current,
    ...patch,
    id: newSlug,
    name: displayName,
    updatedAt: new Date().toISOString(),
  };
  writeInstanceMeta(dataDir, updated);
  syncActiveInstanceId(dataDir, current.id, newSlug);
  return updated;
}

export function listInstances() {
  const settings = loadSettings();
  const dataDir = resolveDataDir(settings.dataDir);
  const root = instancesRoot(dataDir);
  fs.mkdirSync(root, { recursive: true });

  migrateAllLegacyInstanceFolders(dataDir);

  const instances = listInstanceFolderNames(dataDir)
    .map((folder) => {
      const meta = readInstanceMeta(dataDir, folder);
      if (!meta) return null;
      if (meta.id !== folder) {
        const fixed = { ...meta, id: folder };
        writeInstanceMeta(dataDir, fixed);
        return fixed;
      }
      return meta;
    })
    .filter(Boolean);

  if (instances.length === 0) {
    const created = createInstance({
      name: "Principal",
      mcVersion: "1.20.1",
      loader: "forge",
      forgeVersion: "47.3.12",
    });
    return { settings: loadSettings(), instances: [created] };
  }

  return { settings: loadSettings(), instances };
}

export function createInstance(input) {
  const settings = loadSettings();
  const dataDir = resolveDataDir(settings.dataDir);
  const now = new Date().toISOString();
  const forgeDefault = FORGE_VERSIONS.find((v) => v.mcVersion === input.mcVersion);
  const mcVersion = input.mcVersion || "1.20.1";
  const displayName = input.name?.trim() || mcVersion;
  const id = resolveUniqueInstanceSlug(dataDir, displayName, mcVersion);

  const instance = {
    id,
    name: displayName,
    mcVersion,
    loader: input.loader || "forge",
    forgeVersion: input.forgeVersion || forgeDefault?.forgeVersion || "47.3.12",
    curseForgeId: input.curseForgeId,
    iconColor: input.iconColor || "#496f4f",
    iconUrl: input.iconUrl,
    createdAt: now,
    updatedAt: now,
  };

  writeInstanceMeta(dataDir, instance);
  ensureInstanceDirs(dataDir, instance.id);

  if (!settings.activeInstanceId) {
    setActiveInstance(instance.id);
  }

  return instance;
}

export function deleteInstance(instanceId) {
  const settings = loadSettings();
  const dataDir = resolveDataDir(settings.dataDir);
  const dir = instanceDir(dataDir, instanceId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

  if (settings.activeInstanceId === instanceId) {
    const remaining = listInstances().instances.filter((i) => i.id !== instanceId);
    saveSettings({ ...settings, activeInstanceId: remaining[0]?.id ?? null });
  }

  return listInstances();
}

export function selectInstance(instanceId) {
  const { instances } = listInstances();
  if (!instances.some((i) => i.id === instanceId)) {
    throw new Error("Instancia no encontrada");
  }
  const settings = setActiveInstance(instanceId);
  return { settings, instances };
}

export function getActiveInstance() {
  const { settings, instances } = listInstances();
  const active = instances.find((i) => i.id === settings.activeInstanceId) ?? instances[0] ?? null;
  return { settings, instance: active, instances };
}

export function updateInstance(instanceId, patch) {
  const settings = loadSettings();
  const dataDir = resolveDataDir(settings.dataDir);
  const current = readInstanceMeta(dataDir, instanceId);
  if (!current) throw new Error("Instancia no encontrada");

  if (patch.name !== undefined || patch.mcVersion !== undefined) {
    return maybeRenameInstanceFolder(dataDir, current, patch);
  }

  const updated = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };
  writeInstanceMeta(dataDir, updated);
  return updated;
}
