import { NextResponse } from "next/server";
import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";
import type { HubLayout } from "@/types/hub-builder";
import {
  isHubLayoutShape,
  signHubLayout,
  serializeSignedDocument,
} from "@/lib/hub-layout-signing";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

const DIR = path.join(process.cwd(), "data", "hub-layouts");

function safeName(name: string) {
  const n = name.trim().replace(/\.json$/i, "");
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(n)) return null;
  return n;
}

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  await mkdir(DIR, { recursive: true });
  const files = (await readdir(DIR)).filter((f) => f.toLowerCase().endsWith(".json"));
  return NextResponse.json({ files: files.map((f) => f.replace(/\.json$/i, "")) });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  await mkdir(DIR, { recursive: true });
  const body = (await request.json()) as { name?: string; layout?: HubLayout };
  const name = body.name ? safeName(body.name) : null;
  if (!name || !body.layout || !isHubLayoutShape(body.layout)) {
    return NextResponse.json({ success: false, error: "Nombre o layout inválido" }, { status: 400 });
  }

  const signed = signHubLayout(body.layout);
  if (!signed) {
    return NextResponse.json(
      { success: false, error: "No se pudo firmar el layout (LAUNCHER_ADMIN_SECRET)" },
      { status: 503 }
    );
  }

  const signedJson = serializeSignedDocument(signed);
  const file = path.join(DIR, `${name}.json`);
  await writeFile(file, signedJson, "utf-8");
  return NextResponse.json({ success: true, name, signedJson });
}

