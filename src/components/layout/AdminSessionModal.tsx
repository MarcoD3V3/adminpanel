"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  LogOut,
  Shield,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAdminSession } from "@/lib/admin-session-context";
import { AdminLoginForm } from "@/components/layout/AdminLoginForm";
import { cn } from "@/lib/utils";

const QUICK_LINKS = [
  { href: "/launcher-access", label: "Acceso Launcher" },
  { href: "/live-ops", label: "Live Ops" },
  { href: "/profiles", label: "Perfiles" },
  { href: "/users", label: "Usuarios" },
];

export function AdminSessionModal() {
  const {
    authenticated,
    configured,
    devFallbackActive,
    modalOpen,
    closeModal,
    remember,
    setRemember,
    login,
    logout,
    loading,
  } = useAdminSession();

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  if (!modalOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/65"
        onClick={closeModal}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2">
            {authenticated ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
            ) : (
              <Shield className="h-4 w-4 text-[var(--color-accent)]" strokeWidth={1.5} />
            )}
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)]">
                {authenticated ? "Sesión admin activa" : "Iniciar sesión admin"}
              </h2>
              <p className="text-[10px] text-[var(--color-muted)]">
                Cookie HttpOnly segura · no guarda la clave en el navegador
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {loading ? (
            <p className="text-sm text-[var(--color-muted)]">Comprobando sesión…</p>
          ) : authenticated ? (
            <>
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100">
                Estás autenticado. La sesión se mantiene en una cookie hasta que cierres sesión.
              </div>

              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                  Accesos rápidos
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeModal}
                      className="rounded-lg border border-[var(--color-border-subtle)] px-3 py-2 text-xs text-[var(--color-text-soft)] hover:border-[var(--color-accent-muted)] hover:bg-[var(--color-surface-hover)]"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => void logout()}>
                <LogOut className="h-3.5 w-3.5" />
                Cerrar sesión
              </Button>
            </>
          ) : (
            <AdminLoginForm
              configured={configured}
              devFallbackActive={devFallbackActive}
              remember={remember}
              onRememberChange={setRemember}
              onLogin={login}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminSessionAvatarButton() {
  const { authenticated, loading, openModal } = useAdminSession();

  return (
    <button
      type="button"
      onClick={openModal}
      title={authenticated ? "Sesión admin activa" : "Iniciar sesión admin"}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-full border bg-[var(--color-surface-raised)] text-xs transition-colors hover:bg-[var(--color-surface-hover)]",
        authenticated
          ? "border-emerald-500/40 text-emerald-200"
          : "border-[var(--color-border-subtle)] text-[var(--color-text-soft)]"
      )}
    >
      {loading ? (
        <User className="h-3.5 w-3.5 animate-pulse" strokeWidth={1.5} />
      ) : authenticated ? (
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
      ) : (
        <User className="h-3.5 w-3.5" strokeWidth={1.5} />
      )}
      {authenticated && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[var(--color-surface)] bg-emerald-400" />
      )}
    </button>
  );
}
