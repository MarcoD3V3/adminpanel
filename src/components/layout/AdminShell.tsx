"use client";

import type { ReactNode } from "react";
import { AdminLayout } from "./AdminLayout";
import { AdminWarmCache } from "./AdminWarmCache";
import { AdminSessionProvider } from "@/lib/admin-session-context";
import { AdminAuthGate } from "@/components/layout/AdminAuthGate";
import { AdminSessionModal } from "@/components/layout/AdminSessionModal";
import { FloatingErrorBubble } from "@/components/ui/FloatingErrorBubble";
import { SecurityAdminMonitor } from "@/components/security/SecurityAdminMonitor";
import { AutomationTickMonitor } from "@/components/automation/AutomationTickMonitor";
import { AdminUnhandledRejectionGuard } from "@/components/layout/AdminUnhandledRejectionGuard";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminAuthGate>
        <AdminUnhandledRejectionGuard />
        <SecurityAdminMonitor />
        <AutomationTickMonitor />
        <AdminWarmCache />
        <AdminLayout>{children}</AdminLayout>
        <AdminSessionModal />
        <FloatingErrorBubble />
      </AdminAuthGate>
    </AdminSessionProvider>
  );
}
