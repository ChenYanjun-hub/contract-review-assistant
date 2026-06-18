"use client";

import { useEffect, useRef, useState } from "react";
import type {
  HealthStatus,
  ReviewExceptionKind,
  ReviewMode,
  ReviewResult,
  ReviewStance
} from "@/lib/types";

const sampleContract = `购销合同

甲方（买方）：上海星河科技有限公司
乙方（卖方）：杭州云帆设备有限公司

一、产品名称及数量：乙方向甲方供应智能检测设备 10 台，具体型号按双方确认执行。
二、质量标准：产品质量按双方约定执行。
三、交付：乙方应于合同签订后 30 日内将货物交付至甲方指定地点。
四、验收：甲方收到货物后进行验收。
五、付款：甲方在收到发票后 15 个工作日内支付 80% 货款，余款于验收后支付。
六、违约责任：违约方应赔偿守约方损失。
七、争议解决：双方协商不成的，提交甲方所在地人民法院诉讼解决。`;

export default function ReviewPage() {
  const contractInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [companyName, setCompanyName] = useState("上海星河科技有限公司");
  const [reviewStance, setReviewStance] = useState<ReviewStance>("buyer");
  const [reviewMode, setReviewMode] = useState<ReviewMode>("quick");
  const [contractText, setContractText] = useState(sampleContract);
  const [error, setError] = useState("");
  const [exceptionKind, setExceptionKind] = useState<ReviewExceptionKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [progressStep, setProgressStep] = useState(0);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const contractChars = contractText.trim().length;
  const estimatedClauses = contractText.split(/\n+/).filter((line) => line.trim()).length;
  const isReady = Boolean(companyName.trim() && contractText.trim());
  const reviewModeLabel = reviewMode === "quick" ? "快速审查" : "精细审查";
  const reviewStanceLabel = reviewStance === "buyer" ? "买方立场" : "卖方立场";

  useEffect(() => {
    let ignore = false;
    fetch("/api/health")
      .then((response) => response.json())
      .then((data: HealthStatus) => {
        if (!ignore) {
          setHealth(data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setHealth(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  function classifyException(message: string): ReviewExceptionKind {
    if (message.includes("当前支持上传") || message.includes("更换文件")) {
      return "unsupported_format";
    }
    if (
      message.includes("未能从文件中识别") ||
      message.includes("文件解析失败") ||
      message.includes("文件未损坏")
    ) {
      return "file_parse_failed";
    }
    if (
      message.includes("请填写") ||
      message.includes("请上传") ||
      message.includes("请粘贴") ||
      message.includes("不能为空")
    ) {
      return "missing_input";
    }
    return "workflow_failed";
  }

  function setException(message: string) {
    setError(message);
    setExceptionKind(classifyException(message));
  }

  function clearException() {
    setError("");
    setExceptionKind(null);
  }

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setUploading(true);
    clearException();

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { fileName?: string; text?: string; error?: string };

      if (!response.ok || !data.text) {
        throw new Error(data.error || "文件解析失败，请重试。");
      }

      setContractText(data.text);
      setSelectedFile(file);
      setUploadedFileName(data.fileName || file.name);
    } catch (err) {
      setException(err instanceof Error ? err.message : "文件解析失败，请重试。");
    } finally {
      setUploading(false);
    }
  }

  async function submitReview() {
    clearException();
    if (!companyName.trim()) {
      setException("请填写我方公司名称。");
      return;
    }
    if (!contractText.trim()) {
      setException("请粘贴合同内容，或上传 txt/docx 合同文件。");
      return;
    }

    setLoading(true);
    sessionStorage.removeItem("latestReviewResult");
    sessionStorage.removeItem("latestReviewIssue");
    setProgressStep(1);
    const progressTimer = window.setInterval(() => {
      setProgressStep((step) => Math.min(step + 1, 3));
    }, 650);

    try {
      const formData = new FormData();
      formData.append("companyName", companyName);
      formData.append("reviewStance", reviewStance);
      formData.append("reviewMode", reviewMode);
      formData.append("contractText", contractText);
      if (selectedFile) {
        formData.append("file", selectedFile, selectedFile.name);
      }

      const response = await fetch("/api/review-file", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { result?: ReviewResult; error?: string };
      if (!response.ok || !data.result) {
        throw new Error(data.error || "审查失败");
      }
      setProgressStep(3);
      sessionStorage.setItem("latestReviewResult", JSON.stringify(data.result));
      sessionStorage.removeItem("latestReviewIssue");
      window.location.href = "/result";
    } catch (err) {
      const message = err instanceof Error ? err.message : "审查失败，请稍后重试。";
      sessionStorage.removeItem("latestReviewResult");
      sessionStorage.setItem("latestReviewIssue", message);
      setException(message);
    } finally {
      window.clearInterval(progressTimer);
      setLoading(false);
    }
  }

  function loadSampleContract() {
    setContractText(sampleContract);
    setCompanyName("上海星河科技有限公司");
    setReviewStance("buyer");
    setReviewMode("quick");
    setSelectedFile(null);
    setUploadedFileName("");
    clearException();
  }

  function clearContract() {
    setContractText("");
    setSelectedFile(null);
    setUploadedFileName("");
    clearException();
  }

  const exceptionMetaMap: Record<
    Exclude<ReviewExceptionKind, "result_missing" | "result_invalid">,
    { title: string; description: string; tips: string[] }
  > = {
    unsupported_format: {
      title: "当前文件格式暂不支持",
      description: "请将合同转换为可复制文本版本后重新上传，或直接粘贴合同正文继续审查。",
      tips: ["当前支持 `.txt` 与 `.docx` 文件。", "扫描件、图片合同和复杂 PDF 建议先转成可读文本。"]
    },
    file_parse_failed: {
      title: "合同内容解析失败",
      description: "系统未能从上传文件中提取出稳定可审查的文本内容，建议重新上传或直接粘贴正文。",
      tips: ["请确认文件未损坏。", "若为扫描件或图片合同，请先进行 OCR 识别。"]
    },
    missing_input: {
      title: "审查材料尚未补全",
      description: "在发起审查前，需要补全必要输入项。请检查公司名称、合同正文或上传文件是否已准备完成。",
      tips: ["公司名称为必填项。", "合同正文与上传文件二选一即可。"]
    },
    workflow_failed: {
      title: "审查任务暂未成功返回",
      description: "系统在调用智能审查工作流时未拿到稳定结果。可以稍后重试，或先使用示例合同继续演示流程。",
      tips: ["检查网络与服务端配置是否正常。", "建议保留当前输入内容后重新发起审查。"]
    }
  };

  const exceptionMeta =
    exceptionKind && exceptionKind in exceptionMetaMap
      ? exceptionMetaMap[exceptionKind as keyof typeof exceptionMetaMap]
      : null;

  const progressItems = [
    "校验合同与审查参数",
    health?.mode === "coze-ready" ? "上传合同并调用智能审查工作流" : "启用示例审查结果",
    "标准化风险清单并生成报告"
  ];

  const scopeItems = [
    "主体资格与签约授权",
    "标的、质量与验收",
    "交付与风险转移",
    "付款条件与发票",
    "违约责任与解除",
    "争议解决与通知送达"
  ];

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
            <a href="/result">报告样例</a>
          </nav>
        </header>

        <section className="workspace-hero">
          <div>
            <div className="eyebrow">Review Workspace</div>
            <h1>合同审查工作台</h1>
            <p>上传或粘贴购销合同，选择我方立场和审查深度，系统将生成结构化风险清单与专业审查报告。</p>
          </div>
          <div className="workspace-status">
            <span className={`badge ${health?.mode === "coze-ready" ? "low" : "mock"}`}>
              {health?.mode === "coze-ready" ? "智能审查已连接" : "示例模式"}
            </span>
            <strong>{isReady ? "可开始审查" : "等待合同信息"}</strong>
            <p>{reviewStanceLabel} · {reviewModeLabel}</p>
          </div>
        </section>

        <section className="workbench-layout">
          <div className="panel flush">
            <div className="editor-meta">
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  Contract Input
                </div>
                <h2 style={{ margin: 0 }}>合同材料</h2>
              </div>
              <div className="meta-list">
                <span className="pill strong">{contractChars} 字</span>
                <span className="pill">{estimatedClauses} 行内容</span>
                <span className="pill">文本 / txt / docx</span>
              </div>
            </div>

            <div className="field">
              <div className="editor-meta" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="meta-list">
                  <button className="button" type="button" onClick={loadSampleContract}>
                    使用示例合同
                  </button>
                  <button className="button" type="button" onClick={clearContract}>
                    清空合同
                  </button>
                </div>
                <span className="hint">支持直接粘贴合同文本，也可上传 txt 或 docx 文件。</span>
              </div>
              <textarea
                className="contract-editor"
                id="contractText"
                ref={contractInputRef}
                value={contractText}
                onChange={(event) => {
                  setContractText(event.target.value);
                  setSelectedFile(null);
                  setUploadedFileName("");
                  if (exceptionKind === "missing_input" || exceptionKind === "file_parse_failed") {
                    clearException();
                  }
                }}
                placeholder="请粘贴购销合同正文"
              />
              <div className="upload-line">
                <label htmlFor="contractFile">上传合同文本</label>
                <input
                  id="contractFile"
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={uploading || loading}
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <span className="hint">
                  {uploading
                    ? "正在解析文件..."
                    : uploadedFileName
                      ? `已载入：${uploadedFileName}`
                      : "建议上传可复制文本版本；扫描件、图片合同和复杂 PDF 应先转为可读文本。"}
                </span>
              </div>
            </div>
          </div>

          <aside className="side-stack">
            <div className={`panel ${loading ? "loading-bar" : ""}`}>
              <div className="panel-title">
                <div>
                  <h2>审查策略</h2>
                  <p>决定系统识别风险时采用的业务立场和审查深度。</p>
                </div>
                <span className="pill strong">{uploading ? "解析中" : loading ? "审查中" : isReady ? "已就绪" : "待补全"}</span>
              </div>

              <div className="field">
                <label htmlFor="companyName">我方公司名称</label>
                <input
                  id="companyName"
                  value={companyName}
                  onChange={(event) => {
                    setCompanyName(event.target.value);
                    if (exceptionKind === "missing_input") {
                      clearException();
                    }
                  }}
                  placeholder="例如：上海星河科技有限公司"
                />
              </div>

              <div className="field">
                <label>审查立场</label>
                <div className="segmented">
                  <label>
                    <input
                      type="radio"
                      checked={reviewStance === "buyer"}
                      onChange={() => setReviewStance("buyer")}
                    />
                    买方
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={reviewStance === "seller"}
                      onChange={() => setReviewStance("seller")}
                    />
                    卖方
                  </label>
                </div>
                <span className="hint">买方更关注质量、交付、验收和卖方违约；卖方更关注付款、验收期限与责任边界。</span>
              </div>

              <div className="field">
                <label>审查模式</label>
                <div className="segmented">
                  <label>
                    <input type="radio" checked={reviewMode === "quick"} onChange={() => setReviewMode("quick")} />
                    快速审查
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={reviewMode === "detailed"}
                      onChange={() => setReviewMode("detailed")}
                    />
                    精细审查
                  </label>
                </div>
              </div>

              {exceptionMeta ? (
                <div className={`exception-panel ${exceptionKind === "workflow_failed" ? "warning" : "danger"}`}>
                  <div className="exception-panel-head">
                    <strong>{exceptionMeta.title}</strong>
                    <span className="pill">{exceptionKind === "workflow_failed" ? "待重试" : "待处理"}</span>
                  </div>
                  <p>{exceptionMeta.description}</p>
                  <ul className="exception-list">
                    {exceptionMeta.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                  <div className="exception-actions">
                    {exceptionKind === "unsupported_format" || exceptionKind === "file_parse_failed" ? (
                      <>
                        <button
                          className="button"
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          重新上传文件
                        </button>
                        <button
                          className="button"
                          type="button"
                          onClick={() => contractInputRef.current?.focus()}
                        >
                          改为粘贴正文
                        </button>
                      </>
                    ) : null}
                    {exceptionKind === "missing_input" ? (
                      <>
                        <button
                          className="button"
                          type="button"
                          onClick={() => contractInputRef.current?.focus()}
                        >
                          补全审查材料
                        </button>
                        <button className="button" type="button" onClick={loadSampleContract}>
                          使用示例合同
                        </button>
                      </>
                    ) : null}
                    {exceptionKind === "workflow_failed" ? (
                      <>
                        <button className="button primary" type="button" onClick={submitReview}>
                          重新发起审查
                        </button>
                        <button className="button" type="button" onClick={loadSampleContract}>
                          继续演示流程
                        </button>
                      </>
                    ) : null}
                  </div>
                  <p className="error">{error}</p>
                </div>
              ) : null}
              <button className="button primary" disabled={loading || uploading} onClick={submitReview} type="button">
                {uploading ? "正在解析文件..." : loading ? "正在审查..." : "生成审查报告"}
              </button>

              {loading ? (
                <div className="status-card" style={{ marginTop: 14 }}>
                  <h3>审查进度</h3>
                  <ul className="check-list">
                    {progressItems.map((item, index) => (
                      <li key={item} className={progressStep >= index + 1 ? "active" : "pending"}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="status-card">
              <h3>系统连接</h3>
              <div className="meta-list" style={{ marginBottom: 12 }}>
                <span className={`badge ${health?.mode === "coze-ready" ? "low" : "mock"}`}>
                  {health?.mode === "coze-ready" ? "工作流已连接" : "示例结果模式"}
                </span>
                <span className="pill">Workflow: {health?.workflowIdPreview || "检查中"}</span>
              </div>
              <ul className="check-list">
                <li>服务端 Token：{health?.cozeTokenConfigured ? "已配置" : "未配置，当前走示例结果"}</li>
                <li>Workflow ID：{health?.workflowIdConfigured ? "已配置" : "未配置"}</li>
                <li>API Base：{health?.apiBase || "检查中"}</li>
              </ul>
            </div>

            <div className="status-card">
              <h3>审查覆盖范围</h3>
              <div className="scope-grid">
                {scopeItems.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>

            <div className="status-card">
              <h3>输出内容</h3>
              <ul className="check-list">
                <li>总体风险等级与风险评分</li>
                <li>关键风险发现与合同原文依据</li>
                <li>逐项修改建议与可复制审查报告</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
