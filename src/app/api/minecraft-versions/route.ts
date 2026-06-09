import { NextResponse } from "next/server";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { applyModBuiltFlags } from "@/lib/mod-jar-status";
import {
  mergeVersionRegistry,
  type MinecraftVersionProfile,
} from "@/lib/minecraft-versions";

const FILE = path.join(process.cwd(), "data", "minecraft-versions.json");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type RegistryFile = {
  schema: number;
  versions: Array<Pick<MinecraftVersionProfile, "id" | "enabled" | "label">>;
};

async function readRegistry(): Promise<MinecraftVersionProfile[]> {
  try {
    const raw = await readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw) as RegistryFile;
    return applyModBuiltFlags(mergeVersionRegistry(parsed.versions));
  } catch {
    return applyModBuiltFlags(mergeVersionRegistry(null));
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

export async function GET() {
  const versions = await readRegistry();
  return NextResponse.json(
    {
      schema: 1,
      versions,
      enabled: versions.filter((v) => v.enabled),
    },
    { headers: CORS }
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { versions?: RegistryFile["versions"] };
    if (!body?.versions || !Array.isArray(body.versions)) {
      return NextResponse.json({ ok: false, message: "Formato inválido" }, { status: 400, headers: CORS });
    }
    const payload: RegistryFile = { schema: 1, versions: body.versions };
    await mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
    await rename(tmp, FILE);
    const merged = applyModBuiltFlags(mergeVersionRegistry(body.versions));
    return NextResponse.json(
      { ok: true, versions: merged, enabled: merged.filter((v) => v.enabled) },
      { headers: CORS }
    );
  } catch {
    return NextResponse.json({ ok: false, message: "Error al guardar" }, { status: 500, headers: CORS });
  }
}
