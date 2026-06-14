"use client";

import { useEffect } from "react";

/**
 * Next.js 15 a veces rechaza router.push con `undefined` en dev.
 * Evita el overlay rojo sin ocultar errores reales.
 */
export function AdminUnhandledRejectionGuard() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      if (event.reason === undefined) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return null;
}
