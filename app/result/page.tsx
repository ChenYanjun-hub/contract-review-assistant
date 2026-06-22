"use client";

import { useEffect, useMemo, useState } from "react";
import { mockResult } from "@/lib/mockResult";
import { riskLevelLabel } from "@/lib/normalizeResult";
import type { ReviewExceptionKind, ReviewResult, RiskLevel } from "@/lib/types";

type SuggestionView = "original" | "concise" | "formal";

const riskFilters: Array<{ label: string; value: "all" | RiskLevel }> = [
  { label: "全部", value: "all" },
  { label: "高风险", value: "high" },
  { label: "中风险", value: "medium" },
  { label: "低风险", value: "low" }
];

const suggestionViews: Array<{ label: string; value: SuggestionView }> = [
  { label: "原始建议", value: "original" },
  { label: "简洁版", value: "concise" },
  { label: "条款版", value: "formal" }
];

function riskScore(result: ReviewResult) {
  const total = Math.max(result.riskItems.length, 1);
  const weighted = result.riskStats.high * 28 + result.riskStats.medium * 14 + result.riskStats.low * 5;
  return Math.min(100, Math.round((weighted / total) * 2.4));
}

function hasStructuredScoringBasis(result: ReviewResult) {
  return !result.isMock && result.riskItems.length > 0;
}

function estimateAssistedScore(result: ReviewResult) {
  let score = result.overallRisk === "high" ? 78 : result.overallRisk === "medium" ? 52 : 28;
  score += Math.min(12, result.riskStats.high * 10 + result.riskStats.medium * 5 + result.riskStats.low * 2);

  const text = `${result.summary} ${result.finalAdvice} ${result.rawText || ""}`;
  const highSignals = ["高风险", "重大", "无效", "未明确", "争议", "违约", "主体", "授权"];
  const lowSignals = ["低风险", "可签署", "基本完整", "风险较低"];

  score += highSignals.reduce((acc, keyword) => acc + (text.includes(keyword) ? 2 : 0), 0);
  score -= lowSignals.reduce((acc, keyword) => acc + (text.includes(keyword) ? 2 : 0), 0);

  if (result.isMock) {
    score = Math.min(score, 58);
  }

  return Math.max(20, Math.min(89, Math.round(score)));
}

function scoringBasisLabel(result: ReviewResult, hasScoreBasis: boolean) {
  if (hasScoreBasis) {
    return "真实结构化结果";
  }
  if (result.isMock) {
    return "示例 / 回退结果";
  }
  if (result.riskItems.length === 0) {
    return "纯文本结果";
  }
  return "结构不完整";
}

function scoreLabel(score: number) {
  if (score >= 70) {
    return "需重点修改";
  }
  if (score >= 40) {
    return "建议修改后签署";
  }
  return "可进入复核";
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.85) {
    return "高";
  }
  if (confidence >= 0.7) {
    return "中";
  }
  return "低";
}

function createReportId() {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CR-${datePart}-${randomPart}`;
}

function suggestedClauseText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("建议") || trimmed.startsWith("补充") || trimmed.startsWith("写明") || trimmed.startsWith("约定")) {
    return `建议条款：${trimmed}`;
  }
  return `建议条款：建议补充约定“${trimmed}”。`;
}

function conciseSuggestionText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("建议")) {
    return trimmed;
  }
  return `建议：${trimmed}`;
}

function formalClauseText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes("写明") || trimmed.includes("约定") || trimmed.includes("补充")) {
    return `建议条款表述：合同中应明确约定，${trimmed.replace(/^(建议|补充|写明|约定)/, "")}`;
  }
  return `建议条款表述：合同中应补充明确约定“${trimmed}”，并以书面条款固定双方责任边界。`;
}

function suggestionViewText(text: string, view: SuggestionView) {
  if (view === "concise") {
    return conciseSuggestionText(text);
  }
  if (view === "formal") {
    return formalClauseText(text) || suggestedClauseText(text);
  }
  return text.trim();
}

function summaryLooksNoisy(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  return (
    trimmed.includes("|") ||
    trimmed.includes("||") ||
    trimmed.includes("##") ||
    trimmed.includes("风险事项") ||
    trimmed.length > 220
  );
}

function extractTopTopics(result: ReviewResult) {
  const topics: string[] = [];
  for (const item of result.riskItems) {
    const topic = item.checkPoint.split("/")[0]?.trim() || item.checkPoint.trim();
    if (topic && !topics.includes(topic)) {
      topics.push(topic);
    }
  }
  return topics.slice(0, 3);
}

function executiveSummary(result: ReviewResult) {
  if (!summaryLooksNoisy(result.summary)) {
    return result.summary;
  }

  const topics = extractTopTopics(result);
  const topicText = topics.length > 0 ? `，重点集中在${topics.join("、")}等条款` : "";
  const suffix = result.isMock ? "当前为 AI 辅助整理结果，建议结合人工复核确认。" : "建议优先处理高风险事项后再推进签署。";

  return `本次审查识别出高风险 ${result.riskStats.high} 项、中风险 ${result.riskStats.medium} 项、低风险 ${result.riskStats.low} 项${topicText}。${suffix}`;
}

export default function ResultPage() {
  const [result, setResult] = useState<ReviewResult>(mockResult);
  const [copied, setCopied] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | RiskLevel>("all");
  const [suggestionViewById, setSuggestionViewById] = useState<Record<string, SuggestionView>>({});
  const [reportId, setReportId] = useState("");
  const [generatedAtIso, setGeneratedAtIso] = useState("");
  const [resultStatus, setResultStatus] = useState<"loading" | "ready" | "missing" | "invalid">("loading");
  const [reviewIssue, setReviewIssue] = useState("");

  useEffect(() => {
    setReportId(createReportId());
    setGeneratedAtIso(new Date().toISOString());
    setReviewIssue(sessionStorage.getItem("latestReviewIssue") || "");

    const saved = sessionStorage.getItem("latestReviewResult");
    if (!saved) {
      setResultStatus("missing");
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Partial<ReviewResult>;
      if (
        !parsed ||
        !parsed.summary ||
        !parsed.overallRisk ||
        !parsed.riskStats ||
        !Array.isArray(parsed.riskItems) ||
        !parsed.finalAdvice
      ) {
        setResultStatus("invalid");
        return;
      }
      setResult(parsed as ReviewResult);
      setResultStatus("ready");
    } catch {
      setResultStatus("invalid");
    }
  }, []);

  const generatedAt = generatedAtIso
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(generatedAtIso))
    : "";

  const reportSource = result.isMock ? "示例结果模式" : "智能审查工作流";
  const reportScope = "购销合同初步法务审查";
  const reviewConfig = "通用购销合同审查规则";
  const resultExceptionKind: ReviewExceptionKind | null =
    resultStatus === "missing" ? "result_missing" : resultStatus === "invalid" ? "result_invalid" : null;

  const reportText = useMemo(() => {
    const scoreValue = hasStructuredScoringBasis(result) ? riskScore(result) : estimateAssistedScore(result);
    const scoreMode = hasStructuredScoringBasis(result) ? "结构化计分" : "AI辅助估算";
    return [
      "购销合同智能审查报告",
      "",
      `报告编号：${reportId || "生成中"}`,
      `生成时间：${generatedAt || "生成中"}`,
      `报告来源：${reportSource}`,
      `审查范围：${reportScope}`,
      `审查配置：${reviewConfig}`,
      `风险评分：${scoreValue}`,
      `评分模式：${scoreMode}`,
      "",
      `总体风险：${riskLevelLabel(result.overallRisk)}`,
      `风险统计：高风险 ${result.riskStats.high} 项 / 中风险 ${result.riskStats.medium} 项 / 低风险 ${result.riskStats.low} 项`,
      `摘要：${result.summary}`,
      "",
      "风险清单：",
      ...result.riskItems.map(
        (item, index) =>
          `${index + 1}. 【${riskLevelLabel(item.riskLevel)}】${item.checkPoint}\n原文：${item.contractText}\n原因：${item.reason}\n简洁版建议：${conciseSuggestionText(item.suggestion)}\n正式条款版建议：${formalClauseText(item.suggestion)}`
      ),
      "",
      `最终建议：${result.finalAdvice}`,
      "",
      "免责声明：AI 内容仅供初步审查辅助，不构成正式法律意见。"
    ].join("\n");
  }, [generatedAt, reportId, reportSource, result]);

  async function copyReport() {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function downloadReport(format: "md" | "txt") {
    const mimeType = format === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
    const fileName = `${reportId || "contract-review-report"}.${format}`;
    const blob = new Blob([reportText], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const hasScoreBasis = hasStructuredScoringBasis(result);
  const scoreMode = hasScoreBasis ? "结构化计分" : "AI辅助估算";
  const score = hasScoreBasis ? riskScore(result) : estimateAssistedScore(result);
  const scoreDisplay = score;
  const scoreSummary = hasScoreBasis ? scoreLabel(score) : `${scoreLabel(score)}（估算）`;
  const heroSummary = executiveSummary(result);
  const highPriorityItems = result.riskItems
    .filter((item) => item.riskLevel === "high" || item.riskLevel === "medium")
    .slice(0, 3);
  const filteredItems =
    activeFilter === "all" ? result.riskItems : result.riskItems.filter((item) => item.riskLevel === activeFilter);
  const groupedRiskItems = {
    high: result.riskItems.filter((item) => item.riskLevel === "high"),
    medium: result.riskItems.filter((item) => item.riskLevel === "medium"),
    low: result.riskItems.filter((item) => item.riskLevel === "low")
  };
  const scoringBasis = scoringBasisLabel(result, hasScoreBasis);

  function currentSuggestionView(itemId: string) {
    return suggestionViewById[itemId] ?? "original";
  }

  function switchSuggestionView(itemId: string, view: SuggestionView) {
    setSuggestionViewById((current) => {
      if (current[itemId] === view) {
        return current;
      }
      return { ...current, [itemId]: view };
    });
  }

  if (resultStatus === "loading") {
    return (
      <main className="shell">
        <div className="page">
          <header className="topbar">
            <a className="brand" href="/">
              <span className="brand-mark">审</span>
              购销合同法务审查助手
            </a>
            <nav className="nav">
              <a href="/">首页</a>
              <a href="/review">继续审查</a>
            </nav>
          </header>

          <section className="report-empty-layout panel">
            <div className="report-empty-copy">
              <div className="eyebrow">Loading Result</div>
              <h1>正在读取本次审查结果。</h1>
              <p>系统正在校验会话结果并准备页面内容，请稍候。</p>
            </div>

            <aside className="exception-panel warning">
              <div className="exception-panel-head">
                <strong>结果载入中</strong>
                <span className="pill">处理中</span>
              </div>
              <p>如果长时间未完成载入，请返回审查工作台重新发起一次审查。</p>
            </aside>
          </section>
        </div>
      </main>
    );
  }

  if (resultStatus !== "ready") {
    const isMissing = resultExceptionKind === "result_missing";
    return (
      <main className="shell">
        <div className="page">
          <header className="topbar">
            <a className="brand" href="/">
              <span className="brand-mark">审</span>
              购销合同法务审查助手
            </a>
            <nav className="nav">
              <a href="/">首页</a>
              <a href="/review">继续审查</a>
            </nav>
          </header>

          <section className="report-empty-layout panel">
            <div className="report-empty-copy">
              <div className="eyebrow">Result State</div>
              <h1>{isMissing ? "当前没有可展示的审查结果。" : "审查结果暂时不可用。"}</h1>
              <p>
                {isMissing
                  ? "本次会话中尚未生成新的审查结果，或页面在脱离审查流程后被直接打开。"
                  : "系统检测到返回结果结构不完整，建议重新发起审查，并保留人工复核作为补充判断。"}
              </p>
              <div className="actions">
                <a className="button primary" href="/review">
                  返回审查工作台
                </a>
                <a className="button" href="/">
                  返回首页
                </a>
              </div>
            </div>

            <aside className="exception-panel warning">
              <div className="exception-panel-head">
                <strong>{isMissing ? "结果缺失状态" : "结果异常状态"}</strong>
                <span className="pill">{isMissing ? "待发起" : "待重试"}</span>
              </div>
              <p>
                {isMissing
                  ? "建议返回审查工作台重新上传或粘贴合同内容，并完成一次新的审查提交。"
                  : "建议重新发起审查任务；若多次返回异常结果，应结合人工复核确认合同风险。"}
              </p>
              <ul className="exception-list">
                <li>{isMissing ? "当前页面未读取到 latestReviewResult 会话数据。" : "当前 latestReviewResult 数据结构未通过前端校验。"}</li>
                {reviewIssue ? <li>最近一次流程提示：{reviewIssue}</li> : null}
                <li>如为智能工作流波动，建议稍后重试。</li>
              </ul>
            </aside>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="page">
        <header className="topbar">
          <a className="brand" href="/">
            <span className="brand-mark">审</span>
            购销合同法务审查助手
          </a>
          <nav className="nav">
            <a href="/">首页</a>
            <a href="/review">继续审查</a>
          </nav>
        </header>

        <section className="report-hero">
          <div>
            <div className="eyebrow">Contract Review Report</div>
            <h1>购销合同智能审查报告</h1>
            <p>{heroSummary}</p>
            <div className="meta-list">
              <span className={`badge ${result.overallRisk}`}>{riskLevelLabel(result.overallRisk)}</span>
              {result.isMock ? <span className="badge mock">示例结果模式</span> : <span className="pill strong">工作流返回</span>}
              <span className="pill">报告编号：{reportId || "生成中"}</span>
              <span className="pill">生成时间：{generatedAt}</span>
            </div>
          </div>

          <div className="score-card">
            <span>{scoreMode}</span>
            <strong>{scoreDisplay}</strong>
            <p>{scoreSummary}</p>
            {!hasScoreBasis ? <small>当前分数基于总体风险、风险统计与结果文本关键词进行辅助估算</small> : null}
            <div className="score-basis-list">
              <div>
                <span>评分模式</span>
                <strong>{scoreMode}</strong>
              </div>
              <div>
                <span>计分依据</span>
                <strong>{scoringBasis}</strong>
              </div>
              <div>
                <span>参与计分风险项</span>
                <strong>{hasScoreBasis ? `${result.riskItems.length} 项` : "0 项"}</strong>
              </div>
              <div>
                <span>计分明细</span>
                <strong>
                  高 {result.riskStats.high} / 中 {result.riskStats.medium} / 低 {result.riskStats.low}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className="report-grid">
          <aside className="side-stack summary-card">
            {result.isMock ? (
              <section className="exception-panel warning">
                <div className="exception-panel-head">
                  <strong>当前展示的是示例结果模式</strong>
                  <span className="pill">需人工复核</span>
                </div>
                <p>
                  本次结果未直接来自稳定的工作流返回，当前页面用于保障结果页可继续展示与流转，不应替代正式人工审查。
                </p>
                <ul className="exception-list">
                  <li>{reviewIssue || "建议重新发起审查，确认工作流已正常返回结构化结果。"}</li>
                  <li>高风险条款仍应优先进入人工复核。</li>
                </ul>
              </section>
            ) : null}
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>报告详情</h2>
                  <p>用于汇报时快速说明本次审查结果。</p>
                </div>
              </div>

              <div className="stats compact">
                <div className="stat high">
                  <strong>{result.riskStats.high}</strong>
                  高风险
                </div>
                <div className="stat medium">
                  <strong>{result.riskStats.medium}</strong>
                  中风险
                </div>
                <div className="stat low">
                  <strong>{result.riskStats.low}</strong>
                  低风险
                </div>
              </div>

              <div className="report-meta">
                <div>
                  <span>报告编号</span>
                  <strong>{reportId || "生成中"}</strong>
                </div>
                <div>
                  <span>审查范围</span>
                  <strong>{reportScope}</strong>
                </div>
                <div>
                  <span>风险项数量</span>
                  <strong>{result.riskItems.length} 项</strong>
                </div>
                <div>
                  <span>结果来源</span>
                  <strong>{reportSource}</strong>
                </div>
                <div>
                  <span>审查配置</span>
                  <strong>{reviewConfig}</strong>
                </div>
                <div>
                  <span>审查结论</span>
                  <strong>{scoreSummary}</strong>
                </div>
                <div>
                  <span>评分依据</span>
                  <strong>{scoringBasis}</strong>
                </div>
              </div>
            </section>

            <section className="panel">
              <h2>最终建议</h2>
              <p>{result.finalAdvice}</p>
              <div className="actions">
                <a className="button primary" href="/review">
                  继续审查
                </a>
                <button className="button" type="button" onClick={copyReport}>
                  {copied ? "已复制" : "复制报告"}
                </button>
                <button className="button" type="button" onClick={() => downloadReport("md")}>
                  下载 Markdown
                </button>
              </div>
              {!hasScoreBasis ? (
                <p className="hint" style={{ marginTop: 12 }}>
                  当前结果未返回完整结构化风险清单，页面展示的是 AI 辅助估算分，可用于快速量化风险程度，但仍建议结合人工复核判断。
                </p>
              ) : null}
            </section>

            <section className="status-card">
              <h3>使用说明</h3>
              <ul className="check-list">
                <li>AI 内容仅供初步审查辅助，不构成正式法律意见。</li>
                <li>高风险条款建议优先修改，再进入人工复核。</li>
                <li>低置信度或缺少合同依据的结论，应结合原文再次确认。</li>
              </ul>
            </section>
          </aside>

          <div className="side-stack">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>关键风险发现</h2>
                  <p>优先处理高风险和中风险条款，降低签署前的不确定性。</p>
                </div>
                <span className="pill strong">{highPriorityItems.length} 项重点</span>
              </div>

              <div className="finding-grid">
                {highPriorityItems.map((item) => (
                  <article className="finding-card" key={item.id}>
                    <div className="result-header">
                      <span className={`badge ${item.riskLevel}`}>{riskLevelLabel(item.riskLevel)}</span>
                      <span className="pill">置信度 {confidenceLabel(item.confidence)}</span>
                    </div>
                    <h3>{item.checkPoint}</h3>
                    <p>{item.reason}</p>
                    <div className="quote-block">{item.contractText}</div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>风险清单</h2>
                  <p>按风险等级筛选，逐条查看原文、原因和修改建议。</p>
                </div>
                <div className="filter-group" aria-label="风险等级筛选">
                  {riskFilters.map((filter) => (
                    <button
                      className={activeFilter === filter.value ? "filter-button active" : "filter-button"}
                      key={filter.value}
                      onClick={() => setActiveFilter(filter.value)}
                      type="button"
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="risk-list">
                {filteredItems.map((item, index) => (
                  <article className="risk-row" key={item.id}>
                    <div className="risk-index">{String(index + 1).padStart(2, "0")}</div>
                    <div className="risk-content">
                      <div className="risk-row-head">
                        <div>
                          <span className={`badge ${item.riskLevel}`}>{riskLevelLabel(item.riskLevel)}</span>
                          <h3>{item.checkPoint}</h3>
                        </div>
                        <span className="pill">置信度 {Math.round(item.confidence * 100)}%</span>
                      </div>
                      <div className="risk-detail-grid">
                        <div>
                          <span>合同原文</span>
                          <p>{item.contractText}</p>
                        </div>
                        <div>
                          <span>风险原因</span>
                          <p>{item.reason}</p>
                        </div>
                        <div>
                          <span>修改建议</span>
                          <p>{item.suggestion}</p>
                          {item.confidence < 0.7 ? <p className="hint">建议人工复核</p> : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="result-header">
                <div>
                  <h2>报告正文</h2>
                  <p>用于业务流转材料、审批沟通或后续人工复核，重点风险已做分层突出。</p>
                </div>
                <div className="meta-list">
                  <button className="button" type="button" onClick={copyReport}>
                    {copied ? "已复制" : "复制报告"}
                  </button>
                  <button className="button" type="button" onClick={() => downloadReport("md")}>
                    下载 .md
                  </button>
                  <button className="button" type="button" onClick={() => downloadReport("txt")}>
                    下载 .txt
                  </button>
                </div>
              </div>
              <div className="report-body">
                <section className={`report-body-hero ${result.overallRisk}`}>
                  <div className="report-body-hero-copy">
                    <span className="eyebrow">Overall Conclusion</span>
                    <h3>{riskLevelLabel(result.overallRisk)}，{scoreSummary}</h3>
                    <p>{heroSummary}</p>
                  </div>
                  <div className="report-body-hero-stats">
                    <div>
                      <span>高风险</span>
                      <strong>{result.riskStats.high}</strong>
                    </div>
                    <div>
                      <span>中风险</span>
                      <strong>{result.riskStats.medium}</strong>
                    </div>
                    <div>
                      <span>低风险</span>
                      <strong>{result.riskStats.low}</strong>
                    </div>
                  </div>
                </section>

                <section className="report-section">
                  <div className="report-section-head">
                    <div>
                      <span className="eyebrow">Priority Risks</span>
                      <h3>优先处理事项</h3>
                    </div>
                    <span className="pill strong">{highPriorityItems.length} 项需优先推进</span>
                  </div>
                  <div className="priority-report-list">
                    {highPriorityItems.map((item) => (
                      <article className={`priority-report-card ${item.riskLevel}`} key={`priority-${item.id}`}>
                        <div className="priority-report-head">
                          <div className="priority-risk-mark">
                            {item.riskLevel === "high" ? <span className="risk-alert-icon">!</span> : null}
                            <span className={`badge ${item.riskLevel}`}>{riskLevelLabel(item.riskLevel)}</span>
                          </div>
                          <span className="pill">置信度 {Math.round(item.confidence * 100)}%</span>
                        </div>
                        <h4>{item.checkPoint}</h4>
                        <p>{item.reason}</p>
                        {item.riskLevel === "high" ? <div className="priority-risk-note">建议在签署前优先完成条款修订与人工复核。</div> : null}
                        <div className="priority-report-suggestion">{item.suggestion}</div>
                      </article>
                    ))}
                  </div>
                </section>

                {(["high", "medium", "low"] as const).map((level) =>
                  groupedRiskItems[level].length ? (
                    <section className="report-section" key={`group-${level}`}>
                      <div className="report-section-head">
                        <div>
                          <span className="eyebrow">Risk Details</span>
                          <h3>{riskLevelLabel(level)}事项</h3>
                        </div>
                        <span className={`badge ${level}`}>{groupedRiskItems[level].length} 项</span>
                      </div>

                      <div className="report-entry-list">
                        {groupedRiskItems[level].map((item, index) => (
                          <article className={`report-entry ${item.riskLevel}`} key={`entry-${item.id}`}>
                            <div className="report-entry-head">
                              <div className="report-entry-title">
                                <span className="report-entry-index">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                <div>
                                  <span className={`badge ${item.riskLevel}`}>{riskLevelLabel(item.riskLevel)}</span>
                                  <h4>{item.checkPoint}</h4>
                                </div>
                              </div>
                              <span className="pill">置信度 {Math.round(item.confidence * 100)}%</span>
                            </div>

                            <div className="report-entry-grid">
                              <div>
                                <span>对应原文</span>
                                <p>{item.contractText}</p>
                              </div>
                              <div>
                                <span>判定原因</span>
                                <p>{item.reason}</p>
                              </div>
                              <div className="suggestion-block">
                                <span>修改建议</span>
                                <div className="suggestion-tabs" role="tablist" aria-label="建议版本切换">
                                  {suggestionViews.map((view) => {
                                    const active = currentSuggestionView(item.id) === view.value;
                                    return (
                                      <button
                                        key={`${item.id}-${view.value}`}
                                        type="button"
                                        className={`suggestion-tab${active ? " active" : ""}`}
                                        aria-pressed={active}
                                        onClick={() => switchSuggestionView(item.id, view.value)}
                                      >
                                        {view.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className={`suggestion-quote${currentSuggestionView(item.id) === "formal" ? " formal" : ""}`}>
                                  <strong>
                                    {currentSuggestionView(item.id) === "original"
                                      ? "原始建议"
                                      : currentSuggestionView(item.id) === "concise"
                                        ? "简洁版建议"
                                        : "正式条款版建议"}
                                  </strong>
                                  <blockquote>{suggestionViewText(item.suggestion, currentSuggestionView(item.id))}</blockquote>
                                </div>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null
                )}

                <section className="report-section">
                  <div className="report-section-head">
                    <div>
                      <span className="eyebrow">Final Advice</span>
                      <h3>签署前建议</h3>
                    </div>
                  </div>
                  <div className="final-advice-card">
                    <p>{result.finalAdvice}</p>
                    <small>AI 内容仅供初步审查辅助，不构成正式法律意见；高风险与低置信度事项建议继续人工复核。</small>
                  </div>
                </section>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
