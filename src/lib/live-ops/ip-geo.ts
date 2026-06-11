import type { GeoPlace } from "./geo";

/** APIs usadas (en orden): ip-api.com → ipinfo.io (si IPINFO_TOKEN) → ipapi.co */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; geo: GeoPlace }>();

function isPublicIp(ip: string): boolean {
  const raw = ip.trim().toLowerCase();
  if (!raw || raw === "unknown" || raw === "—") return false;
  if (raw === "::1" || raw === "localhost") return false;
  if (raw.startsWith("127.") || raw.startsWith("10.")) return false;
  if (raw.startsWith("192.168.")) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(raw)) return false;
  if (raw.startsWith("fc") || raw.startsWith("fd") || raw.startsWith("fe80")) return false;
  return true;
}

async function lookupIpApi(ip: string): Promise<GeoPlace | null> {
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=es&fields=status,message,country,countryCode,city,lat,lon`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: string;
    country?: string;
    countryCode?: string;
    city?: string;
    lat?: number;
    lon?: number;
  };
  if (data.status !== "success" || !data.countryCode) return null;
  return {
    country: data.country ?? data.countryCode,
    countryCode: data.countryCode,
    city: data.city?.trim() || "—",
    lat: typeof data.lat === "number" ? data.lat : 0,
    lng: typeof data.lon === "number" ? data.lon : 0,
  };
}

async function lookupIpinfo(ip: string, token: string): Promise<GeoPlace | null> {
  const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}?token=${token}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    country?: string;
    city?: string;
    loc?: string;
  };
  if (!data.country) return null;
  const [lat, lng] = (data.loc ?? "0,0").split(",").map((n) => Number(n));
  return {
    country: data.country,
    countryCode: data.country,
    city: data.city?.trim() || "—",
    lat: Number.isFinite(lat) ? lat : 0,
    lng: Number.isFinite(lng) ? lng : 0,
  };
}

async function lookupIpapiCo(ip: string): Promise<GeoPlace | null> {
  const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    error?: boolean;
    country_name?: string;
    country_code?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  if (data.error || !data.country_code) return null;
  return {
    country: data.country_name ?? data.country_code,
    countryCode: data.country_code,
    city: data.city?.trim() || "—",
    lat: typeof data.latitude === "number" ? data.latitude : 0,
    lng: typeof data.longitude === "number" ? data.longitude : 0,
  };
}

/** Geolocaliza una IP pública. Devuelve null si no hay datos o es IP local. */
export async function resolveGeoFromIp(ip?: string): Promise<GeoPlace | null> {
  if (!ip || !isPublicIp(ip)) return null;

  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.geo;

  const token = process.env.IPINFO_TOKEN?.trim();
  const providers = [
    () => lookupIpApi(ip),
    ...(token ? [() => lookupIpinfo(ip, token)] : []),
    () => lookupIpapiCo(ip),
  ];

  for (const provider of providers) {
    try {
      const geo = await provider();
      if (geo) {
        cache.set(ip, { at: Date.now(), geo });
        return geo;
      }
    } catch {
      /* siguiente proveedor */
    }
  }

  return null;
}
