import { createHmac, timingSafeEqual } from "node:crypto";
import type { HubLayout } from "@/types/hub-builder";

export const SIGNED_LAYOUT_SCHEMA = 1;

export type SignedHubLayoutDocument = {
  craftlauncherSigned: true;
  schema: typeof SIGNED_LAYOUT_SCHEMA;
  signedAt: string;
  signature: string;
  layout: HubLayout;
};

export type LayoutVerifyReason =
  | "ok"
  | "unsigned"
  | "tampered"
  | "invalid"
  | "no_signing_key"
  | "unsupported_schema"
  | "parse_error";

export type LayoutVerifyResult =
  | { ok: true; layout: HubLayout; signedAt: string }
  | { ok: false; reason: Exclude<LayoutVerifyReason, "ok"> };

function signingKey(): string | null {
  const admin = process.env.LAUNCHER_ADMIN_SECRET;
  if (admin && admin.length >= 16) return admin;
  const pepper = process.env.LAUNCHER_TOKEN_PEPPER;
  if (pepper && pepper.length >= 16) return pepper;
  if (process.env.NODE_ENV !== "production") return "dev-layout-signing-key-min16";
  return null;
}

export function isHubLayoutShape(value: unknown): value is HubLayout {
  if (!value || typeof value !== "object") return false;
  const v = value as HubLayout;
  return (
    typeof v.id === "string" &&
    typeof v.activeScreenId === "string" &&
    Array.isArray(v.screens) &&
    v.screens.length > 0 &&
    v.screens.every(
      (s) =>
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        Array.isArray(s.elements)
    )
  );
}

function isSignedDocument(value: unknown): value is SignedHubLayoutDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as SignedHubLayoutDocument;
  return (
    doc.craftlauncherSigned === true &&
    doc.schema === SIGNED_LAYOUT_SCHEMA &&
    typeof doc.signedAt === "string" &&
    typeof doc.signature === "string" &&
    isHubLayoutShape(doc.layout)
  );
}

/** JSON estable del layout (sin metadatos de firma). */
export function canonicalLayoutPayload(layout: HubLayout): string {
  return JSON.stringify(layout);
}

function computeSignature(layout: HubLayout): string | null {
  const key = signingKey();
  if (!key) return null;
  const payload = canonicalLayoutPayload(layout);
  return createHmac("sha256", key).update(`craftlauncher-hub-v1:${payload}`).digest("hex");
}

function secureCompareHex(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signHubLayout(layout: HubLayout): SignedHubLayoutDocument | null {
  const signature = computeSignature(layout);
  if (!signature) return null;
  return {
    craftlauncherSigned: true,
    schema: SIGNED_LAYOUT_SCHEMA,
    signedAt: new Date().toISOString(),
    signature,
    layout,
  };
}

export function verifySignedDocument(doc: unknown): LayoutVerifyResult {
  if (!isSignedDocument(doc)) {
    return { ok: false, reason: "invalid" };
  }
  if (!signingKey()) {
    return { ok: false, reason: "no_signing_key" };
  }
  const expected = computeSignature(doc.layout);
  if (!expected || !secureCompareHex(expected, doc.signature)) {
    return { ok: false, reason: "tampered" };
  }
  return { ok: true, layout: doc.layout, signedAt: doc.signedAt };
}

export function parseStoredLayoutFile(raw: string): LayoutVerifyResult {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSignedDocument(parsed)) {
      return verifySignedDocument(parsed);
    }
    if (isHubLayoutShape(parsed)) {
      return { ok: false, reason: "unsigned" };
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "layout" in parsed &&
      isHubLayoutShape((parsed as { layout: unknown }).layout)
    ) {
      return verifySignedDocument(parsed);
    }
    return { ok: false, reason: "invalid" };
  } catch {
    return { ok: false, reason: "parse_error" };
  }
}

export function serializeSignedDocument(doc: SignedHubLayoutDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function verifyReasonMessage(reason: Exclude<LayoutVerifyReason, "ok">): string {
  switch (reason) {
    case "unsigned":
      return "Este archivo no está firmado por el panel admin. Puede estar corrupto o editado a mano.";
    case "tampered":
      return "La firma digital no coincide. El archivo fue modificado fuera del panel admin.";
    case "invalid":
      return "El archivo no tiene un formato de layout válido.";
    case "no_signing_key":
      return "El servidor no tiene configurada la clave de firma (LAUNCHER_ADMIN_SECRET).";
    case "unsupported_schema":
      return "Versión de firma no compatible.";
    case "parse_error":
      return "No se pudo leer el JSON. El archivo puede estar corrupto.";
    default:
      return "No se pudo verificar el archivo.";
  }
}
