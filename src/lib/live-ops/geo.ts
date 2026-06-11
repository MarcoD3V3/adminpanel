export function latLngToMapPercent(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  };
}

export type GeoPlace = {
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
};

const TZ_GEO: Record<string, GeoPlace> = {
  "Europe/Madrid": { country: "España", countryCode: "ES", city: "Madrid", lat: 40.42, lng: -3.7 },
  "America/Lima": { country: "Perú", countryCode: "PE", city: "Lima", lat: -12.05, lng: -77.05 },
  "America/Bogota": { country: "Colombia", countryCode: "CO", city: "Bogotá", lat: 4.71, lng: -74.07 },
  "America/Santiago": { country: "Chile", countryCode: "CL", city: "Santiago", lat: -33.45, lng: -70.67 },
  "America/Mexico_City": { country: "México", countryCode: "MX", city: "CDMX", lat: 19.43, lng: -99.13 },
  "America/New_York": { country: "Estados Unidos", countryCode: "US", city: "New York", lat: 40.71, lng: -74.01 },
  "America/Los_Angeles": { country: "Estados Unidos", countryCode: "US", city: "Los Angeles", lat: 34.05, lng: -118.24 },
  "Europe/Berlin": { country: "Alemania", countryCode: "DE", city: "Berlin", lat: 52.52, lng: 13.41 },
  "America/Sao_Paulo": { country: "Brasil", countryCode: "BR", city: "São Paulo", lat: -23.55, lng: -46.63 },
  "Europe/London": { country: "Reino Unido", countryCode: "GB", city: "London", lat: 51.51, lng: -0.13 },
  "Asia/Tokyo": { country: "Japón", countryCode: "JP", city: "Tokyo", lat: 35.68, lng: 139.69 },
  "America/Argentina/Buenos_Aires": {
    country: "Argentina",
    countryCode: "AR",
    city: "Buenos Aires",
    lat: -34.6,
    lng: -58.38,
  },
};

const LOCALE_GEO: Record<string, GeoPlace> = {
  "es-es": { country: "España", countryCode: "ES", city: "Madrid", lat: 40.42, lng: -3.7 },
  "es-pe": { country: "Perú", countryCode: "PE", city: "Lima", lat: -12.05, lng: -77.05 },
  "es-mx": { country: "México", countryCode: "MX", city: "CDMX", lat: 19.43, lng: -99.13 },
  "es-ar": { country: "Argentina", countryCode: "AR", city: "Buenos Aires", lat: -34.6, lng: -58.38 },
  "es-co": { country: "Colombia", countryCode: "CO", city: "Bogotá", lat: 4.71, lng: -74.07 },
  "es-cl": { country: "Chile", countryCode: "CL", city: "Santiago", lat: -33.45, lng: -70.67 },
  en: { country: "Estados Unidos", countryCode: "US", city: "New York", lat: 40.71, lng: -74.01 },
  "en-us": { country: "Estados Unidos", countryCode: "US", city: "New York", lat: 40.71, lng: -74.01 },
  "en-gb": { country: "Reino Unido", countryCode: "GB", city: "London", lat: 51.51, lng: -0.13 },
  de: { country: "Alemania", countryCode: "DE", city: "Berlin", lat: 52.52, lng: 13.41 },
  pt: { country: "Brasil", countryCode: "BR", city: "São Paulo", lat: -23.55, lng: -46.63 },
  "pt-br": { country: "Brasil", countryCode: "BR", city: "São Paulo", lat: -23.55, lng: -46.63 },
  ja: { country: "Japón", countryCode: "JP", city: "Tokyo", lat: 35.68, lng: 139.69 },
};

const DEFAULT_GEO: GeoPlace = {
  country: "Desconocido",
  countryCode: "—",
  city: "—",
  lat: 20,
  lng: 0,
};

export function resolveGeoFromClient(timezone?: string, locale?: string): GeoPlace {
  if (timezone && TZ_GEO[timezone]) return TZ_GEO[timezone];
  const loc = locale?.trim().toLowerCase();
  if (loc && LOCALE_GEO[loc]) return LOCALE_GEO[loc];
  return DEFAULT_GEO;
}

/** IP (API) → zona horaria → locale específico (es-pe, es-mx…). */
export async function resolveGeo(input: {
  ip?: string;
  timezone?: string;
  locale?: string;
}): Promise<GeoPlace> {
  const { resolveGeoFromIp } = await import("./ip-geo");
  const fromIp = await resolveGeoFromIp(input.ip);
  if (fromIp) return fromIp;
  return resolveGeoFromClient(input.timezone, input.locale);
}

export function resolveHealth(ramUsage: number, cpuUsage: number): "healthy" | "warning" | "critical" {
  if (ramUsage >= 90 || cpuUsage >= 95) return "critical";
  if (ramUsage >= 75 || cpuUsage >= 80) return "warning";
  return "healthy";
}
