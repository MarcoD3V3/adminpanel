"use client";

import type { ReactNode } from "react";
import { AdminLayout } from "./AdminLayout";
import { AdminWarmCache } from "./AdminWarmCache";
import { AdminSessionProvider } from "@/lib/admin-session-context";
import { AdminSessionModal } from "@/components/layout/AdminSessionModal";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminWarmCache />
      <AdminLayout>{children}</AdminLayout>
      <AdminSessionModal />
    </AdminSessionProvider>
  );
}
