import type { HubLayout } from "../types/hub-layout";
import { defaultAccountSurface } from "./account-surface";

/** Layout mínimo si el admin no responde — solo ventana Inicio vacía */
export const fallbackHubLayout: HubLayout = {
  id: "offline",
  name: "CraftLauncher",
  version: 1,
  activeScreenId: "screen-home",
  updatedAt: new Date().toISOString(),
  ui: { homeScreenId: "screen-home" },
  screens: [
    {
      id: "screen-home",
      name: "Inicio",
      width: 980,
      height: 520,
      backgroundColor: "#0c0e11",
      elements: [],
    },
  ],
  accountSurface: defaultAccountSurface,
};
