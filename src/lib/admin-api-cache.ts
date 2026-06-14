const PREFIX = "craftlauncher:admin-cache:";
const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;

type CacheEntry<T> = {
  data: T;
  hash: string;
  savedAt: number;
};

function stableHash(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function readAdminCache<T>(key: string): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

export function writeAdminCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = {
      data,
      hash: stableHash(data),
      savedAt: Date.now(),
    };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota exceeded — seguir sin caché */
  }
}

export function invalidateAdminCache(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PREFIX + key);
}

export type FetchAdminCachedOptions<T> = {
  key: string;
  url: string;
  init?: RequestInit;
  /** Tiempo que la caché se sirve al instante antes de revalidar en segundo plano. */
  maxAgeMs?: number;
  parse: (res: Response) => Promise<T>;
  /** Si el servidor devolvió datos distintos a la caché. */
  onUpdate?: (data: T) => void;
};

/**
 * Stale-while-revalidate: muestra caché al instante y actualiza en segundo plano si cambió.
 */
export async function fetchAdminCached<T>(opts: FetchAdminCachedOptions<T>): Promise<T> {
  const { key, url, init, maxAgeMs = DEFAULT_MAX_AGE_MS, parse, onUpdate } = opts;
  const cached = readAdminCache<T>(key);

  const revalidate = async (): Promise<T | null> => {
    try {
      const res = await fetch(url, { ...init, cache: "no-store" });
      if (!res.ok) return cached?.data ?? null;
      const data = await parse(res);
      const hash = stableHash(data);
      const changed = !cached || hash !== cached.hash;
      writeAdminCache(key, data);
      if (changed) onUpdate?.(data);
      return data;
    } catch {
      return cached?.data ?? null;
    }
  };

  if (cached) {
    const age = Date.now() - cached.savedAt;
    if (age <= maxAgeMs) {
      void revalidate().catch(() => {});
      return cached.data;
    }
  }

  const fresh = await revalidate();
  if (fresh != null) return fresh;
  if (cached) return cached.data;
  throw new Error(`No se pudo cargar ${url}`);
}
