import { NextResponse } from "next/server";
import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";
import type { HubLayout } from "@/types/hub-builder";
import { dataPath } from "@/lib/data-dir";
import { remoteSaveLayoutFile, usesRemoteHubData } from "@/lib/hub-data-authority";
import {
  isHubLayoutShape,
  signHubLayout,
  serializeSignedDocument,
} from "@/lib/hub-layout-signing";
import { requireAdminAccess } from "@/lib/launcher-auth/require-admin";

const DIR = dataPath("hub-layouts");

function safeName(name: string) {
  const n = name.trim().replace(/\.json$/i, "");
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(n)) return null;
  return n;
}

export async function GET(request: Request) {
  const denied = await requireAdminAccess(request);
  if (denied) return denied;

  if (usesRemoteHubData()) {
    return NextResponse.json({ files: ["_autosave"], remote: true });
  }

  await mkdir(DIR, { recursive: true });
  const files = (await readdir(DIR)).filter((f) => f.toLowerCase().endsWith(".json"));
  return NextResponse.json({ files: files.map((f) => f.replace(/\.json$/i, "")) });
}

export async function POST(request: Request) {
  const denied = await requireAdminAccess(request);
  if (denied) return denied;

  const body = (await request.json()) as { name?: string; layout?: HubLayout };
  const name = body.name ? safeName(body.name) : null;
  if (!name || !body.layout || !isHubLayoutShape(body.layout)) {
    return NextResponse.json({ success: false, error: "Nombre o layout inválido" }, { status: 400 });
  }

  if (usesRemoteHubData()) {
    const ok = await remoteSaveLayoutFile(name, body.layout);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "No se pudo guardar en Railway (revisa HUB_DATA_AUTHORITY_URL y LAUNCHER_ADMIN_SECRET)" },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, name, remote: true });
  }

  const signed = signHubLayout(body.layout);
  if (!signed) {
    return NextResponse.json(
      { success: false, error: "No se pudo firmar el layout (LAUNCHER_ADMIN_SECRET)" },
      { status: 503 }
    );
  }

  await mkdir(DIR, { recursive: true });
  const signedJson = serializeSignedDocument(signed);
  const file = path.join(DIR, `${name}.json`);
  await writeFile(file, signedJson, "utf-8");
  return NextResponse.json({ success: true, name, signedJson });
}
