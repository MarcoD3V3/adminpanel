import type { HubElement } from "../types/hub-layout";
import type { LauncherTier } from "../types/launcher-auth";

export type AccountSessionPreview = {
  displayName: string;
  username: string | null;
  tier: LauncherTier;
};

function accountBindKey(element: HubElement): string | null {
  const key = element.logic?.constants?.ACCOUNT_BIND;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

/** Enlaza widgets de cuenta con la sesión activa del launcher. */
export function bindAccountHubElement(
  element: HubElement,
  session: AccountSessionPreview
): HubElement {
  const bind = accountBindKey(element);
  const tierLabel = session.tier === "premium" ? "Premium" : "Free";

  if (element.type === "profile-widget" || bind === "profile") {
    return {
      ...element,
      label: session.displayName,
      value: tierLabel,
    };
  }

  if (bind === "username") {
    const who = session.username ?? session.displayName ?? "Sin sesión";
    return { ...element, label: who };
  }

  if (bind === "tier" || bind === "tier-chip") {
    return {
      ...element,
      label: session.tier === "premium" ? "★ Premium" : "Cuenta Free",
    };
  }

  if (bind === "session-status") {
    return {
      ...element,
      label: session.username ? "Sesión activa" : "Sin sesión",
      value: session.username ? "✓" : "—",
    };
  }

  if (bind === "display-greeting") {
    const who = session.displayName || session.username || "jugador";
    return { ...element, label: `Hola, ${who}` };
  }

  return element;
}

export function bindAccountHubElements(
  elements: HubElement[],
  session: AccountSessionPreview
): HubElement[] {
  return elements.map((el) => bindAccountHubElement(el, session));
}
