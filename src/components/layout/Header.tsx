"use client";

import { Bell, Search } from "lucide-react";
import { AdminSessionAvatarButton } from "@/components/layout/AdminSessionModal";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/95 px-6 py-5 md:px-8">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-medium tracking-tight text-[var(--color-text)]">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-[var(--color-text-soft)]">{description}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <div className="relative hidden lg:block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]"
              strokeWidth={1.5}
            />
            <input
              type="search"
              placeholder="Buscar..."
              className="w-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] py-2 pl-9 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none focus:border-[var(--color-accent-muted)]"
            />
          </div>
          <button
            type="button"
            aria-label="Notificaciones"
            className="rounded-xl border border-[var(--color-border-subtle)] p-2 text-[var(--color-text-soft)] hover:bg-[var(--color-surface-hover)]"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <AdminSessionAvatarButton />
        </div>
      </div>
    </header>
  );
}
