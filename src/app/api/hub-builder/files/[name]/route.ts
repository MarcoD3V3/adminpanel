import { NextResponse } from "next/server";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { parseStoredLayoutFile, verifyReasonMessage } from "@/lib/hub-layout-signing";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

const DIR = path.join(process.cwd(), "data", "hub-layouts");

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  await mkdir(DIR, { recursive: true });
  const { name: paramName } = await params;
  const name = String(paramName || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(name)) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

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
