/** URLs compartidas para <link> en Next.js y Electron (carga temprana de fuentes). */
export const HUB_TEXT_FONTS_PRECONNECT = [
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
  "https://fonts.cdnfonts.com",
] as const;

export const HUB_TEXT_FONTS_GOOGLE_HREF =
  "https://fonts.googleapis.com/css2?family=Audiowide&family=Bebas+Neue&family=Bungee&family=Cinzel+Decorative:wght@400;700&family=DotGothic16&family=Kaushan+Script&family=Lobster&family=MedievalSharp&family=Montserrat:wght@700;800;900&family=Orbitron:wght@400;700&family=Pacifico&family=Permanent+Marker&family=Pixelify+Sans:wght@400..700&family=Press+Start+2P&family=Righteous&family=Silkscreen:wght@400;700&family=Sixtyfour&family=VT323&display=swap";

export const HUB_TEXT_FONTS_MINECRAFTER_HREF = "https://fonts.cdnfonts.com/css/minecrafter";
export const HUB_TEXT_FONTS_MINECRAFTER_ALT_HREF = "https://fonts.cdnfonts.com/css/minecrafter-alt";
export const HUB_TEXT_FONTS_MINECRAFT_HREF = "https://fonts.cdnfonts.com/css/minecraft";
export const HUB_TEXT_FONTS_MINECRAFTIA_HREF = "https://fonts.cdnfonts.com/css/minecraftia";

export const HUB_TEXT_FONTS_STYLESHEETS = [
  HUB_TEXT_FONTS_GOOGLE_HREF,
  HUB_TEXT_FONTS_MINECRAFTER_HREF,
  HUB_TEXT_FONTS_MINECRAFTER_ALT_HREF,
  HUB_TEXT_FONTS_MINECRAFT_HREF,
  HUB_TEXT_FONTS_MINECRAFTIA_HREF,
] as const;
