import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";
import { auditAdminRequest } from "@/lib/security/guard";
import { addMission, getRewardsDashboard, patchMission } from "@/lib/rewards/service";
import type { Mission } from "@/types/features";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;
  const { missions } = getRewardsDashboard();
  return NextResponse.json({ missions });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;
  const body = (await request.json()) as Partial<Mission> & { title?: string };
  await auditAdminRequest(request, body);

  if (body.id) {
    const mission = patchMission(body.id, body);
    return NextResponse.json({ success: !!mission, mission });
  }

  const mission = addMission({
    title: String(body.title ?? "Nueva misión"),
    description: String(body.description ?? ""),
    type: body.type ?? "daily",
    metric: body.metric ?? "login",
    target: Number(body.target ?? 1),
    rewardPoints: Number(body.rewardPoints ?? 25),
    active: body.active !== false,
    expiresAt: body.expiresAt,
  });
  return NextResponse.json({ success: true, mission });
}

export async function PATCH(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;
  const body = (await request.json()) as { id?: string; active?: boolean } & Partial<Mission>;
  await auditAdminRequest(request, body);
  if (!body.id) {
    return NextResponse.json({ success: false, error: "id requerido" }, { status: 400 });
  }
  const mission = patchMission(body.id, body);
  return NextResponse.json({ success: !!mission, mission });
}
