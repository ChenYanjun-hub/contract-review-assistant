import { NextResponse } from "next/server";
import { runCozeWorkflow } from "@/lib/coze";
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
    return NextResponse.json({
      result: {
        ...mockResult,
        summary: `${mockResult.summary}（当前展示示例结果：${message}）`,
        isMock: true,
        source: "mock"
      }
    });
  }
}
