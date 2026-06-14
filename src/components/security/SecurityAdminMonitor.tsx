"use client";

import { useEffect, useRef } from "react";
import type { SecurityDetectionType } from "@/types/features";

async function reportClient(type: SecurityDetectionType, detail: string, metadata?: Record<string, unknown>) {
  try {
    await fetch("/api/security/client-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, detail, metadata }),
    });
  } catch {
    /* ignore */
  }
}

function inspectAdminCookie() {
  const match = document.cookie.match(/(?:^|;\s*)cl_admin_session=([^;]*)/);
  if (!match?.[1]) return;
  const value = decodeURIComponent(match[1]);
  const dot = value.lastIndexOf(".");
  if (dot <= 0 || value.length < 20) {
    void reportClient("admin_cookie_tamper", "Cookie cl_admin_session con formato inválido en el navegador");
  }
}

function inspectStorageTamper() {
  const suspiciousKeys = ["__admin", "bypass", "isAdmin", "cl_override", "devtools"];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (suspiciousKeys.some((s) => key.toLowerCase().includes(s))) {
      void reportClient("admin_data_tamper", `Clave sospechosa en localStorage: ${key}`);
    }
  }
}

function inspectAutomation() {
  if (navigator.webdriver) {
    void reportClient("launcher_bot_automation", "navigator.webdriver activo en panel admin");
  }
}

function inspectDevToolsLayout() {
  const gapW = window.outerWidth - window.innerWidth;
  const gapH = window.outerHeight - window.innerHeight;
  if (gapW > 160 || gapH > 160) {
    void reportClient("launcher_debugger_attached", "DevTools probablemente abiertas en panel admin");
  }
}

export function SecurityAdminMonitor() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    inspectAdminCookie();
    inspectStorageTamper();
    inspectAutomation();

    const timer = window.setInterval(() => {
      inspectAdminCookie();
      inspectStorageTamper();
    }, 45_000);

    const onResize = () => inspectDevToolsLayout();
    window.addEventListener("resize", onResize);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
