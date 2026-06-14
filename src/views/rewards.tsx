"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { formatRelativeTime } from "@/lib/utils";
import { badgeDefault, rowItem } from "@/lib/styles";
import type { Mission } from "@/types/features";
import type {
  PointTransaction,
  RedeemableRecord,
  RewardEconomy,
  RewardTierRecord,
  RewardsOverview,
} from "@/lib/rewards/types";
import { ArrowRight, Coins, Gift, Plus, Star, Target, Trophy, Users } from "lucide-react";

type Dashboard = {
  economy: RewardEconomy;
  tiers: RewardTierRecord[];
  redeemables: RedeemableRecord[];
  missions: Mission[];
  overview: RewardsOverview;
  recentTransactions: PointTransaction[];
};

export default function RewardsPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [economyForm, setEconomyForm] = useState({
    pointsPerHour: "10",
    dailyBonus: "50",
    referralBonus: "200",
    eventBonus: "100",
  });
  const [showTierForm, setShowTierForm] = useState(false);
  const [tierForm, setTierForm] = useState({ name: "", pointsRequired: "500", perks: "" });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/rewards", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as Dashboard;
      setData(json);
      setEconomyForm({
        pointsPerHour: String(json.economy.pointsPerHour),
        dailyBonus: String(json.economy.dailyBonus),
        referralBonus: String(json.economy.referralBonus),
        eventBonus: String(json.economy.eventBonus),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const t = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function saveEconomy() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/rewards", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "economy",
          pointsPerHour: Number(economyForm.pointsPerHour),
          dailyBonus: Number(economyForm.dailyBonus),
          referralBonus: Number(economyForm.referralBonus),
          eventBonus: Number(economyForm.eventBonus),
        }),
      });
      if (res.ok) {
        setMessage("Economía actualizada");
        void refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function createTier() {
    setSaving(true);
    try {
      await fetch("/api/rewards", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "tier",
          name: tierForm.name,
          pointsRequired: Number(tierForm.pointsRequired),
          perks: tierForm.perks.split("\n").map((p) => p.trim()).filter(Boolean),
        }),
      });
      setShowTierForm(false);
      setTierForm({ name: "", pointsRequired: "500", perks: "" });
      void refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) {
    return (
      <>
        <Header title="Recompensas" description="Puntos, tiers, misiones y perks" />
        <PageContent><p className="text-sm text-[var(--color-muted)]">Cargando…</p></PageContent>
      </>
    );
  }

  const activeMissions = data.missions.filter((m) => m.active);

  return (
    <>
      <Header
        title="Recompensas"
        description="Puntos, tiers, misiones y perks"
        actions={
          <Button size="sm" variant="outline" onClick={() => setShowTierForm((v) => !v)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Tier
          </Button>
        }
      />

      <PageContent>
        {message && <p className="mb-4 text-sm text-emerald-400">{message}</p>}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Usuarios" value={data.overview.totalUsers} icon={Users} />
          <StatCard title="Puntos totales" value={data.overview.totalPointsAwarded.toLocaleString()} icon={Coins} />
          <StatCard title="Misiones hoy" value={data.overview.missionsCompletedToday} icon={Target} />
          <StatCard title="Canjes hoy" value={data.overview.redemptionsToday} icon={Gift} />
        </div>

        {data.economy.xpMultiplier > 1 && (
          <p className="mb-4 text-sm text-[var(--color-accent)]">
            Multiplicador XP activo: ×{data.economy.xpMultiplier}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Economía</CardTitle>
              <CardDescription>Cómo ganan puntos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input label="Por hora jugada" value={economyForm.pointsPerHour} onChange={(e) => setEconomyForm((f) => ({ ...f, pointsPerHour: e.target.value }))} />
              <Input label="Bonus diario" value={economyForm.dailyBonus} onChange={(e) => setEconomyForm((f) => ({ ...f, dailyBonus: e.target.value }))} />
              <Input label="Por referido" value={economyForm.referralBonus} onChange={(e) => setEconomyForm((f) => ({ ...f, referralBonus: e.target.value }))} />
              <Input label="Por evento" value={economyForm.eventBonus} onChange={(e) => setEconomyForm((f) => ({ ...f, eventBonus: e.target.value }))} />
              <Button className="w-full" onClick={() => void saveEconomy()} disabled={saving}>
                Actualizar
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Tiers</CardTitle>
              <CardDescription>Progresión automática por puntos acumulados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {showTierForm && (
                <div className={`mb-4 space-y-3 ${rowItem}`}>
                  <Input label="Nombre" value={tierForm.name} onChange={(e) => setTierForm((f) => ({ ...f, name: e.target.value }))} />
                  <Input label="Puntos requeridos" value={tierForm.pointsRequired} onChange={(e) => setTierForm((f) => ({ ...f, pointsRequired: e.target.value }))} />
                  <Textarea label="Perks (uno por línea)" rows={3} value={tierForm.perks} onChange={(e) => setTierForm((f) => ({ ...f, perks: e.target.value }))} />
                  <Button size="sm" onClick={() => void createTier()} disabled={saving || !tierForm.name}>Crear tier</Button>
                </div>
              )}
              {data.tiers.map((tier) => (
                <div key={tier.id} className={`flex items-start justify-between gap-4 ${rowItem}`}>
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)]">
                      <Star className="h-3.5 w-3.5 text-[var(--color-accent)]" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[var(--color-text)]">{tier.name}</p>
                        <span className="text-[11px] text-[var(--color-muted)]">{tier.pointsRequired} pts</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {tier.perks.map((perk) => (
                          <Badge key={perk} className={badgeDefault}>{perk}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--color-muted)]">{tier.members.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Misiones activas</CardTitle>
                <CardDescription>{activeMissions.length} misiones con recompensa de puntos</CardDescription>
              </div>
              <Link href="/missions" className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline">
                Gestionar <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeMissions.map((mission) => (
                <div key={mission.id} className={rowItem}>
                  <div className="flex items-start gap-2">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" strokeWidth={1.5} />
                    <div>
                      <p className="text-sm text-[var(--color-text)]">{mission.title}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-soft)]">{mission.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge className={badgeDefault}>{mission.rewardPoints} pts</Badge>
                        <Badge className={badgeDefault}>{mission.type}</Badge>
                        <span className="text-[11px] text-[var(--color-muted)]">{mission.completions} completadas</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Canjeables</CardTitle>
              <CardDescription>Items que los usuarios canjean con puntos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.redeemables.filter((r) => r.active).map((reward) => (
                  <div key={reward.id} className={`${rowItem} text-center`}>
                    <Trophy className="mx-auto mb-2 h-4 w-4 text-[var(--color-accent)]" />
                    <p className="text-sm text-[var(--color-text)]">{reward.name}</p>
                    <p className="mt-1 text-xs text-[var(--color-accent)]">{reward.cost} pts</p>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">{reward.redemptions} canjes</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actividad reciente</CardTitle>
              <CardDescription>Últimas transacciones de puntos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {data.recentTransactions.length === 0 && (
                <p className="text-sm text-[var(--color-muted)]">Sin transacciones aún</p>
              )}
              {data.recentTransactions.map((tx) => (
                <div key={tx.id} className={rowItem}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-[var(--color-text)]">{tx.username}</p>
                    <span className={tx.amount >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount} pts
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-soft)]">{tx.reason}</p>
                  <p className="text-[11px] text-[var(--color-muted)]">{formatRelativeTime(tx.createdAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}
