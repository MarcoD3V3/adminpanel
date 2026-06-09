import { NextResponse } from "next/server";
import { mkdir, readFile } from "fs/promises";
import path from "path";

const DIR = path.join(process.cwd(), "data", "hub-layouts");

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  await mkdir(DIR, { recursive: true });
  const { name: paramName } = await params;
  const name = String(paramName || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(name)) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }
  const file = path.join(DIR, `${name}.json`);
  const raw = await readFile(file, "utf-8");
  const res = new NextResponse(raw, { status: 200 });
  res.headers.set("Content-Type", "application/json; charset=utf-8");
  return res;
}

