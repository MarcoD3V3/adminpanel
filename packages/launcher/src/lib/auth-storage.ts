import { getLauncherApi } from "./electron-api";

const SESSION_COOKIE = "cl_session";
const SESSION_STORAGE = "cl_session_backup";
const DEVICE_KEY = "cl_device_id";
const FINGERPRINT_KEY = "cl_device_fp";
const USERNAME_KEY = "cl_username";
const SESSION_MAX_AGE = 90 * 24 * 3600;

type PersistedAuth = {
  sessionToken: string;
  deviceId: string;
  fingerprint: string;
  username?: string | null;
};

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function loadFromDisk(): Promise<PersistedAuth | null> {
  const api = getLauncherApi();
  if (!api?.loadAuth) return null;
  try {
    const data = (await api.loadAuth()) as PersistedAuth | null;
    if (!data?.sessionToken?.startsWith("clses_")) return null;
    return data;
  } catch {
    return null;
  }
}

async function saveToDisk(data: PersistedAuth): Promise<void> {
  const api = getLauncherApi();
  if (!api?.saveAuth) return;
  try {
    await api.saveAuth(data);
  } catch {
    /* ignore */
  }
}

async function clearDisk(): Promise<void> {
  const api = getLauncherApi();
  if (!api?.clearAuth) return;
  try {
    await api.clearAuth();
  } catch {
    /* ignore */
  }
}

function applySessionLocally(sessionToken: string): void {
  localStorage.setItem(SESSION_STORAGE, sessionToken);
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; path=/; max-age=${SESSION_MAX_AGE}; SameSite=Lax`;
}

function readCookieSession(): string | null {
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  return value?.startsWith("clses_") ? value : null;
}

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Huella estable: se calcula una vez y se reutiliza siempre (evita invalidar sesión). */
export async function getDeviceFingerprint(): Promise<string> {
  const cached = localStorage.getItem(FINGERPRINT_KEY);
  if (cached && /^[0-9a-f]{64}$/i.test(cached)) return cached;

  const deviceId = getOrCreateDeviceId();
  const parts = [deviceId, navigator.platform, navigator.userAgent].join("|");
  const fp = await sha256Hex(parts);
  localStorage.setItem(FINGERPRINT_KEY, fp);
  return fp;
}

export function getSession(): string | null {
  const fromStorage = localStorage.getItem(SESSION_STORAGE);
  if (fromStorage?.startsWith("clses_")) return fromStorage;
  if (fromStorage) localStorage.removeItem(SESSION_STORAGE);

  return readCookieSession();
}

/** Restaura sesión desde el archivo de Electron (fuente de verdad tras recargas / HMR). */
export async function hydrateAuthFromDisk(): Promise<void> {
  const disk = await loadFromDisk();
  if (!disk) return;

  if (disk.deviceId) localStorage.setItem(DEVICE_KEY, disk.deviceId);
  if (disk.fingerprint) localStorage.setItem(FINGERPRINT_KEY, disk.fingerprint);
  persistUsername(disk.username);

  const local = getSession();
  if (!local || local !== disk.sessionToken) {
    applySessionLocally(disk.sessionToken);
  }
}

function readCachedUsername(): string | null {
  const fromProfile = localStorage.getItem(USERNAME_KEY);
  if (fromProfile && /^[a-zA-Z0-9_]{3,16}$/.test(fromProfile)) return fromProfile;
  return null;
}

function persistUsername(username: string | null | undefined) {
  if (username && /^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    localStorage.setItem(USERNAME_KEY, username);
  }
}

export async function ensureDiskBackup(): Promise<void> {
  const session = getSession();
  if (!session) return;
  await saveToDisk({
    sessionToken: session,
    deviceId: getOrCreateDeviceId(),
    fingerprint: await getDeviceFingerprint(),
    username: readCachedUsername(),
  });
}

export async function setSession(
  sessionToken: string,
  profile?: { username?: string | null }
): Promise<void> {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  applySessionLocally(sessionToken);

  const deviceId = getOrCreateDeviceId();
  const fingerprint = await getDeviceFingerprint();
  const username = profile?.username ?? readCachedUsername();
  persistUsername(username);
  await saveToDisk({ sessionToken, deviceId, fingerprint, username });
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE);
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  void clearDisk();
}

export async function buildAuthHeaders() {
  await hydrateAuthFromDisk();
  const session = getSession();
  if (!session) return null;
  return {
    authorization: `Bearer ${session}`,
    deviceId: getOrCreateDeviceId(),
    fingerprint: await getDeviceFingerprint(),
  };
}
