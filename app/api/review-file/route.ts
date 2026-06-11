import { NextResponse } from "next/server";
import { runCozeFileWorkflow } from "@/lib/coze";
import { mockResult } from "@/lib/mockResult";
import { normalizeResult } from "@/lib/normalizeResult";
import type { ReviewMode, ReviewRequest, ReviewStance } from "@/lib/types";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function isReviewStance(value: FormDataEntryValue | null): value is ReviewStance {
  return value === "buyer" || value === "seller";
}

function isReviewMode(value: FormDataEntryValue | null): value is ReviewMode {
  return value === "quick" || value === "detailed";
}

function makeTextFile(text: string) {
  return new File([text], "contract.txt", { type: "text/plain" });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const companyName = String(formData.get("companyName") || "").trim();
  const reviewStance = formData.get("reviewStance");
  const reviewMode = formData.get("reviewMode");
  const contractText = String(formData.get("contractText") || "").trim();
  const uploadedFile = formData.get("file");

  if (!companyName) {
    return NextResponse.json({ error: "companyName 不能为空" }, { status: 400 });
  }
  if (!isReviewStance(reviewStance)) {
    return NextResponse.json({ error: "reviewStance 必须是 buyer 或 seller" }, { status: 400 });
  }
  if (!isReviewMode(reviewMode)) {
    return NextResponse.json({ error: "reviewMode 必须是 quick 或 detailed" }, { status: 400 });
  }
  if (!(uploadedFile instanceof File) && !contractText) {
    return NextResponse.json({ error: "请上传合同文件，或粘贴合同正文。" }, { status: 400 });
  }
  if (uploadedFile instanceof File && uploadedFile.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "文件过大，请上传 10MB 以内的合同文件。" }, { status: 400 });
  }

  const file = uploadedFile instanceof File ? uploadedFile : makeTextFile(contractText);
  const payload: Omit<ReviewRequest, "contractText"> = {
    companyName,
    reviewStance,
    reviewMode
  };

  try {
    const raw = await runCozeFileWorkflow(file, payload);
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
