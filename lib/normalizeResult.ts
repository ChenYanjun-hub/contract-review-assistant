import { mockResult } from "./mockResult";
import type { ReviewResult, RiskItem, RiskLevel } from "./types";

type AnyRecord = Record<string, unknown>;
type ConfidenceSource = "structured" | "plain_text_row" | "plain_pipe_row";

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

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value));
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

function estimateConfidence({
  checkPoint,
  contractText,
  reason,
  suggestion,
  riskLevel,
  source
}: {
  checkPoint: string;
  contractText: string;
  reason: string;
  suggestion: string;
  riskLevel: RiskLevel;
  source: ConfidenceSource;
}) {
  let score = source === "structured" ? 0.68 : source === "plain_text_row" ? 0.62 : 0.58;

  const normalizedFields = [checkPoint, contractText, reason, suggestion].map((item) => item.trim());
  const totalLength = normalizedFields.reduce((sum, item) => sum + item.length, 0);

  if (checkPoint && checkPoint !== "未命名审查项") {
    score += 0.05;
  }
  if (contractText && contractText !== "未提取到对应合同原文") {
    score += contractText.length > 18 ? 0.08 : 0.04;
  }
  if (reason && reason !== "建议人工复核该项风险。") {
    score += reason.length > 24 ? 0.09 : 0.05;
  }
  if (suggestion && suggestion !== "建议结合交易背景补充或修改该条款。") {
    score += suggestion.length > 20 ? 0.08 : 0.05;
  }
  if (totalLength > 90) {
    score += 0.04;
  }

  const legalSignals = ["合同", "条款", "验收", "交付", "违约", "授权", "付款", "质量", "主体", "风险"];
  const reasonSignals = ["无法", "未", "缺少", "不明", "争议", "无效", "责任", "边界", "不清"];
  const suggestionSignals = ["建议", "补充", "明确", "约定", "写明", "提供", "核实", "增加"];

  const joinedText = `${checkPoint} ${contractText}`;
  if (legalSignals.some((keyword) => joinedText.includes(keyword))) {
    score += 0.04;
  }
  if (reasonSignals.some((keyword) => reason.includes(keyword))) {
    score += 0.04;
  }
  if (suggestionSignals.some((keyword) => suggestion.includes(keyword))) {
    score += 0.04;
  }

  score += riskLevel === "high" ? 0.04 : riskLevel === "medium" ? 0.025 : 0.01;

  if (source === "plain_pipe_row") {
    score -= 0.04;
  }

  return clampConfidence(Math.round(score * 100) / 100);
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
          ? clampConfidence(record.confidence)
          : estimateConfidence({
              checkPoint: pickString(record, ["checkPoint", "check_point", "checkpoint", "审查项"], "未命名审查项"),
              contractText: pickString(record, ["contractText", "contract_text", "原文", "合同原文"], "未提取到对应合同原文"),
              reason: pickString(record, ["reason", "riskReason", "风险原因", "原因"], "建议人工复核该项风险。"),
              suggestion: pickString(record, ["suggestion", "建议", "修改建议"], "建议结合交易背景补充或修改该条款。"),
              riskLevel: mapRiskLevel(record.riskLevel ?? record.risk_level ?? record["风险等级"]),
              source: "structured"
            })
    };
  });
}

function sanitizeText(text: string) {
  return text.replace(/\r/g, "").trim();
}

function compactCell(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function extractBetween(text: string, startPattern: RegExp, endPattern?: RegExp) {
  const startMatch = text.match(startPattern);
  if (!startMatch || startMatch.index === undefined) {
    return "";
  }

  const startIndex = startMatch.index + startMatch[0].length;
  const rest = text.slice(startIndex);
  if (!endPattern) {
    return rest.trim();
  }

  const endMatch = rest.match(endPattern);
  if (!endMatch || endMatch.index === undefined) {
    return rest.trim();
  }

  return rest.slice(0, endMatch.index).trim();
}

function splitPipeCells(text: string) {
  return text
    .split("|")
    .map((cell) => compactCell(cell))
    .filter(Boolean);
}

function extractUniqueTopics(items: RiskItem[]) {
  const topics: string[] = [];
  for (const item of items) {
    const topic = item.checkPoint.split("/")[0]?.trim() || item.checkPoint.trim();
    if (topic && !topics.includes(topic)) {
      topics.push(topic);
    }
  }
  return topics;
}

function parsePlainTextRiskItems(raw: string): RiskItem[] {
  const normalized = sanitizeText(raw).replace(/\|\|/g, "\n");
  const compactRaw = sanitizeText(raw).replace(/\n+/g, " ");
  const candidateLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.includes("|"))
    .filter((line) => !/^[-| ]+$/.test(line))
    .filter((line) => !line.includes("风险事项|对应审核项|原文表述|风险等级|判定原因|修改建议"));

  const items: RiskItem[] = [];
  const rowPattern =
    /(?:^|\|\|)\s*(\d+)\|([^|]+)\|([^|]+)\|([^|]+)\|(高风险|中风险|低风险|high|medium|low)\|([^|]+)\|([^|]+?)(?=(?:\|\|\s*\d+\|)|(?:\|\|##)|(?:最终建议[:：])|(?:免责声明[:：])|$)/gi;

  for (const match of compactRaw.matchAll(rowPattern)) {
    const [, index, riskIssue, checkPoint, contractText, riskLevelText, reason, suggestion] = match;
    items.push({
      id: `R-${String(index).padStart(3, "0")}`,
      checkPoint: `${compactCell(riskIssue)} / ${compactCell(checkPoint)}`,
      riskLevel: mapRiskLevel(riskLevelText),
      contractText: compactCell(contractText),
      reason: compactCell(reason) || "建议人工复核该项风险。",
      suggestion: compactCell(suggestion) || "建议结合交易背景补充或修改该条款。",
      confidence: estimateConfidence({
        checkPoint: `${compactCell(riskIssue)} / ${compactCell(checkPoint)}`,
        riskLevel: mapRiskLevel(riskLevelText),
        contractText: compactCell(contractText),
        reason: compactCell(reason) || "建议人工复核该项风险。",
        suggestion: compactCell(suggestion) || "建议结合交易背景补充或修改该条款。",
        source: "plain_text_row"
      })
    });
  }

  if (items.length > 0) {
    return items;
  }

  for (const line of candidateLines) {
    const cells = splitPipeCells(line);
    if (cells.length < 6) {
      continue;
    }

    const firstCellIsIndex = /^\d+$/.test(cells[0]);
    const riskIssue = firstCellIsIndex ? cells[1] : cells[0];
    const checkPoint = firstCellIsIndex ? cells[2] : cells[1];
    const contractText = firstCellIsIndex ? cells[3] : cells[2];
    const riskLevelText = firstCellIsIndex ? cells[4] : cells[3];
    const reason = firstCellIsIndex ? cells[5] : cells[4];
    const suggestion = firstCellIsIndex ? cells[6] || cells[5] : cells[5] || cells[4];

    if (!riskIssue || !checkPoint || !contractText) {
      continue;
    }

    items.push({
      id: `R-${String(items.length + 1).padStart(3, "0")}`,
      checkPoint: `${riskIssue} / ${checkPoint}`,
      riskLevel: mapRiskLevel(riskLevelText),
      contractText,
      reason: reason || "建议人工复核该项风险。",
      suggestion: suggestion || "建议结合交易背景补充或修改该条款。",
      confidence: estimateConfidence({
        checkPoint: `${riskIssue} / ${checkPoint}`,
        riskLevel: mapRiskLevel(riskLevelText),
        contractText,
        reason: reason || "建议人工复核该项风险。",
        suggestion: suggestion || "建议结合交易背景补充或修改该条款。",
        source: "plain_pipe_row"
      })
    });
  }

  return items;
}

function normalizePlainTextReport(raw: string): ReviewResult {
  const normalized = sanitizeText(raw).replace(/\|\|/g, "\n");
  const headingMatch = normalized.match(/##\s*([^\n|]+)/);
  const finalAdvice =
    extractBetween(normalized, /最终建议[:：]\s*/i, /免责声明[:：]|$/i) ||
    "Coze 返回了纯文本结果，建议结合人工复核确认风险并补充结构化输出。";
  const disclaimer = extractBetween(normalized, /免责声明[:：]\s*/i);
  const riskItems = parsePlainTextRiskItems(normalized);
  const riskStats = buildStats(riskItems);
  const overallRisk: RiskLevel =
    riskStats.high > 0 ? "high" : riskStats.medium > 0 ? "medium" : riskStats.low > 0 ? "low" : mapRiskLevel(normalized);
  const summaryText =
    riskItems.length > 0
      ? (() => {
          const topics = extractUniqueTopics(riskItems).slice(0, 3);
          const topicText = topics.length > 0 ? `，重点集中在${topics.join("、")}等条款` : "";
          return `系统从纯文本结果中恢复出 ${riskItems.length} 项风险，其中高风险 ${riskStats.high} 项、中风险 ${riskStats.medium} 项、低风险 ${riskStats.low} 项${topicText}，建议优先处理高风险事项后再推进签署。`;
        })()
      : extractBetween(normalized, /##\s*[^\n]+\n?/i, /(?:\n\s*\d+\s*\||\n风险清单[:：]|\n最终建议[:：]|$)/i) ||
        normalized.slice(0, 220);

  const normalizedFinalAdvice =
    compactCell(finalAdvice.replace(/^(\d+\.)?\s*签署建议[:：]?/i, "")) ||
    "建议结合人工复核确认风险并完善结构化输出。";

  const readableReport = [
    headingMatch ? headingMatch[1].trim() : "购销合同审查结果",
    "",
    `总体风险：${riskLevelLabel(overallRisk)}`,
    `风险统计：高风险 ${riskStats.high} 项 / 中风险 ${riskStats.medium} 项 / 低风险 ${riskStats.low} 项`,
    "",
    compactCell(summaryText),
    "",
    riskItems.length
      ? riskItems
          .map(
            (item, index) =>
              `${index + 1}. 【${riskLevelLabel(item.riskLevel)}】${item.checkPoint}\n原文：${item.contractText}\n原因：${item.reason}\n建议：${item.suggestion}`
          )
          .join("\n\n")
      : normalized,
    "",
    `最终建议：${normalizedFinalAdvice}`,
    disclaimer ? `免责声明：${disclaimer}` : "免责声明：AI 内容仅供初步审查辅助，不构成正式法律意见。"
  ]
    .filter(Boolean)
    .join("\n");

  return {
    overallRisk,
    summary: compactCell(summaryText) || "Coze 返回了纯文本审查结果，系统已自动整理为可读结构。",
    riskStats:
      riskItems.length > 0
        ? riskStats
        : {
            high: normalized.includes("高风险") ? 1 : 0,
            medium: normalized.includes("中风险") ? 1 : 0,
            low: normalized.includes("低风险") ? 1 : 0
          },
    riskItems,
    finalAdvice: normalizedFinalAdvice,
    reportText: readableReport,
    isMock: false,
    source: "coze",
    rawText: raw
  };
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
    return normalizePlainTextReport(payload);
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
