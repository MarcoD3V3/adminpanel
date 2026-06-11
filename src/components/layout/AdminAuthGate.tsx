"use client";

import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import { useAdminSession } from "@/lib/admin-session-context";
import { AdminLoginForm } from "@/components/layout/AdminLoginForm";

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const { authenticated, configured, devFallbackActive, loading, remember, setRemember, login } =
    useAdminSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)]">
        <p className="text-sm text-[var(--color-muted)]">Comprobando sesión…</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)] p-4">
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-4 py-3">
            <Shield className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.5} />
            <div>
              <h1 className="text-sm font-medium text-[var(--color-text)]">CraftLauncher Admin</h1>
              <p className="text-[10px] text-[var(--color-muted)]">
                Inicia sesión para acceder al panel
              </p>
            </div>
          </div>
          <div className="p-4">
            <AdminLoginForm
              configured={configured}
              devFallbackActive={devFallbackActive}
              remember={remember}
              onRememberChange={setRemember}
              onLogin={login}
            />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
