"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, UserPlus, UserX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/utils";

type LauncherUserPublic = {
  id: string;
  username: string;
  displayName?: string;
  tier?: "free" | "premium";
  createdAt: string;
  revoked: boolean;
  lastLoginAt?: string;
};

export function LauncherUsersSection() {
  const [users, setUsers] = useState<LauncherUserPublic[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tier, setTier] = useState<"free" | "premium">("free");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<{ username: string; password: string } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/launcher-auth/admin/users", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { users?: LauncherUserPublic[] };
    setUsers(data.users ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setLastCreated(null);
    try {
      const res = await fetch("/api/launcher-auth/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName: displayName || username, tier }),
      });
      const data = (await res.json()) as { success?: boolean; user?: LauncherUserPublic; error?: string };
      if (!res.ok || !data.success || !data.user) {
        setError(data.error ?? "No se pudo crear el usuario");
        return;
      }
      setLastCreated({ username: data.user.username, password });
      setUsername("");
      setPassword("");
      setDisplayName("");
      await refresh();
    } catch {
      setError("Error de red");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    await fetch("/api/launcher-auth/admin/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", id }),
    });
    await refresh();
  };

  const active = users.filter((u) => !u.revoked);

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
        Cuentas de usuario (login en el launcher)
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Nueva cuenta
          </CardTitle>
          <CardDescription>
            Los jugadores inician sesión con usuario y contraseña la primera vez que abren el launcher.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void handleCreate(e)}>
            <Input
              label="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jugador1"
              autoComplete="off"
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mín. 6 caracteres"
            />
            <Input
              label="Nombre visible (opcional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Select
              label="Plan"
              value={tier}
              onChange={(e) => setTier(e.target.value as "free" | "premium")}
              options={[
                { value: "free", label: "Free" },
                { value: "premium", label: "Premium" },
              ]}
            />
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={creating || !username.trim() || password.length < 6}>
                {creating ? "Creando…" : "Crear cuenta"}
              </Button>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          </form>

          {lastCreated && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <p className="font-medium text-emerald-200">Cuenta creada — comparte estas credenciales:</p>
              <p className="mt-2 font-mono text-xs">
                Usuario: <strong>{lastCreated.username}</strong> · Contraseña:{" "}
                <strong>{lastCreated.password}</strong>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    `Usuario: ${lastCreated.username}\nContraseña: ${lastCreated.password}`
                  )
                }
              >
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Usuarios activos</CardTitle>
            <Badge>{active.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Aún no hay cuentas. Crea la primera arriba.</p>
          ) : (
            <ul className="space-y-2">
              {active.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-[var(--color-text)]">
                      {u.displayName ?? u.username}
                      <span className="ml-2 text-xs text-[var(--color-muted)]">@{u.username}</span>
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {u.tier === "premium" ? "Premium" : "Free"}
                      {u.lastLoginAt ? ` · último login ${formatRelativeTime(u.lastLoginAt)}` : ""}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void revoke(u.id)}>
                    <UserX className="h-3.5 w-3.5" /> Revocar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
