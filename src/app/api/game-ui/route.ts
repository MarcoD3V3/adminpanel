import { NextResponse } from "next/server";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import {
  gameUiFileForVersion,
  legacyGameUiFile,
  normalizeMcVersionParam,
} from "@/lib/versioned-ui-paths";
import { normalizeGameUi } from "@/lib/game-ui-validate";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export type GameUiElement = {
  type: "button" | "label";
  text: string;
  anchorX?: "left" | "center" | "right";
  anchorY?: "top" | "center" | "bottom";
  offsetX?: number;
  offsetY?: number;
  w: number;
  h: number;
  action?: "singleplayer" | "multiplayer" | "options" | "mods" | "quit" | "url" | "join_server" | "none";
  url?: string;
  server?: string;
  bg?: string;
  bgHover?: string;
  border?: string;
  textColor?: string;
  binding?: string;
};

export type GameUi = {
  schema: number;
  mcVersion?: string;
  designWidth?: number;
  designHeight?: number;
  targetWindowWidth?: number;
  targetWindowHeight?: number;
  hideVanillaDecor?: boolean;
  elements: GameUiElement[];
};

const B = { bg: "#2b2e33", bgHover: "#3a3e45", border: "#5b5f66", textColor: "#e8eaed" } as const;

function defaultUi(mcVersion: string): GameUi {
  return {
    schema: 2,
    mcVersion,
    elements: [
      { type: "button", text: "Singleplayer", anchorX: "center", anchorY: "top", offsetX: 5, offsetY: 76, w: 98, h: 11, action: "singleplayer", ...B },
      { type: "button", text: "Multiplayer", anchorX: "center", anchorY: "center", offsetX: 0, offsetY: 1, w: 98, h: 11, action: "multiplayer", ...B },
      { type: "button", text: "Options", anchorX: "left", anchorY: "top", offsetX: 69, offsetY: 78, w: 48, h: 11, action: "options", ...B },
      { type: "button", text: "Mods", anchorX: "left", anchorY: "top", offsetX: 119, offsetY: 78, w: 48, h: 11, action: "mods", ...B },
      { type: "button", text: "YouTube", anchorX: "center", anchorY: "top", offsetX: 1, offsetY: 96, w: 98, h: 11, action: "url", url: "https://www.youtube.com", ...B },
      { type: "button", text: "Discord", anchorX: "center", anchorY: "top", offsetX: 1, offsetY: 116, w: 98, h: 11, action: "url", url: "https://discord.com", ...B },
    ],
  };
}

function isGameUi(v: unknown): v is { schema?: number; elements: unknown[] } {
  return Boolean(v && typeof v === "object" && Array.isArray((v as { elements?: unknown }).elements));
}

async function readUi(mcVersion: string): Promise<GameUi> {
  const cwd = process.cwd();
  const file = gameUiFileForVersion(cwd, mcVersion);
  try {
    const raw = await readFile(file, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (isGameUi(parsed)) {
      const { ui } = normalizeGameUi(parsed as Record<string, unknown>);
      return { ...ui, mcVersion, elements: ui.elements as GameUiElement[] };
    }
  } catch {
    /* migrar legacy */
  }
  if (mcVersion === "1.18.2") {
    try {
      const raw = await readFile(legacyGameUiFile(cwd), "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (isGameUi(parsed)) {
        const { ui } = normalizeGameUi(parsed as Record<string, unknown>);
        return { ...ui, mcVersion, elements: ui.elements as GameUiElement[] };
      }
    } catch {
      /* default */
    }
  }
  return defaultUi(mcVersion);
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

export async function GET(request: Request) {
  const mcVersion = normalizeMcVersionParam(new URL(request.url).searchParams.get("version"));
  const ui = await readUi(mcVersion);
  return NextResponse.json(ui, { headers: CORS });
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const mcVersion = normalizeMcVersionParam(url.searchParams.get("version"));
    const body: unknown = await request.json();
    if (!isGameUi(body)) {
      return NextResponse.json({ ok: false, message: "UI inválida" }, { status: 400, headers: CORS });
    }
    const { ui, warnings } = normalizeGameUi(body as Record<string, unknown>);
    const payload: GameUi = {
      ...ui,
      mcVersion,
      elements: ui.elements as GameUiElement[],
    };
    const file = gameUiFileForVersion(process.cwd(), mcVersion);
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
    await rename(tmp, file);
    return NextResponse.json({ ok: true, ui: payload, warnings }, { headers: CORS });
  } catch {
    return NextResponse.json({ ok: false, message: "Error al guardar" }, { status: 500, headers: CORS });
  }
}
