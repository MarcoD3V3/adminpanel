"use client";

import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { LauncherAccessPanel } from "@/components/launchers/LauncherAccessPanel";

export default function LauncherAccessPage() {
  return (
    <>
      <Header
        title="Acceso Launcher"
        description="Tokens de un solo uso, sesiones activas y auditoría de seguridad"
      />
      <PageContent>
        <LauncherAccessPanel />
      </PageContent>
    </>
  );
}
