import { mockResult } from "./mockResult";
import type { ReviewResult, RiskItem, RiskLevel } from "./types";

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickString(record: AnyRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function mapRiskLevel(value: unknown): RiskLevel {
  const text = String(value ?? "").toLowerCase();
  if (["高", "high", "严重", "重大"].some((item) => text.includes(item))) {
    return "high";
  }
  if (["低", "low", "轻微"].some((item) => text.includes(item))) {
    return "low";
  }
  return "medium";
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return value;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return value;
    }
  }
}

function unwrapCozePayload(raw: unknown): unknown {
  let value = parseMaybeJson(raw);
  if (!isRecord(value)) {
    return value;
  }

  const candidates = [
    value.output,
    value.output_pro,
    value.data,
    value.result,
    value.content,
    value.answer
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined) {
      const parsed = parseMaybeJson(candidate);
      if (isRecord(parsed)) {
        value = parsed;
        break;
      }
      if (typeof parsed === "string" && parsed.trim()) {
        return parsed;
      }
    }
  }

  return value;
}

function normalizeRiskItems(value: unknown): RiskItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const record = isRecord(item) ? item : {};
    return {
      id: pickString(record, ["id", "riskId"], `R-${String(index + 1).padStart(3, "0")}`),
      checkPoint: pickString(record, ["checkPoint", "check_point", "checkpoint", "审查项"], "未命名审查项"),
      riskLevel: mapRiskLevel(record.riskLevel ?? record.risk_level ?? record["风险等级"]),
      contractText: pickString(record, ["contractText", "contract_text", "原文", "合同原文"], "未提取到对应合同原文"),
      reason: pickString(record, ["reason", "riskReason", "风险原因", "原因"], "建议人工复核该项风险。"),
      suggestion: pickString(record, ["suggestion", "建议", "修改建议"], "建议结合交易背景补充或修改该条款。"),
      confidence:
        typeof record.confidence === "number"
          ? Math.max(0, Math.min(1, record.confidence))
          : 0.75
    };
  });
}

function buildStats(items: RiskItem[]) {
  return items.reduce(
    (acc, item) => {
      acc[item.riskLevel] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
}

function buildReport(result: ReviewResult) {
  const lines = [
    "购销合同智能审查报告",
    "",
    `总体风险：${riskLevelLabel(result.overallRisk)}`,
    `摘要：${result.summary}`,
    "",
    "风险清单：",
    ...result.riskItems.map(
      (item, index) =>
        `${index + 1}. 【${riskLevelLabel(item.riskLevel)}】${item.checkPoint}\n原文：${item.contractText}\n原因：${item.reason}\n建议：${item.suggestion}`
    ),
    "",
    `最终建议：${result.finalAdvice}`,
    "",
    "免责声明：AI 内容仅供初步审查辅助，不构成正式法律意见。"
  ];
  return lines.join("\n");
}

export function riskLevelLabel(level: RiskLevel) {
  return level === "high" ? "高风险" : level === "medium" ? "中风险" : "低风险";
}

export function normalizeResult(raw: unknown, options?: { fallbackToMock?: boolean }): ReviewResult {
  const payload = unwrapCozePayload(raw);

  if (typeof payload === "string") {
    const result: ReviewResult = {
      overallRisk: "medium",
      summary: payload.slice(0, 300),
      riskStats: { high: 0, medium: 1, low: 0 },
      riskItems: [],
      finalAdvice: "Coze 返回了纯文本结果，建议人工复核并补充结构化输出格式。",
      reportText: payload,
      isMock: false,
      source: "coze",
      rawText: payload
    };
    return result;
  }

  if (!isRecord(payload)) {
    if (options?.fallbackToMock === false) {
      throw new Error("Coze 返回结构无法解析");
    }
    return mockResult;
  }

  const riskItems = normalizeRiskItems(
    payload.riskItems ?? payload.risk_items ?? payload.risks ?? payload["风险清单"]
  );
  const stats = buildStats(riskItems);
  const result: ReviewResult = {
    overallRisk: mapRiskLevel(payload.overallRisk ?? payload.overall_risk ?? payload["总体风险"]),
    summary: pickString(payload, ["summary", "摘要"], mockResult.summary),
    riskStats:
      isRecord(payload.riskStats) || isRecord(payload.risk_stats)
        ? {
            high: Number((payload.riskStats as AnyRecord)?.high ?? (payload.risk_stats as AnyRecord)?.high ?? stats.high),
            medium: Number(
              (payload.riskStats as AnyRecord)?.medium ?? (payload.risk_stats as AnyRecord)?.medium ?? stats.medium
            ),
            low: Number((payload.riskStats as AnyRecord)?.low ?? (payload.risk_stats as AnyRecord)?.low ?? stats.low)
          }
        : stats,
    riskItems,
    finalAdvice: pickString(payload, ["finalAdvice", "final_advice", "最终建议"], mockResult.finalAdvice),
    isMock: false,
    source: "coze"
  };

  if (result.riskItems.length === 0 && options?.fallbackToMock !== false) {
    return {
      ...mockResult,
      summary: `${mockResult.summary}（真实接口返回未包含结构化风险项，当前使用示例风险清单兜底。）`,
      isMock: true,
      source: "mock",
      rawText: JSON.stringify(payload)
    };
  }

  return {
    ...result,
    reportText: pickString(payload, ["reportText", "report_text", "报告正文"], buildReport(result))
  };
}
