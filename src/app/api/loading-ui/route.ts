import { NextResponse } from "next/server";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import {
  legacyLoadingUiFile,
  loadingUiFileForVersion,
  normalizeMcVersionParam,
} from "@/lib/versioned-ui-paths";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export type LoadingUi = {
  schema: number;
  mcVersion?: string;
  backgroundColor: string;
  backgroundImage?: string;
  overlayColor?: string;
  progress: {
    enabled: boolean;
    anchorX: string;
    anchorY: string;
    offsetX: number;
    offsetY: number;
    widthRatio: number;
    height: number;
    color: string;
    trackColor: string;
  };
  elements: Array<{
    type: "label";
    text: string;
    anchorX: string;
    anchorY: string;
    offsetX: number;
    offsetY: number;
    w: number;
    h: number;
    textColor?: string;
  }>;
};

function defaultUi(mcVersion: string): LoadingUi {
  return {
    schema: 1,
    mcVersion,
    backgroundColor: "#0a0b0d",
    backgroundImage: "",
    overlayColor: "#00000055",
    progress: {
      enabled: true,
      anchorX: "center",
      anchorY: "top",
      offsetX: 0,
      offsetY: 146,
      widthRatio: 0.42,
      height: 3,
      color: "#6b9e78",
      trackColor: "#1a1d22",
    },
    elements: [
      {
        type: "label",
        text: "CraftLauncher",
        anchorX: "center",
        anchorY: "top",
        offsetX: 0,
        offsetY: 100,
        w: 200,
        h: 16,
        textColor: "#c8cad0",
      },
    ],
  };
}

function isLoadingUi(v: unknown): v is LoadingUi {
  return Boolean(v && typeof v === "object" && "progress" in (v as object));
}

async function readUi(mcVersion: string): Promise<LoadingUi> {
  const cwd = process.cwd();
  const file = loadingUiFileForVersion(cwd, mcVersion);
  try {
    const raw = await readFile(file, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (isLoadingUi(parsed)) return { ...parsed, mcVersion };
  } catch {
    /* migrar legacy */
  }
  if (mcVersion === "1.18.2") {
    try {
      const raw = await readFile(legacyLoadingUiFile(cwd), "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (isLoadingUi(parsed)) return { ...parsed, mcVersion };
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
  const denied = await requireAdminSession();
  if (denied) return denied;

  try {
    const mcVersion = normalizeMcVersionParam(new URL(request.url).searchParams.get("version"));
    const body: unknown = await request.json();
    if (!isLoadingUi(body)) {
      return NextResponse.json({ ok: false, message: "UI inválida" }, { status: 400, headers: CORS });
    }
    const ui = { ...body, mcVersion };
    const file = loadingUiFileForVersion(process.cwd(), mcVersion);
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(ui, null, 2), "utf-8");
    await rename(tmp, file);
    return NextResponse.json({ ok: true, ui }, { headers: CORS });
  } catch {
    return NextResponse.json({ ok: false, message: "Error al guardar" }, { status: 500, headers: CORS });
  }
}
