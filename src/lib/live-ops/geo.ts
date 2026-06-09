export function latLngToMapPercent(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  };
}

type GeoPlace = {
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
};

const TZ_GEO: Record<string, GeoPlace> = {
  "Europe/Madrid": { country: "España", countryCode: "ES", city: "Madrid", lat: 40.42, lng: -3.7 },
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
  es: { country: "España", countryCode: "ES", city: "Madrid", lat: 40.42, lng: -3.7 },
  "es-es": { country: "España", countryCode: "ES", city: "Madrid", lat: 40.42, lng: -3.7 },
  "es-mx": { country: "México", countryCode: "MX", city: "CDMX", lat: 19.43, lng: -99.13 },
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
  if (loc) {
    if (LOCALE_GEO[loc]) return LOCALE_GEO[loc];
    const base = loc.split("-")[0];
    if (base && LOCALE_GEO[base]) return LOCALE_GEO[base];
  }
  return DEFAULT_GEO;
}

export function resolveHealth(ramUsage: number, cpuUsage: number): "healthy" | "warning" | "critical" {
  if (ramUsage >= 90 || cpuUsage >= 95) return "critical";
  if (ramUsage >= 75 || cpuUsage >= 80) return "warning";
  return "healthy";
}
