import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";
import { auditAdminRequest } from "@/lib/security/guard";
import {
  addMission,
  addRedeemable,
  addTier,
  adminGrantPoints,
  getRewardsDashboard,
  patchMission,
  patchTier,
  removeTier,
  updateEconomy,
} from "@/lib/rewards/service";
import type { Mission } from "@/types/features";

export async function GET(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;
  await auditAdminRequest(request);
  return NextResponse.json(getRewardsDashboard());
}

export async function PATCH(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;
  const body = (await request.json()) as Record<string, unknown>;
  await auditAdminRequest(request, body);

  if (body.scope === "economy") {
    const economy = updateEconomy({
      pointsPerHour: Number(body.pointsPerHour ?? 10),
      dailyBonus: Number(body.dailyBonus ?? 50),
      referralBonus: Number(body.referralBonus ?? 200),
      eventBonus: Number(body.eventBonus ?? 100),
      xpMultiplier: Number(body.xpMultiplier ?? 1),
    });
    return NextResponse.json({ success: true, economy });
  }

  if (body.scope === "mission" && body.id) {
    const mission = patchMission(String(body.id), body as Partial<Mission>);
    return NextResponse.json({ success: !!mission, mission });
  }

  if (body.scope === "tier" && body.id) {
    const tier = patchTier(String(body.id), {
      name: body.name as string | undefined,
      pointsRequired: body.pointsRequired as number | undefined,
      perks: body.perks as string[] | undefined,
    });
    return NextResponse.json({ success: !!tier, tier });
  }

  return NextResponse.json({ success: false, error: "scope inválido" }, { status: 400 });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;
  const body = (await request.json()) as Record<string, unknown>;
  await auditAdminRequest(request, body);

  if (body.scope === "tier") {
    const tier = addTier({
      name: String(body.name ?? "Nuevo tier"),
      pointsRequired: Number(body.pointsRequired ?? 0),
      perks: (body.perks as string[]) ?? [],
    });
    return NextResponse.json({ success: true, tier });
  }

  if (body.scope === "redeemable") {
    const item = addRedeemable({
      name: String(body.name ?? "Canjeable"),
      description: String(body.description ?? ""),
      cost: Number(body.cost ?? 100),
      category: (body.category as "cosmetic") ?? "cosmetic",
    });
    return NextResponse.json({ success: true, redeemable: item });
  }

  if (body.scope === "mission") {
    const mission = addMission({
      title: String(body.title ?? "Nueva misión"),
      description: String(body.description ?? ""),
      type: (body.type as Mission["type"]) ?? "daily",
      metric: (body.metric as Mission["metric"]) ?? "login",
      target: Number(body.target ?? 1),
      rewardPoints: Number(body.rewardPoints ?? 25),
      active: body.active !== false,
      expiresAt: body.expiresAt as string | undefined,
    });
    return NextResponse.json({ success: true, mission });
  }

  if (body.scope === "grant" && body.userId) {
    const result = adminGrantPoints(
      String(body.userId),
      String(body.username ?? "usuario"),
      Number(body.amount ?? 0),
      String(body.reason ?? "Ajuste admin")
    );
    return NextResponse.json({ success: true, ...result });
  }

  return NextResponse.json({ success: false, error: "scope inválido" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  const scope = new URL(request.url).searchParams.get("scope");
  if (!id || scope !== "tier") {
    return NextResponse.json({ success: false, error: "id y scope=tier requeridos" }, { status: 400 });
  }
  await auditAdminRequest(request, { id });
  return NextResponse.json({ success: removeTier(id) });
}
