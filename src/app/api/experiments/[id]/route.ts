import { NextResponse } from "next/server";
import type { Experiment } from "@/types/features";
import { updateExperimentStatus } from "@/lib/experiments/service";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdminSession();
  if (denied) return denied;

  const { id } = await context.params;
  const body = (await request.json()) as { status?: Experiment["status"] };

  if (!body.status || !["draft", "running", "paused", "completed"].includes(body.status)) {
    return NextResponse.json({ success: false, error: "status inválido" }, { status: 400 });
  }

  const experiment = await updateExperimentStatus(id, body.status);
  if (!experiment) {
    return NextResponse.json({ success: false, error: "Experimento no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ success: true, experiment });
}
