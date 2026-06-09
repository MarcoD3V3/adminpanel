"use client";

import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { ProfileAdminPanel } from "@/components/profiles/ProfileAdminPanel";

export default function ProfilesPage() {
  return (
    <>
      <Header
        title="Perfiles"
        description="Cuentas del launcher, sesiones activas, skins y control de seguridad"
      />
      <PageContent>
        <ProfileAdminPanel />
      </PageContent>
    </>
  );
}
