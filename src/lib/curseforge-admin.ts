import type { Modpack } from "@/types/features";

export type CurseForgeBrowseKind = "modpacks" | "mods";

export type CurseForgeSearchHit = {
  id: number;
  name: string;
  slug: string;
  summary: string;
  downloadCount: number;
  authors: string[];
  logoUrl?: string;
  classId: number;
};

const LOADER_BY_CF: Record<number, Modpack["loader"]> = {
  0: "vanilla",
  1: "forge",
  4: "fabric",
  5: "quilt",
};

function classIdForKind(kind: CurseForgeBrowseKind): string {
  return kind === "modpacks" ? "4471" : "6";
}

export async function searchCurseForgeCatalog(
  kind: CurseForgeBrowseKind,
  query: string,
  pageSize = 24
): Promise<CurseForgeSearchHit[]> {
  const params = new URLSearchParams({
    path: "/mods/search",
    gameId: "432",
    classId: classIdForKind(kind),
    searchFilter: query.trim() || (kind === "modpacks" ? "all the mods" : "jei"),
    pageSize: String(pageSize),
    sortField: "2",
    sortOrder: "desc",
  });
  const res = await fetch(`/api/curseforge?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: string }).error;
    if (res.status === 503) {
      throw new Error(msg ?? "CURSEFORGE_API_KEY no configurada en .env.local");
    }
    if (res.status === 403) {
      throw new Error(
        "CurseForge rechazó la API key (403). Usa el token de https://console.curseforge.com (no un hash bcrypt)."
      );
    }
    throw new Error(msg ?? `CurseForge ${res.status}`);
  }
  const data = (await res.json()) as {
    data?: Array<{
      id: number;
      name: string;
      slug: string;
      summary?: string;
      downloadCount?: number;
      classId?: number;
      logo?: { thumbnailUrl?: string; url?: string };
      authors?: Array<{ name?: string } | string>;
    }>;
  };
  return (data.data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    summary: m.summary ?? "",
    downloadCount: m.downloadCount ?? 0,
    classId: m.classId ?? (kind === "modpacks" ? 4471 : 6),
    logoUrl: m.logo?.thumbnailUrl ?? m.logo?.url,
    authors: (m.authors ?? []).map((a) => (typeof a === "string" ? a : a.name ?? "")).filter(Boolean),
  }));
}

export async function fetchCurseForgeModDetails(modId: number): Promise<{
  hit: CurseForgeSearchHit;
  mcVersion: string;
  loader: Modpack["loader"];
  sizeMb: number;
  fileName?: string;
}> {
  const modRes = await fetch(`/api/curseforge?path=${encodeURIComponent(`/mods/${modId}`)}`);
  if (!modRes.ok) {
    const err = await modRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Mod ${modId} no encontrado`);
  }
  const modBody = (await modRes.json()) as {
    data?: {
      id: number;
      name: string;
      slug: string;
      summary?: string;
      downloadCount?: number;
      classId?: number;
      logo?: { thumbnailUrl?: string; url?: string };
      authors?: Array<{ name?: string }>;
    };
  };
  const mod = modBody.data;
  if (!mod) throw new Error("Respuesta vacía de CurseForge");

  const filesRes = await fetch(
    `/api/curseforge?path=${encodeURIComponent(`/mods/${modId}/files`)}&pageSize=5&sortField=2&sortOrder=desc`
  );
  let mcVersion = "1.20.1";
  let loader: Modpack["loader"] = "forge";
  let sizeMb = 0;
  let fileName: string | undefined;

  if (filesRes.ok) {
    const filesBody = (await filesRes.json()) as {
      data?: Array<{
        fileName?: string;
        fileLength?: number;
        gameVersions?: string[];
        modLoaderType?: number;
      }>;
    };
    const file = filesBody.data?.[0];
    if (file) {
      fileName = file.fileName;
      sizeMb = Math.max(1, Math.round((file.fileLength ?? 0) / 1024 / 1024));
      if (file.gameVersions?.length) mcVersion = file.gameVersions[0];
      if (file.modLoaderType != null) loader = LOADER_BY_CF[file.modLoaderType] ?? "forge";
    }
  }

  const hit: CurseForgeSearchHit = {
    id: mod.id,
    name: mod.name,
    slug: mod.slug,
    summary: mod.summary ?? "",
    downloadCount: mod.downloadCount ?? 0,
    classId: mod.classId ?? 6,
    logoUrl: mod.logo?.thumbnailUrl ?? mod.logo?.url,
    authors: (mod.authors ?? []).map((a) => a.name ?? "").filter(Boolean),
  };

  return { hit, mcVersion, loader, sizeMb, fileName };
}

/** Metadatos mínimos al añadir desde la lista (sin consultar archivos de CF) */
export function defaultDetailsFromHit(): { mcVersion: string; loader: Modpack["loader"]; sizeMb: number } {
  return { mcVersion: "1.20.1", loader: "forge", sizeMb: 0 };
}

export function modpackFromCurseForge(
  hit: CurseForgeSearchHit,
  details: { mcVersion: string; loader: Modpack["loader"]; sizeMb: number },
  opts?: { premiumOnly?: boolean; description?: string; catalogKind?: Modpack["catalogKind"] }
): Modpack {
  const kind = opts?.catalogKind ?? (hit.classId === 4471 ? "modpack" : "mod");
  return {
    id: kind === "mod" ? `mod-cf-${hit.id}` : `mp-cf-${hit.id}`,
    name: hit.name,
    description: opts?.description ?? hit.summary.slice(0, 400),
    mcVersion: details.mcVersion,
    loader: details.loader,
    curseForgeId: hit.id,
    curseForgeSlug: hit.slug,
    catalogKind: kind,
    modCount: kind === "modpack" ? Math.max(1, Math.round(details.sizeMb / 2)) : 1,
    downloads: hit.downloadCount,
    sizeMb: details.sizeMb,
    enabled: true,
    premiumOnly: opts?.premiumOnly ?? false,
    author: hit.authors[0] ?? "CurseForge",
    updatedAt: new Date().toISOString(),
  };
}

export async function enrichModpackFromCurseForge(pack: Modpack): Promise<Modpack> {
  if (!pack.curseForgeId) return pack;
  try {
    const { hit, mcVersion, loader, sizeMb } = await fetchCurseForgeModDetails(pack.curseForgeId);
    return {
      ...pack,
      name: hit.name,
      description: pack.description || hit.summary.slice(0, 400),
      mcVersion,
      loader,
      downloads: hit.downloadCount,
      sizeMb,
      author: hit.authors[0] ?? pack.author,
      curseForgeSlug: hit.slug,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return pack;
  }
}

export async function enrichAllModpacks(packs: Modpack[]): Promise<Modpack[]> {
  const out: Modpack[] = [];
  for (const pack of packs) {
    out.push(await enrichModpackFromCurseForge(pack));
  }
  return out;
}

export function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
