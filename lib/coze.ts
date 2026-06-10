import type { ReviewRequest } from "./types";

type CozeRunResponse = {
  code?: number;
  msg?: string;
  data?: unknown;
  [key: string]: unknown;
};

export class CozeConfigError extends Error {}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new CozeConfigError(`缺少环境变量 ${name}`);
  }
  return value;
}

export async function runCozeWorkflow(payload: ReviewRequest) {
  const token = getRequiredEnv("COZE_API_TOKEN");
  const workflowId = getRequiredEnv("COZE_MAIN_WORKFLOW_ID");
  const apiBase = process.env.COZE_API_BASE || "https://api.coze.cn";
  const timeoutMs = Number(process.env.COZE_TIMEOUT_MS || 45000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiBase.replace(/\/$/, "")}/v1/workflow/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        parameters: {
          company_name: payload.companyName,
          review_stance: payload.reviewStance === "buyer" ? "买方" : "卖方",
          review_mode: payload.reviewMode === "quick" ? "快速审查" : "精细审查",
          hetong: payload.contractText,
          other_standard: payload.otherStandard || ""
        }
      }),
      signal: controller.signal
    });

    const json = (await response.json().catch(() => null)) as CozeRunResponse | null;
    if (!response.ok) {
      throw new Error(`Coze API HTTP ${response.status}: ${JSON.stringify(json)}`);
    }

    if (json?.code && json.code !== 0) {
      throw new Error(`Coze API code ${json.code}: ${json.msg || "unknown error"}`);
    }

    return json?.data ?? json;
  } finally {
    clearTimeout(timeout);
  }
}
