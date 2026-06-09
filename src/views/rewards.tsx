"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageContent } from "@/components/layout/PageContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { mockRewardTiers } from "@/lib/mock-data";
import { mockMissions } from "@/lib/feature-data";
import { badgeDefault, rowItem } from "@/lib/styles";
import { Plus, Star, Target, ArrowRight } from "lucide-react";

export default function RewardsPage() {
  const [pointsPerHour, setPointsPerHour] = useState("10");
  const [dailyBonus, setDailyBonus] = useState("50");
  const activeMissions = mockMissions.filter((m) => m.active);

  return (
    <>
      <Header
        title="Recompensas"
        description="Puntos, tiers, misiones y perks"
        actions={<Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> Tier</Button>}
      />

      <PageContent>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Economía</CardTitle>
              <CardDescription>Cómo ganan puntos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input label="Por hora jugada" value={pointsPerHour} onChange={(e) => setPointsPerHour(e.target.value)} />
              <Input label="Bonus diario" value={dailyBonus} onChange={(e) => setDailyBonus(e.target.value)} />
              <Input label="Por referido" defaultValue="200" />
              <Input label="Por evento" defaultValue="100" />
              <Button className="w-full">Actualizar</Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Tiers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mockRewardTiers.map((tier) => (
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
                <CardDescription>Puntos otorgados al completar — gestiona en Misiones</CardDescription>
              </div>
              <Link
                href="/missions"
                className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
              >
                Ver todas <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
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
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className={badgeDefault}>{mission.rewardPoints} pts</Badge>
                        <Badge className={badgeDefault}>{mission.type}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Canjeables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { name: "Capa exclusiva", cost: 500 },
                { name: "Avatar animado", cost: 300 },
                { name: "Modpack premium", cost: 800 },
                { name: "Badge especial", cost: 150 },
              ].map((reward) => (
                <div key={reward.name} className={`text-center ${rowItem}`}>
                  <p className="text-sm text-[var(--color-text)]">{reward.name}</p>
                  <p className="mt-1 text-xs text-[var(--color-accent)]">{reward.cost} pts</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
