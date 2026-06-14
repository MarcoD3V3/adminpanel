import { NextResponse } from "next/server";
import type { Experiment } from "@/types/features";
import {
  createExperiment,
  getExperimentOverview,
  listExperiments,
} from "@/lib/experiments/service";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

export async function GET(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const [experiments, overview] = await Promise.all([listExperiments(), getExperimentOverview()]);
  return NextResponse.json({ experiments, overview });
}

export async function POST(request: Request) {
  const denied = await requireAdminSession(request);
  if (denied) return denied;

  const body = (await request.json()) as {
    name?: string;
    key?: string;
    description?: string;
    variantA?: string;
    variantB?: string;
    metric?: Experiment["metric"];
    rolloutPercent?: number;
  };

  const { auditAdminRequest } = await import("@/lib/security/guard");
  await auditAdminRequest(request, body);

  if (!body.name?.trim() || !body.key?.trim()) {
    return NextResponse.json({ success: false, error: "Nombre y feature key requeridos" }, { status: 400 });
  }

  try {
    const experiment = await createExperiment({
      name: body.name,
      key: body.key,
      description: body.description ?? "",
      variantA: body.variantA ?? "Control",
      variantB: body.variantB ?? "Variante B",
      metric: body.metric ?? "retention",
      rolloutPercent: typeof body.rolloutPercent === "number" ? body.rolloutPercent : 50,
    });
    return NextResponse.json({ success: true, experiment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear el experimento";
    return NextResponse.json({ success: false, error: message }, { status: 409 });
  }
}
