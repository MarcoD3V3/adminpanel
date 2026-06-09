const CF_BASE = "https://api.curseforge.com/v1";
const MINECRAFT_GAME_ID = 432;
const MODS_CLASS_ID = 6;
const MODPACKS_CLASS_ID = 4471;
const RESOURCE_PACKS_CLASS_ID = 12;

const LOADER_MAP = {
  forge: 1,
  fabric: 4,
  quilt: 5,
  vanilla: 0,
};

function apiKey() {
  return (process.env.CURSEFORGE_API_KEY || process.env.VITE_CURSEFORGE_API_KEY || "").trim();
}

function friendlyCfError(status, body) {
  if (status === 403) {
    return (
      "CurseForge rechazó la petición (403). Comprueba que CURSEFORGE_API_KEY sea el token completo " +
      "de https://console.curseforge.com (incluido $2a$10$ si viene así), que tu solicitud de API " +
      "esté aprobada y reinicia npm run launcher:dev."
    );
  }
  if (status === 401) {
    return "API key de CurseForge inválida (401). Genera una nueva en console.curseforge.com.";
  }
  return `CurseForge ${status}: ${body.slice(0, 120) || "Error de API"}`;
}

async function cfFetch(path, params = {}) {
  const key = apiKey();
  if (!key) {
    throw new Error(
      "CurseForge API no configurada. Añade CURSEFORGE_API_KEY en .env.local (https://console.curseforge.com) y reinicia el launcher."
    );
  }

  const url = new URL(`${CF_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    headers: { "x-api-key": key, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(friendlyCfError(res.status, body));
  }

  return res.json();
}

function mapMod(m) {
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    summary: m.summary ?? "",
    downloadCount: m.downloadCount ?? 0,
    logoUrl: m.logo?.thumbnailUrl ?? m.logo?.url,
    authors: (m.authors ?? []).map((a) => a.name).filter(Boolean),
    dateModified: m.dateModified,
    websiteUrl: m.links?.websiteUrl,
    categories: (m.categories ?? []).map((c) => c.name).filter(Boolean),
  };
}

export async function searchMods(query, opts = {}) {
  const { mcVersion, loader = "forge", classId = MODS_CLASS_ID, pageSize = 20, index = 0 } = opts;
  const params = {
    gameId: MINECRAFT_GAME_ID,
    classId,
    searchFilter: query,
    gameVersion: mcVersion,
    sortField: 2,
    sortOrder: "desc",
    pageSize,
    index,
  };
  if (classId !== RESOURCE_PACKS_CLASS_ID && loader) {
    params.modLoaderType = LOADER_MAP[loader] ?? 1;
  }
  const data = await cfFetch("/mods/search", params);
  return { ok: true, mods: (data.data ?? []).map(mapMod), pagination: data.pagination };
}

export async function searchModpacks(query, opts = {}) {
  return searchMods(query, { ...opts, classId: MODPACKS_CLASS_ID });
}

export async function searchResourcePacks(query, opts = {}) {
  return searchMods(query, { ...opts, classId: RESOURCE_PACKS_CLASS_ID, loader: null });
}

export function curseForgeConfigured() {
  return Boolean(apiKey());
}

/** Comprueba que haya key y que no esté recortada por error. */
export function curseForgeKeyStatus() {
  const key = apiKey();
  if (!key) {
    return {
      ok: false,
      reason: "missing",
      message: "Falta CURSEFORGE_API_KEY en .env.local",
    };
  }
  // Keys de console.curseforge.com suelen ser ~60 chars y pueden empezar por $2a$10$
  if (key.startsWith("$2a$") && key.length < 55) {
    return {
      ok: false,
      reason: "truncated",
      message:
        "La key parece incompleta. Si la copiaste desde console.curseforge.com, pega el token entero " +
        "(incluido $2a$10$ al inicio). No quites ese prefijo.",
    };
  }
  if (!key.startsWith("$2a$") && key.length >= 50 && key.length <= 56 && /^[A-Za-z0-9./]+$/.test(key)) {
    return {
      ok: false,
      reason: "missing_prefix",
      message:
        "Parece que pegaste solo una parte de la key (sin $2a$10$). Copia el token completo desde " +
        "console.curseforge.com → API Keys.",
    };
  }
  if (key.length < 20) {
    return {
      ok: false,
      reason: "short",
      message: "La API key parece demasiado corta. Copia la key completa desde console.curseforge.com.",
    };
  }
  return { ok: true, reason: "ok", message: "" };
}

function mapFile(f) {
  return {
    id: f.id,
    displayName: f.displayName,
    fileName: f.fileName,
    fileLength: f.fileLength,
    gameVersions: f.gameVersions ?? [],
    downloadUrl: f.downloadUrl,
  };
}

async function fetchModFilesRaw(modId, params) {
  const data = await cfFetch(`/mods/${modId}/files`, params);
  return (data.data ?? []).map(mapFile);
}

export async function getModFiles(modId, opts = {}) {
  const { mcVersion, loader = "forge", classId = MODS_CLASS_ID } = opts;

  const withFilters = { pageSize: 25 };
  if (mcVersion) withFilters.gameVersion = mcVersion;
  if (classId !== RESOURCE_PACKS_CLASS_ID && loader) {
    withFilters.modLoaderType = LOADER_MAP[loader] ?? 1;
  }

  try {
    const files = await fetchModFilesRaw(modId, withFilters);
    if (files.length) return files;
  } catch (err) {
    if (!String(err.message).includes("403")) throw err;
  }

  // Reintento sin filtros de loader (evita 403 en algunos mods/modpacks)
  try {
    return await fetchModFilesRaw(modId, { pageSize: 25, gameVersion: mcVersion });
  } catch (err) {
    if (!String(err.message).includes("403")) throw err;
  }

  return fetchModFilesRaw(modId, { pageSize: 25 });
}

export async function getFileDownloadUrl(modId, fileId) {
  const data = await cfFetch(`/mods/${modId}/files/${fileId}/download-url`);
  return data.data;
}

export async function getModFileById(modId, fileId) {
  const data = await cfFetch(`/mods/${modId}/files/${fileId}`);
  const f = data.data;
  if (!f) throw new Error(`Archivo ${fileId} no encontrado`);
  return mapFile(f);
}

export async function getModById(modId) {
  const data = await cfFetch(`/mods/${modId}`);
  return mapMod(data.data);
}

export async function getModDetails(modId, opts = {}) {
  const cachedMod = opts.cachedMod ?? null;
  let mod = cachedMod;

  if (!mod) {
    try {
      mod = await getModById(modId);
    } catch (err) {
      if (cachedMod) mod = cachedMod;
      else throw err;
    }
  } else {
    // Enriquecer datos del listado con detalle si la API lo permite
    try {
      mod = await getModById(modId);
    } catch {
      /* usar cachedMod del catálogo */
    }
  }

  let files = [];
  let filesError = null;
  try {
    files = await getModFiles(modId, opts);
  } catch (err) {
    filesError = err instanceof Error ? err.message : String(err);
  }

  return { ok: true, mod, files, filesError };
}

export { MINECRAFT_GAME_ID, MODS_CLASS_ID, MODPACKS_CLASS_ID, RESOURCE_PACKS_CLASS_ID };
