import { NextResponse } from "next/server";
import { resolveCurseForgeApiKey } from "@/lib/curseforge-key";

const CF_BASE = "https://api.curseforge.com/v1";

/** Proxy CurseForge para el admin (evita exponer la key al navegador en producción si se usa server-side) */
export async function GET(request: Request) {
  const key = resolveCurseForgeApiKey();
  if (!key) {
    return NextResponse.json(
      {
        error:
          "CURSEFORGE_API_KEY no configurada en .env.local. Pégala en una línea CURSEFORGE_API_KEY=... y reinicia npm run dev.",
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") ?? "/mods/search";
  const url = new URL(`${CF_BASE}${path}`);

  for (const [k, v] of searchParams.entries()) {
    if (k === "path") continue;
    url.searchParams.set(k, v);
  }

  if (!url.searchParams.has("gameId")) url.searchParams.set("gameId", "432");

  const res = await fetch(url, {
    headers: { "x-api-key": key, Accept: "application/json" },
    next: { revalidate: 300 },
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
