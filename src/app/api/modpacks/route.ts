import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { FeaturedModpack } from "@craftlauncher/shared";
import { jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";

const DATA_FILE = path.join(process.cwd(), "data", "modpacks.json");

function readModpacks(): FeaturedModpack[] {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw) as FeaturedModpack[];
  } catch {
    return [];
  }
}

function computeCatalogRev(modpacks: FeaturedModpack[]): string {
  const maxUpdatedAt = modpacks
    .map((m) => (typeof m.updatedAt === "string" ? Date.parse(m.updatedAt) : 0))
    .reduce((a, b) => Math.max(a, b), 0);
  if (maxUpdatedAt > 0) return String(maxUpdatedAt);
  try {
    return String(fs.statSync(DATA_FILE).mtimeMs || 0);
  } catch {
    return "0";
  }
}

function writeModpacks(modpacks: FeaturedModpack[]) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(modpacks, null, 2), "utf-8");
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const modpacks = readModpacks();
  const rev = computeCatalogRev(modpacks);
  return jsonWithCors({ modpacks, rev }, { status: 200 }, origin);
}

export async function POST(request: Request) {
  const body = (await request.json()) as FeaturedModpack;
  const modpacks = readModpacks();
  const idx = modpacks.findIndex((m) => m.id === body.id);
  if (idx >= 0) modpacks[idx] = { ...modpacks[idx], ...body, updatedAt: new Date().toISOString() };
  else modpacks.unshift({ ...body, updatedAt: new Date().toISOString() });
  writeModpacks(modpacks);
  return NextResponse.json({ success: true, modpacks });
}

export async function PUT(request: Request) {
  const body = await request.json();
  if (!Array.isArray(body.modpacks)) {
    return NextResponse.json({ error: "modpacks array required" }, { status: 400 });
  }
  writeModpacks(body.modpacks);
  return NextResponse.json({ success: true, modpacks: body.modpacks });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const modpacks = readModpacks().filter((m) => m.id !== id);
  writeModpacks(modpacks);
  return NextResponse.json({ success: true, modpacks });
}
