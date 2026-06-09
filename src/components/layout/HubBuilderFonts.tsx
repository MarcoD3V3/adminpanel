"use client";

import { HUB_TEXT_FONTS_PRECONNECT, HUB_TEXT_FONTS_STYLESHEETS } from "@craftlauncher/shared";

/** Fuentes del editor — solo en rutas que las necesitan (no en todo el admin). */
export function HubBuilderFonts() {
  return (
    <>
      {HUB_TEXT_FONTS_PRECONNECT.map((origin) => (
        <link
          key={origin}
          rel="preconnect"
          href={origin}
          crossOrigin={origin.includes("gstatic") || origin.includes("cdnfonts") ? "anonymous" : undefined}
        />
      ))}
      {HUB_TEXT_FONTS_STYLESHEETS.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
    </>
  );
}
