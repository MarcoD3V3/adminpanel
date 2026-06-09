"use client";

/** Capa decorativa de la pantalla de carga (fondo + overlay tipo blur). */
export function GameLoadingDecor({
  width,
  height,
  backgroundColor,
  backgroundImage,
}: {
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundImage?: string;
}) {
  const bg = backgroundColor || "#0a0b0d";
  const hasImage = Boolean(backgroundImage?.trim());

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] select-none overflow-hidden" aria-hidden>
      {hasImage ? (
        <>
          <div
            className="absolute inset-0 scale-110 bg-cover bg-center"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              filter: "blur(18px) brightness(0.45)",
            }}
          />
          <div className="absolute inset-0 bg-black/40" />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: bg }} />
      )}
      {!hasImage && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(100% 80% at 50% 20%, rgba(255,255,255,0.04) 0%, transparent 55%)",
          }}
        />
      )}
    </div>
  );
}
