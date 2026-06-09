import type { HubLayout, HubScreen, HubSurfaceLayout } from "../types/hub-layout";

export const ACCOUNT_SCREEN_IDS = ["screen-profile", "screen-account", "account-home"] as const;

/** Superficie de cuenta por defecto — una pantalla vacía (se diseña en el Hub) */
export const defaultAccountSurface: HubSurfaceLayout = {
  activeScreenId: "screen-profile",
  screens: [
    {
      id: "screen-profile",
      name: "Perfil",
      width: 880,
      height: 520,
      backgroundColor: "#0c0e11",
      desktopWindow: true,
      elements: [],
    },
  ],
};

const ACCOUNT_NAME_RE = /^(perfil|cuenta|profile|account)(\s|$|-)/i;

/** Pantallas del launcher que representan la ventana Perfil / Cuenta. */
export function isAccountHubScreen(screen: HubScreen): boolean {
  const id = screen.id.toLowerCase();
  if (ACCOUNT_SCREEN_IDS.includes(id as (typeof ACCOUNT_SCREEN_IDS)[number])) return true;
  if (id.startsWith("account-")) return true;
  const name = screen.name.trim().toLowerCase();
  return name === "perfil" || name === "cuenta" || ACCOUNT_NAME_RE.test(name);
}

export function listAccountHubScreens(layout: HubLayout): HubScreen[] {
  return layout.screens.filter(isAccountHubScreen);
}

export function resolvePrimaryAccountScreen(layout: HubLayout): HubScreen | null {
  for (const id of ACCOUNT_SCREEN_IDS) {
    const hit = layout.screens.find((s) => s.id === id);
    if (hit) return hit;
  }
  const fromMain = listAccountHubScreens(layout);
  if (fromMain.length > 0) return fromMain[0]!;
  return layout.accountSurface?.screens?.[0] ?? null;
}

function cloneScreen(screen: HubScreen): HubScreen {
  return {
    ...screen,
    elements: screen.elements.map((el) => ({ ...el, style: { ...el.style } })),
    chrome: screen.chrome
      ? {
          ...screen.chrome,
          elements: screen.chrome.elements.map((el) => ({ ...el, style: { ...el.style } })),
        }
      : undefined,
  };
}

export function buildAccountSurfaceFromLayout(layout: HubLayout): HubSurfaceLayout {
  const fromMain = listAccountHubScreens(layout);
  if (fromMain.length > 0) {
    const primary = resolvePrimaryAccountScreen(layout) ?? fromMain[0]!;
    const preferredActive =
      layout.accountSurface?.activeScreenId ??
      layout.ui?.accountScreenId ??
      primary.id;
    const activeScreenId = fromMain.some((s) => s.id === preferredActive)
      ? preferredActive
      : primary.id;
    return {
      activeScreenId,
      screens: fromMain.map(cloneScreen),
    };
  }

  if (layout.accountSurface?.screens?.length) {
    return {
      activeScreenId: layout.accountSurface.activeScreenId,
      screens: layout.accountSurface.screens.map(cloneScreen),
    };
  }

  return defaultAccountSurface;
}

export function resolveAccountSurface(layout: HubLayout): HubSurfaceLayout {
  return buildAccountSurfaceFromLayout(layout);
}

/** Crea la ventana Perfil en el Hub si falta y sincroniza accountSurface. */
export function ensureAccountProfileScreen(layout: HubLayout): HubLayout {
  let next = { ...layout, ui: { ...layout.ui } };
  let screens = [...next.screens];

  let primary = resolvePrimaryAccountScreen(next);
  if (!primary) {
    const created: HubScreen = {
      id: "screen-profile",
      name: "Perfil",
      width: next.window?.width ?? 980,
      height: Math.max(320, (next.window?.height ?? 520) - 40),
      backgroundColor: "#0c0e11",
      backgroundImage: "",
      desktopWindow: true,
      elements: [],
    };
    screens = [...screens, created];
    primary = created;
    next = {
      ...next,
      screens,
      ui: { ...next.ui, accountScreenId: created.id },
    };
  } else if (!next.ui?.accountScreenId) {
    next = { ...next, ui: { ...next.ui, accountScreenId: primary.id } };
  }

  if (primary && primary.desktopWindow !== true) {
    screens = screens.map((s) =>
      s.id === primary!.id ? { ...s, desktopWindow: true } : s
    );
    next = { ...next, screens };
  }

  const accountSurface = buildAccountSurfaceFromLayout({ ...next, screens });
  return { ...next, screens, accountSurface };
}
