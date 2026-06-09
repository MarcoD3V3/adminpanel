"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatRelativeTime } from "@/lib/utils";
import { tableHead, tableRow } from "@/lib/styles";
import { Copy, RefreshCw, UserPlus, UserX, KeyRound } from "lucide-react";

type LauncherUser = {
  id: string;
  username: string;
  displayName?: string;
  tier?: "free" | "premium";
  createdAt: string;
  revoked: boolean;
  lastLoginAt?: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<LauncherUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState<"free" | "premium">("free");
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ username: string; password: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/launcher-auth/admin/users", { credentials: "include" });
      const data = (await res.json()) as { authenticated?: boolean; users?: LauncherUser[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo cargar usuarios (¿sesión admin?)");
        return;
      }
      setUsers((data.users ?? []).filter((u) => !u.revoked));
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || password.length < 6) return;
    setCreating(true);
    setError(null);
    setLastCreated(null);
    try {
      const res = await fetch("/api/launcher-auth/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          displayName: (displayName || username).trim(),
          password,
          tier,
        }),
      });
      const data = (await res.json()) as { success?: boolean; user?: LauncherUser; error?: string };
      if (!res.ok || !data.success || !data.user) {
        setError(data.error ?? "No se pudo crear la cuenta");
        return;
      }
      setLastCreated({ username: data.user.username, password });
      setUsername("");
      setDisplayName("");
      setPassword("");
      setTier("free");
      await refresh();
    } catch {
      setError("Error de red");
    } finally {
      setCreating(false);
    }
  };

  const saveUser = async (u: LauncherUser) => {
    setError(null);
    await fetch("/api/launcher-auth/admin/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id: u.id,
        displayName: (u.displayName || u.username).trim(),
        tier: u.tier ?? "free",
      }),
    });
    await refresh();
  };

  const resetPass = async (id: string) => {
    const next = prompt("Nueva contraseña (mín. 6 caracteres):");
    if (!next || next.length < 6) return;
    setError(null);
    const res = await fetch("/api/launcher-auth/admin/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-password", id, password: next }),
    });
    if (!res.ok) setError("No se pudo resetear la contraseña");
  };

  const revoke = async (id: string) => {
    setError(null);
    await fetch("/api/launcher-auth/admin/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", id }),
    });
    await refresh();
  };

  return (
    <>
      <Header title="Usuarios" description="Cuentas del launcher (usuario/contraseña) y ajustes" />

      <PageContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[var(--color-muted)]">
            Estas cuentas son las que se usan para iniciar sesión dentro del launcher.
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Card className="border-[var(--color-border-subtle)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Crear cuenta
            </CardTitle>
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
                label="Nombre visible"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Opcional"
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
                  <KeyRound className="h-3.5 w-3.5" />
                  {creating ? "Creando…" : "Crear cuenta"}
                </Button>
              </div>
            </form>

            {lastCreated && (
              <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                <p className="font-medium text-emerald-200">Cuenta creada — comparte estas credenciales:</p>
                <p className="mt-2 font-mono text-xs">
                  Usuario: <strong>{lastCreated.username}</strong> · Contraseña: <strong>{lastCreated.password}</strong>
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
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>{users.length} cuentas</span>
              <Badge>{users.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className="px-6 pb-3 pt-2">Usuario</th>
                  <th className="px-4 pb-3 pt-2">Nombre visible</th>
                  <th className="px-4 pb-3 pt-2">Plan</th>
                  <th className="hidden px-4 pb-3 pt-2 lg:table-cell">Último login</th>
                  <th className="px-6 pb-3 pt-2" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={`${tableRow} hover:bg-[var(--color-surface)]`}>
                    <td className="px-6 py-3">
                      <p className="font-medium text-[var(--color-text)]">@{u.username}</p>
                      <p className="text-xs text-[var(--color-muted)]">Creado {formatRelativeTime(u.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded-md border border-[var(--color-border-subtle)] bg-transparent px-2 py-1 text-sm"
                        value={u.displayName ?? u.username}
                        onChange={(e) =>
                          setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, displayName: e.target.value } : x)))
                        }
                        onBlur={() => void saveUser(u)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="rounded-md border border-[var(--color-border-subtle)] bg-transparent px-2 py-1"
                        value={u.tier ?? "free"}
                        onChange={(e) => {
                          const next = e.target.value as "free" | "premium";
                          const updated = { ...u, tier: next };
                          setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
                          void saveUser(updated);
                        }}
                      >
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                      </select>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-[var(--color-muted)] lg:table-cell">
                      {u.lastLoginAt ? formatRelativeTime(u.lastLoginAt) : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => void resetPass(u.id)}>
                          Reset pass
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void revoke(u.id)}>
                          <UserX className="h-3.5 w-3.5" /> Revocar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
