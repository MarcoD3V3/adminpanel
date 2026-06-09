const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT_RE = /^[0-9a-f]{64}$/i;
const ID_RE = /^[a-z]+_[0-9a-f]+$/i;

export function isValidDeviceId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function isValidFingerprint(value: string): boolean {
  return FINGERPRINT_RE.test(value.trim());
}

export function isValidRecordId(value: string): boolean {
  return ID_RE.test(value.trim()) && value.length <= 64;
}

export function sanitizeIpHint(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, 64);
  return trimmed || undefined;
}
