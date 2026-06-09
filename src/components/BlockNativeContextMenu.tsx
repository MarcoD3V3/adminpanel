"use client";

import { useEffect, type ReactNode } from "react";

const BLOCK_HANDLER = (e: Event) => {
  e.preventDefault();
};

/** Registra en cuanto carga el bundle cliente (antes del primer useEffect). */
if (typeof document !== "undefined") {
  document.addEventListener("contextmenu", BLOCK_HANDLER, true);
}

export function BlockNativeContextMenu({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.addEventListener("contextmenu", BLOCK_HANDLER, true);
    document.documentElement.addEventListener("contextmenu", BLOCK_HANDLER, true);
    document.body?.addEventListener("contextmenu", BLOCK_HANDLER, true);
    return () => {
      document.removeEventListener("contextmenu", BLOCK_HANDLER, true);
      document.documentElement.removeEventListener("contextmenu", BLOCK_HANDLER, true);
      document.body?.removeEventListener("contextmenu", BLOCK_HANDLER, true);
    };
  }, []);

  return <>{children}</>;
}

/** Script inline para el <head>: bloquea el menú antes de que React hidrate. */
export const BLOCK_CONTEXT_MENU_SCRIPT = `
document.addEventListener('contextmenu',function(e){e.preventDefault();},true);
document.documentElement.addEventListener('contextmenu',function(e){e.preventDefault();},true);
`;
