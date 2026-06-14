import { NextResponse } from "next/server";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { dataPath } from "@/lib/data-dir";
import { remoteGetPublishedLayout, remotePublishLayout, usesRemoteHubData } from "@/lib/hub-data-authority";
import { defaultHubLayout } from "@/lib/hub-builder-data";
import type { HubLayout } from "@/types/hub-builder";
import { ensureAccountProfileScreen, normalizePerScreenChromeLayout } from "@craftlauncher/shared";
import {
  isLauncherAuthEnforced,
  verifyRequestSession,
} from "@/lib/launcher-auth/service";
import { corsHeaders, jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";
import { requireAdminAccess, requireAdminSession } from "@/lib/launcher-auth/require-admin";
import {
  parseStoredLayoutFile,
  signHubLayout,
  serializeSignedDocument,
} from "@/lib/hub-layout-signing";

const LAYOUT_FILE = dataPath("hub-layout.json");

function isHubLayout(value: unknown): value is HubLayout {
  if (!value || typeof value !== "object") return false;
  const v = value as HubLayout;
  return (
    typeof v.id === "string" &&
    Array.isArray(v.screens) &&
    v.screens.length > 0 &&
    typeof v.activeScreenId === "string" &&
    v.screens.every(
      (s) =>
        (s.scroll === undefined || typeof (s as { scroll?: unknown }).scroll === "boolean") &&
        ((s as { chrome?: unknown }).chrome === undefined ||
          (typeof (s as { chrome?: unknown }).chrome === "object" &&
            Array.isArray(((s as { chrome?: { elements?: unknown } }).chrome as { elements?: unknown }).elements) &&
            typeof ((s as { chrome?: { width?: unknown } }).chrome as { width?: unknown }).width === "number" &&
            typeof ((s as { chrome?: { height?: unknown } }).chrome as { height?: unknown }).height ===
              "number"))
    ) &&
    (v.window === undefined ||
      (v.window &&
        typeof v.window === "object" &&
        ((v.window as { width?: unknown }).width === undefined ||
          typeof (v.window as { width?: unknown }).width === "number") &&
        ((v.window as { height?: unknown }).height === undefined ||
          typeof (v.window as { height?: unknown }).height === "number") &&
        ((v.window as { lockSize?: unknown }).lockSize === undefined ||
          typeof (v.window as { lockSize?: unknown }).lockSize === "boolean") &&
        ((v.window as { borderlessFullscreen?: unknown }).borderlessFullscreen === undefined ||
          typeof (v.window as { borderlessFullscreen?: unknown }).borderlessFullscreen === "boolean"))) &&
    (v.ui === undefined ||
      (v.ui &&
        typeof v.ui === "object" &&
        ((v.ui as { screenTransition?: unknown }).screenTransition === undefined ||
          ["none", "fade", "slide"].includes(String((v.ui as { screenTransition?: unknown }).screenTransition))) &&
        ((v.ui as { transitionMs?: unknown }).transitionMs === undefined ||
          typeof (v.ui as { transitionMs?: unknown }).transitionMs === "number") &&
        ((v.ui as { performanceMode?: unknown }).performanceMode === undefined ||
          typeof (v.ui as { performanceMode?: unknown }).performanceMode === "boolean") &&
        ((v.ui as { rememberLastScreen?: unknown }).rememberLastScreen === undefined ||
          typeof (v.ui as { rememberLastScreen?: unknown }).rememberLastScreen === "boolean") &&
        ((v.ui as { smoothScroll?: unknown }).smoothScroll === undefined ||
          typeof (v.ui as { smoothScroll?: unknown }).smoothScroll === "boolean") &&
        ((v.ui as { homeScreenId?: unknown }).homeScreenId === undefined ||
          typeof (v.ui as { homeScreenId?: unknown }).homeScreenId === "string"))) &&
    (v.accountSurface === undefined ||
      (typeof v.accountSurface === "object" &&
        Array.isArray(v.accountSurface.screens) &&
        typeof v.accountSurface.activeScreenId === "string")) &&
    (v.launcherChrome === undefined ||
      (typeof v.launcherChrome === "object" &&
        Array.isArray((v.launcherChrome as { elements?: unknown }).elements) &&
        typeof (v.launcherChrome as { width?: unknown }).width === "number" &&
        typeof (v.launcherChrome as { height?: unknown }).height === "number"))
  );
}

async function readSavedLayout(): Promise<HubLayout | null> {
  try {
    const raw = await readFile(LAYOUT_FILE, "utf-8");
    if (!raw.trim()) return null;
    const verified = parseStoredLayoutFile(raw);
    if (verified.ok) return verified.layout;
    return null;
  } catch {
    return null;
  }
}

async function requireHubLayoutReadAccess(request: Request, origin: string | null) {
  if (!isLauncherAuthEnforced()) return null;

  const result = await verifyRequestSession(
    request.headers.get("authorization"),
    request.headers.get("x-device-id"),
    request.headers.get("x-device-fingerprint")
  );

  if (result.valid) return null;

  // El editor admin (misma sesión del panel) también puede leer el layout publicado.
  const adminDenied = await requireAdminSession();
  if (!adminDenied) return null;

  return jsonWithCors(
    { error: "Sesión inválida. Activa el launcher con un token.", reason: result.reason },
    { status: 401 },
    origin
  );
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const denied = await requireHubLayoutReadAccess(request, origin);
  if (denied) return denied;

  let saved: HubLayout | null = null;
  if (usesRemoteHubData()) {
    saved = await remoteGetPublishedLayout();
  }
  if (!saved) {
    saved = await readSavedLayout();
  }
  const layout = ensureAccountProfileScreen(saved ?? defaultHubLayout);
  const res = NextResponse.json({ layout });
  const cors = corsHeaders(origin);
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

export async function POST(request: Request) {
  const denied = await requireAdminAccess(request);
  if (denied) return denied;

  const origin = request.headers.get("origin");
  try {
    const body: unknown = await request.json();
    const { auditAdminRequest } = await import("@/lib/security/guard");
    await auditAdminRequest(request, body);
    if (!isHubLayout(body)) {
      return jsonWithCors({ success: false, message: "Layout inválido" }, { status: 400 }, origin);
    }
    const layout: HubLayout = ensureAccountProfileScreen(
      normalizePerScreenChromeLayout({
        ...body,
        updatedAt: new Date().toISOString(),
      })
    );
    const signed = signHubLayout(layout);
    if (!signed) {
      return jsonWithCors(
        { success: false, message: "No se pudo firmar el layout (LAUNCHER_ADMIN_SECRET)" },
        { status: 503 },
        origin
      );
    }

    if (usesRemoteHubData()) {
      const ok = await remotePublishLayout(layout);
      if (!ok) {
        return jsonWithCors(
          { success: false, message: "No se pudo publicar en el servidor Railway" },
          { status: 502 },
          origin
        );
      }
    } else {
      await mkdir(path.dirname(LAYOUT_FILE), { recursive: true });
      const tmp = `${LAYOUT_FILE}.tmp`;
      await writeFile(tmp, serializeSignedDocument(signed), "utf-8");
      await rename(tmp, LAYOUT_FILE);
    }

    const { emitSystemEvent } = await import("@/lib/system-events");
    emitSystemEvent("hub.published", {
      screens: layout.screens.length,
      layoutId: layout.id,
      updatedAt: layout.updatedAt,
    });

    return jsonWithCors(
      { success: true, message: "Layout del hub guardado", layout },
      { status: 200 },
      origin
    );
  } catch {
    return jsonWithCors({ success: false, message: "Error al guardar" }, { status: 500 }, origin);
  }
}
