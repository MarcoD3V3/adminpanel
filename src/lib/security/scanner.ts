import type { SecurityDetectionType } from "@/types/features";

const XSS_PATTERNS = [
  /<script\b/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /data:text\/html/i,
  /<iframe/i,
];

const SQLI_PATTERNS = [
  /(\bunion\b.+\bselect\b)/i,
  /(\bor\b\s+1\s*=\s*1)/i,
  /(\bdrop\b\s+\btable\b)/i,
  /(--|#|\/\*)/,
  /(\bexec\b|\bxp_)/i,
];

const TRAVERSAL_PATTERNS = [/\.\.\//, /\.\.\\/, /%2e%2e%2f/i, /\/etc\/passwd/i];

const DATA_TAMPER_KEYS = [
  "__proto__",
  "constructor",
  "prototype",
  "isAdmin",
  "role",
  "permissions",
  "bypass",
  "adminOverride",
];

export function scanTextForThreats(text: string): SecurityDetectionType | null {
  const sample = text.slice(0, 8000);
  if (TRAVERSAL_PATTERNS.some((p) => p.test(sample))) return "admin_path_traversal";
  if (SQLI_PATTERNS.some((p) => p.test(sample))) return "admin_sql_injection";
  if (XSS_PATTERNS.some((p) => p.test(sample))) return "admin_xss_attempt";
  return null;
}

export function scanObjectForThreats(value: unknown, depth = 0): SecurityDetectionType | null {
  if (depth > 6) return null;
  if (typeof value === "string") return scanTextForThreats(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = scanObjectForThreats(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (DATA_TAMPER_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
        return "admin_data_tamper";
      }
      const hit = scanObjectForThreats(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

export function scanUrlForThreats(url: string): SecurityDetectionType | null {
  return scanTextForThreats(decodeURIComponent(url));
}

export function isSuspiciousUserAgent(ua: string | null): boolean {
  if (!ua || ua.trim().length < 6) return true;
  return /sqlmap|nikto|nmap|masscan|curl\/|python-requests|scrapy|headless/i.test(ua);
}

const KNOWN_CHEAT_SIGNATURES = [
  "wurst",
  "impact",
  "liquidbounce",
  "sigma",
  "aristois",
  "future",
  "meteor",
  "inertia",
];

export function matchCheatClient(name: string): string | null {
  const lower = name.toLowerCase();
  const hit = KNOWN_CHEAT_SIGNATURES.find((c) => lower.includes(c));
  return hit ?? null;
}
