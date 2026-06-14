import { NextResponse } from "next/server";
import { hubDataAuthorityUrl, usesRemoteHubData } from "@/lib/hub-data-authority";
import { requireAdminSession } from "@/lib/launcher-auth/require-admin";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;

  return NextResponse.json({
    remote: usesRemoteHubData(),
    authority: hubDataAuthorityUrl(),
  });
}
