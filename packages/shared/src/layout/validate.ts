import type { HubLayout } from "../types/hub-layout";

export const HUB_LAYOUT_STORAGE_KEY = "craftlauncher-hub-layout-v1";

export function isHubLayout(value: unknown): value is HubLayout {
  if (!value || typeof value !== "object") return false;
  const v = value as HubLayout;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.version === "number" &&
    typeof v.activeScreenId === "string" &&
    typeof v.updatedAt === "string" &&
    Array.isArray(v.screens) &&
    v.screens.length > 0 &&
    v.screens.every(
      (s) =>
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        typeof s.width === "number" &&
        typeof s.height === "number" &&
        Array.isArray(s.elements) &&
        (s.scroll === undefined || typeof s.scroll === "boolean") &&
        (s.chrome === undefined ||
          (typeof s.chrome === "object" &&
            Array.isArray((s.chrome as { elements?: unknown }).elements) &&
            typeof (s.chrome as { width?: unknown }).width === "number" &&
            typeof (s.chrome as { height?: unknown }).height === "number"))
    ) &&
    (v.accountSurface === undefined ||
      (typeof v.accountSurface === "object" &&
        Array.isArray(v.accountSurface.screens) &&
        typeof v.accountSurface.activeScreenId === "string")) &&
    (v.launcherChrome === undefined ||
      (typeof v.launcherChrome === "object" &&
        Array.isArray((v.launcherChrome as { elements?: unknown }).elements) &&
        typeof (v.launcherChrome as { width?: unknown }).width === "number" &&
        typeof (v.launcherChrome as { height?: unknown }).height === "number"))
  );
}

export function getActiveScreen(layout: HubLayout) {
  return layout.screens.find((s) => s.id === layout.activeScreenId) ?? layout.screens[0];
}

export function findElementByRef(
  screen: HubLayout["screens"][number],
  refId: string
) {
  const id = refId.trim();
  if (!id) return undefined;
  return screen.elements.find((el) => el.logic?.refId === id || el.id === id);
}
