"use client";

import { useEffect, useMemo, useState } from "react";
import { mockResult } from "@/lib/mockResult";
import { riskLevelLabel } from "@/lib/normalizeResult";
import type { ReviewResult, RiskLevel } from "@/lib/types";

const riskFilters: Array<{ label: string; value: "all" | RiskLevel }> = [
  { label: "全部", value: "all" },
  { label: "高风险", value: "high" },
  { label: "中风险", value: "medium" },
  { label: "低风险", value: "low" }
];

function riskScore(result: ReviewResult) {
  const total = Math.max(result.riskItems.length, 1);
  const weighted = result.riskStats.high * 28 + result.riskStats.medium * 14 + result.riskStats.low * 5;
  return Math.min(100, Math.round((weighted / total) * 2.4));
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

export default function ResultPage() {
  const [result, setResult] = useState<ReviewResult>(mockResult);
  const [copied, setCopied] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | RiskLevel>("all");
  const [reportId, setReportId] = useState("");
  const [generatedAtIso, setGeneratedAtIso] = useState("");

  useEffect(() => {
    setReportId(createReportId());
    setGeneratedAtIso(new Date().toISOString());

    const saved = sessionStorage.getItem("latestReviewResult");
    if (saved) {
      try {
        setResult(JSON.parse(saved) as ReviewResult);
      } catch {
        setResult(mockResult);
      }
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

  const reportText = useMemo(() => {
    return [
      "购销合同智能审查报告",
      "",
      `报告编号：${reportId || "生成中"}`,
      `生成时间：${generatedAt || "生成中"}`,
      `报告来源：${reportSource}`,
      `审查范围：${reportScope}`,
      `审查配置：${reviewConfig}`,
      "",
      `总体风险：${riskLevelLabel(result.overallRisk)}`,
      `风险统计：高风险 ${result.riskStats.high} 项 / 中风险 ${result.riskStats.medium} 项 / 低风险 ${result.riskStats.low} 项`,
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

  const score = riskScore(result);
  const highPriorityItems = result.riskItems
    .filter((item) => item.riskLevel === "high" || item.riskLevel === "medium")
    .slice(0, 3);
  const filteredItems =
    activeFilter === "all" ? result.riskItems : result.riskItems.filter((item) => item.riskLevel === activeFilter);
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
            <p>{result.summary}</p>
            <div className="meta-list">
              <span className={`badge ${result.overallRisk}`}>{riskLevelLabel(result.overallRisk)}</span>
              {result.isMock ? <span className="badge mock">示例结果模式</span> : <span className="pill strong">工作流返回</span>}
              <span className="pill">报告编号：{reportId || "生成中"}</span>
              <span className="pill">生成时间：{generatedAt}</span>
            </div>
          </div>

          <div className="score-card">
            <span>风险评分</span>
            <strong>{score}</strong>
            <p>{scoreLabel(score)}</p>
          </div>
        </section>

        <section className="report-grid">
          <aside className="side-stack summary-card">
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
                  <strong>{scoreLabel(score)}</strong>
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
                  <p>用于业务流转材料、审批沟通或后续人工复核。</p>
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
              <textarea className="report-box" readOnly value={reportText} />
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
