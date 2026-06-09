import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { jsonWithCors, optionsResponse } from "@/lib/launcher-auth/http";

const SETTINGS_FILE = path.join(process.cwd(), "data", "catalog-settings.json");

type CatalogSettings = {
  featuredTabLabel?: string;
};

function readSettings(): CatalogSettings {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as CatalogSettings;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSettings(settings: CatalogSettings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
}

export async function OPTIONS(request: Request) {
  return optionsResponse(request.headers.get("origin"));
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const settings = readSettings();
  return jsonWithCors(
    { settings: { featuredTabLabel: settings.featuredTabLabel ?? "Eventos" } },
    { status: 200 },
    origin
  );
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { settings?: CatalogSettings };
  const next: CatalogSettings = {
    featuredTabLabel:
      typeof body.settings?.featuredTabLabel === "string"
        ? body.settings.featuredTabLabel.trim().slice(0, 24)
        : undefined,
  };
  writeSettings(next);
  return NextResponse.json({ success: true, settings: next });
}

