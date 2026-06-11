import { NextResponse } from "next/server";
import type { HealthStatus } from "@/lib/types";

export const runtime = "nodejs";

function preview(value: string | undefined) {
  if (!value) {
    return "未配置";
  }
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function GET() {
  const cozeTokenConfigured = Boolean(process.env.COZE_API_TOKEN);
  const workflowId = process.env.COZE_MAIN_WORKFLOW_ID || process.env.COZE_WORKFLOW_ID;
  const workflowIdConfigured = Boolean(workflowId);

  const status: HealthStatus = {
    mode: cozeTokenConfigured && workflowIdConfigured ? "coze-ready" : "mock",
    cozeTokenConfigured,
    workflowIdConfigured,
    apiBase: process.env.COZE_API_BASE || "https://api.coze.cn",
    workflowIdPreview: preview(workflowId),
    checkedAt: new Date().toISOString()
  };

  return NextResponse.json(status);
}
