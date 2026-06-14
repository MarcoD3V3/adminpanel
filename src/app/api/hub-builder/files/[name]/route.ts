import { NextResponse } from "next/server";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { dataPath } from "@/lib/data-dir";
import { remoteGetLayoutFile, usesRemoteHubData } from "@/lib/hub-data-authority";
import { parseStoredLayoutFile, verifyReasonMessage } from "@/lib/hub-layout-signing";
import { requireAdminAccess } from "@/lib/launcher-auth/require-admin";

const DIR = dataPath("hub-layouts");

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const denied = await requireAdminAccess(request);
  if (denied) return denied;

  const { name: paramName } = await params;
  const name = String(paramName || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(name)) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  if (usesRemoteHubData()) {
    const remote = await remoteGetLayoutFile(name);
    if (!remote.layout) {
      return NextResponse.json({ error: "Archivo no encontrado en Railway" }, { status: 404 });
    }
    return NextResponse.json({
      layout: remote.layout,
      verified: remote.verified,
      remote: true,
    });
  }

  await mkdir(DIR, { recursive: true });

  try {
    const file = path.join(DIR, `${name}.json`);
    const raw = await readFile(file, "utf-8");
    const verified = parseStoredLayoutFile(raw);
    if (!verified.ok) {
      return NextResponse.json(
        {
          error: verifyReasonMessage(verified.reason),
          reason: verified.reason,
          verified: false,
        },
        { status: 403 }
      );
    }
    return NextResponse.json({
      layout: verified.layout,
      signedAt: verified.signedAt,
      verified: true,
    });
  } catch {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }
}
