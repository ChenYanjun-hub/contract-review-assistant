import type { ReviewRequest } from "./types";

type CozeRunResponse = {
  code?: number;
  msg?: string;
  data?: unknown;
  [key: string]: unknown;
};

type CozeUploadResponse = {
  code?: number;
  msg?: string;
  data?: {
    id?: string;
    file_id?: string;
    [key: string]: unknown;
  };
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

function getWorkflowId() {
  return process.env.COZE_MAIN_WORKFLOW_ID || process.env.COZE_WORKFLOW_ID || "";
}

function getCozeConfig() {
  return {
    token: getRequiredEnv("COZE_API_TOKEN"),
    workflowId: getWorkflowId(),
    apiBase: process.env.COZE_API_BASE || "https://api.coze.cn",
    timeoutMs: Number(process.env.COZE_TIMEOUT_MS || 45000)
  };
}

function mapReviewStance(value: ReviewRequest["reviewStance"]) {
  return value === "buyer" ? "采购方" : "销售方";
}

function mapReviewMode(value: ReviewRequest["reviewMode"]) {
  return value === "quick" ? "快速审查" : "精细审查";
}

function parseCozeMarkdown(data: unknown) {
  if (typeof data !== "string") {
    return data;
  }

  const trimmed = data.trim();
  if (!trimmed) {
    return data;
  }

  try {
    const parsed = JSON.parse(trimmed) as { data?: unknown; content?: unknown };
    if (typeof parsed.data === "string" && parsed.data.trim()) {
      return parsed.data;
    }
    if (typeof parsed.content === "string" && parsed.content.trim()) {
      return parsed.content;
    }
    return parsed;
  } catch {
    return data;
  }
}

export async function runCozeWorkflow(payload: ReviewRequest) {
  const { token, workflowId, apiBase, timeoutMs } = getCozeConfig();
  if (!workflowId) {
    throw new CozeConfigError("缺少环境变量 COZE_MAIN_WORKFLOW_ID");
  }
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
          review_stance: mapReviewStance(payload.reviewStance),
          review_mode: mapReviewMode(payload.reviewMode),
          hetong: payload.contractText
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

async function uploadCozeFile(file: File, config: ReturnType<typeof getCozeConfig>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const formData = new FormData();
  formData.append("file", file, file.name);

  try {
    const response = await fetch(`${config.apiBase.replace(/\/$/, "")}/v1/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`
      },
      body: formData,
      signal: controller.signal
    });

    const json = (await response.json().catch(() => null)) as CozeUploadResponse | null;
    if (!response.ok) {
      throw new Error(`Coze file upload HTTP ${response.status}: ${JSON.stringify(json)}`);
    }
    if (json?.code && json.code !== 0) {
      throw new Error(`Coze file upload code ${json.code}: ${json.msg || "unknown error"}`);
    }

    const fileId = json?.data?.id || json?.data?.file_id;
    if (!fileId) {
      throw new Error(`Coze file upload missing file_id: ${JSON.stringify(json)}`);
    }
    return fileId;
  } finally {
    clearTimeout(timeout);
  }
}

export async function runCozeFileWorkflow(file: File, payload: Omit<ReviewRequest, "contractText">) {
  const config = getCozeConfig();
  if (!config.workflowId) {
    throw new CozeConfigError("缺少环境变量 COZE_MAIN_WORKFLOW_ID");
  }

  const fileId = await uploadCozeFile(file, config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.apiBase.replace(/\/$/, "")}/v1/workflow/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        workflow_id: config.workflowId,
        parameters: {
          hetong: JSON.stringify({ file_id: fileId }),
          company_name: payload.companyName,
          review_stance: mapReviewStance(payload.reviewStance),
          review_mode: mapReviewMode(payload.reviewMode)
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

    return parseCozeMarkdown(json?.data ?? json);
  } finally {
    clearTimeout(timeout);
  }
}
