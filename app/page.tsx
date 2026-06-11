import Link from "next/link";

const workflowSteps = [
  {
    number: "01",
    title: "提交合同材料",
    description: "粘贴合同文本或上传 txt/docx 文件，填写我方公司名称，选择买方或卖方立场。",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 32 32">
        <path d="M10 4.5h8.5L24 10v17.5H10z" />
        <path d="M18.5 4.5V10H24" />
        <path d="M13.5 15h7" />
        <path d="M13.5 19h7" />
        <path d="M13.5 23h4.5" />
        <path d="M7 8.5v19h13" />
      </svg>
    )
  },
  {
    number: "02",
    title: "智能识别风险",
    description: "根据购销合同审查规则识别条款缺失、表述不清、责任不对等和履约争议风险。",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 32 32">
        <path d="M16 5.5l9 4v6.5c0 5.7-3.7 9.6-9 11-5.3-1.4-9-5.3-9-11V9.5z" />
        <path d="M16 12v5" />
        <path d="M16 21h.01" />
        <path d="M11.5 16.5l2.5 2.5 6.5-7" />
      </svg>
    )
  },
  {
    number: "03",
    title: "生成审查报告",
    description: "输出风险评分、关键发现、结构化风险清单和可复制的专业报告正文。",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 32 32">
        <path d="M8 5h16v22H8z" />
        <path d="M12 10h8" />
        <path d="M12 15h8" />
        <path d="M12 20h5" />
        <path d="M21 22l2 2 4-5" />
      </svg>
    )
  }
];

export default function HomePage() {
  return (
    <main className="shell">
      <div className="page">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">审</span>
            购销合同法务审查助手
          </div>
          <nav className="nav">
            <a href="#painpoints">客户痛点</a>
            <a href="#advantages">产品优势</a>
            <a href="#workflow">审查流程</a>
            <Link href="/review">开始审查</Link>
            <Link href="/result">示例结果</Link>
          </nav>
        </header>

        <section className="home-hero">
          <div className="hero-copy">
            <div className="eyebrow">AI Contract Review Platform</div>
            <h1>面向业务一线的购销合同智能审查平台。</h1>
            <p>
              将合同上传、条款识别、风险判断、修改建议和报告生成整合为一个连续工作流，帮助法务、采购和销售团队更快发现签约风险，统一审查标准，沉淀可复用的合同风险知识。
            </p>
            <div className="actions">
              <Link className="button primary" href="/review">
                立即体验审查
              </Link>
              <Link className="button" href="/result">
                查看专业报告
              </Link>
            </div>
            <div className="trust-strip">
              <span>主体与授权</span>
              <span>质量与验收</span>
              <span>交付与风险转移</span>
              <span>违约与争议解决</span>
            </div>
          </div>

          <aside className="hero-product-card">
            <div className="product-window">
              <div className="window-bar">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="product-report">
                <div className="report-line strong"></div>
                <div className="report-line"></div>
                <div className="risk-preview high">
                  <strong>高风险</strong>
                  <span>质量标准过于笼统，建议补充检测标准和不合格处理机制。</span>
                </div>
                <div className="risk-preview medium">
                  <strong>中风险</strong>
                  <span>验收期限未明确，可能导致质量异议争议。</span>
                </div>
                <div className="risk-preview low">
                  <strong>低风险</strong>
                  <span>违约责任已有约定，但建议细化计算方式。</span>
                </div>
              </div>
            </div>
            <div className="hero-metrics">
              <div>
                <strong>5</strong>
                <span>核心风险项</span>
              </div>
              <div>
                <strong>3</strong>
                <span>审查阶段</span>
              </div>
              <div>
                <strong>1</strong>
                <span>标准报告</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="section-block" id="painpoints">
          <div className="section-heading">
            <span className="eyebrow">Customer Problems</span>
            <h2>合同审查真正卡住的，不只是“看得慢”。</h2>
            <p>企业在购销合同流转中常见的问题，是风险识别、审查标准和报告交付无法稳定复制。</p>
          </div>
          <div className="grid">
            <article className="panel problem-card">
              <span>01</span>
              <h3>业务等不及，法务看不完</h3>
              <p>大量标准购销合同需要快速初审，人工逐条阅读成本高，关键风险容易被交易进度挤压。</p>
            </article>
            <article className="panel problem-card">
              <span>02</span>
              <h3>审查标准分散，结论不一致</h3>
              <p>不同人员对质量、交付、验收、违约责任等条款关注点不同，导致审查口径难统一。</p>
            </article>
            <article className="panel problem-card">
              <span>03</span>
              <h3>报告难复用，风险难沉淀</h3>
              <p>审查意见往往停留在聊天或文档批注里，缺少结构化风险项、原文依据和可追踪修改建议。</p>
            </article>
          </div>
        </section>

        <section className="section-block" id="advantages">
          <div className="section-heading">
            <span className="eyebrow">Why It Works</span>
            <h2>从合同文本到专业报告，形成可复制的法务工作流。</h2>
          </div>
          <div className="advantage-layout">
            <article className="panel advantage-main">
              <span className="pill strong">核心能力</span>
              <h3>立场化风险识别</h3>
              <p>
                支持买方和卖方不同审查立场，围绕主体资格、质量标准、交付、验收、付款、违约责任、解除和争议解决等关键条款输出差异化风险判断。
              </p>
              <div className="capability-grid">
                <div>
                  <strong>买方视角</strong>
                  <span>关注卖方资质、质量保障、交付迟延、验收与违约救济。</span>
                </div>
                <div>
                  <strong>卖方视角</strong>
                  <span>关注付款条件、验收期限、责任上限和风险转移节点。</span>
                </div>
              </div>
            </article>
            <div className="side-stack">
              <article className="panel">
                <h3>结构化风险清单</h3>
                <p>每条风险都包含风险等级、审查项、合同原文、风险原因、修改建议和置信度。</p>
              </article>
              <article className="panel">
                <h3>报告级输出</h3>
                <p>自动生成可复制的审查报告，便于业务沟通、审批流转和后续人工复核。</p>
              </article>
              <article className="panel">
                <h3>可接入企业工作流</h3>
                <p>前后端分层封装，敏感 Token 留在服务端，便于对接企业已有智能体或审批系统。</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section-block" id="workflow">
          <div className="section-heading">
            <span className="eyebrow">Review Workflow</span>
            <h2>三步完成一次标准化初审。</h2>
          </div>
          <div className="workflow-row">
            {workflowSteps.map((step) => (
              <article className="workflow-card" key={step.number}>
                <div className="workflow-card-head">
                  <span>{step.number}</span>
                  <div className="workflow-icon">{step.icon}</div>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta-panel">
          <div>
            <span className="eyebrow">Start Reviewing</span>
            <h2>把第一份购销合同交给系统做初审。</h2>
            <p>先获得结构化风险判断，再由法务进行最终确认，让专业审查从重复阅读转向高价值判断。</p>
          </div>
          <div className="actions">
            <Link className="button primary" href="/review">
              进入审查工作台
            </Link>
            <Link className="button" href="/result">
              查看报告样例
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
