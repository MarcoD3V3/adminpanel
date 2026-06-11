"use client";

import type { ReactNode } from "react";
import { AdminLayout } from "./AdminLayout";
import { AdminWarmCache } from "./AdminWarmCache";
import { AdminSessionProvider } from "@/lib/admin-session-context";
import { AdminAuthGate } from "@/components/layout/AdminAuthGate";
import { AdminSessionModal } from "@/components/layout/AdminSessionModal";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminAuthGate>
        <AdminWarmCache />
        <AdminLayout>{children}</AdminLayout>
        <AdminSessionModal />
      </AdminAuthGate>
    </AdminSessionProvider>
  );
}
