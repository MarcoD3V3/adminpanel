import {
  fetchAdminCached,
  invalidateAdminCache,
  readAdminCache,
  writeAdminCache,
} from "@/lib/admin-api-cache";
import type { MinecraftVersionProfile } from "@/lib/minecraft-versions";

const CACHE_KEY = "minecraft-versions";

export type MinecraftVersionsPayload = {
  schema?: number;
  versions: MinecraftVersionProfile[];
  enabled: MinecraftVersionProfile[];
};

export function readCachedMinecraftVersions(): MinecraftVersionsPayload | null {
  return readAdminCache<MinecraftVersionsPayload>(CACHE_KEY)?.data ?? null;
}

export async function fetchMinecraftVersions(opts?: {
  onUpdate?: (data: MinecraftVersionsPayload) => void;
}): Promise<MinecraftVersionsPayload> {
  return fetchAdminCached({
    key: CACHE_KEY,
    url: "/api/minecraft-versions",
    maxAgeMs: 15 * 60 * 1000,
    parse: (r) => r.json(),
    onUpdate: opts?.onUpdate,
  });
}

export function cacheMinecraftVersions(data: MinecraftVersionsPayload): void {
  writeAdminCache(CACHE_KEY, data);
}

export function invalidateMinecraftVersionsCache(): void {
  invalidateAdminCache(CACHE_KEY);
}
