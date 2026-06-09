import { NextRequest, NextResponse } from "next/server";

const MAX_BYTES = 12 * 1024 * 1024;

function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Proxy de imágenes de fondo para el Hub Builder (evita hotlink/CORS en el canvas). */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url")?.trim();
  if (!target || !isAllowedUrl(target)) {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "CraftLauncher-HubBuilder/1.0",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `No se pudo cargar la imagen (${upstream.status})` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "La URL no devolvió una imagen. Usa un enlace directo (.jpg, .png, .webp)." },
        { status: 415 }
      );
    }

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Imagen demasiado grande (máx. 12 MB)" }, { status: 413 });
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al descargar la imagen" }, { status: 502 });
  }
}
