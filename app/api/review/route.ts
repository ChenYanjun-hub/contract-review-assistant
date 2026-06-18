import { NextResponse } from "next/server";
import { CozeConfigError, runCozeWorkflow } from "@/lib/coze";
import { mockResult } from "@/lib/mockResult";
import { normalizeResult } from "@/lib/normalizeResult";
import type { ReviewRequest } from "@/lib/types";

export const runtime = "nodejs";

function validatePayload(payload: Partial<ReviewRequest>) {
  if (!payload.companyName?.trim()) {
    return "companyName 不能为空";
  }
  if (!payload.contractText?.trim()) {
    return "contractText 不能为空";
  }
  if (payload.reviewStance !== "buyer" && payload.reviewStance !== "seller") {
    return "reviewStance 必须是 buyer 或 seller";
  }
  if (payload.reviewMode !== "quick" && payload.reviewMode !== "detailed") {
    return "reviewMode 必须是 quick 或 detailed";
  }
  return "";
}

function buildMockFallback(message: string) {
  return {
    ...mockResult,
    summary: `${mockResult.summary}（当前展示示例结果：${message}）`,
    isMock: true,
    source: "mock" as const
  };
}

function allowMockFallback(err: unknown) {
  return err instanceof CozeConfigError || process.env.COZE_ENABLE_MOCK_FALLBACK === "true";
}

export async function POST(request: Request) {
  let payload: ReviewRequest;

  try {
    payload = (await request.json()) as ReviewRequest;
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const error = validatePayload(payload);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  try {
    const raw = await runCozeWorkflow(payload);
    const result = normalizeResult(raw);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Coze 调用失败";
    if (allowMockFallback(err)) {
      return NextResponse.json({ result: buildMockFallback(message) });
    }
    return NextResponse.json({ error: `审查任务执行失败：${message}` }, { status: 502 });
  }
}
