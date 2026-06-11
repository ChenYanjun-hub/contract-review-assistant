# 购销合同法务审查助手

本项目是一个面向购销合同场景的智能法务审查 Web 应用，用 Next.js 封装智能审查工作流，完成合同输入、审查策略配置、风险识别、结果展示、报告复制与下载。

## 功能范围

- 粘贴合同文本或上传 `.txt` / `.docx` 合同。
- 填写我方公司名称。
- 选择审查立场：买方 / 卖方。
- 选择审查模式：快速审查 / 精细审查。
- 后端通过 `/api/review` 调用 Coze 主工作流。
- `/api/health` 检查 Coze Token、Workflow ID 和当前运行模式。
- Coze 调用失败或未配置环境变量时，自动返回法务示例结果，保证演示可用。
- 结果页展示总体风险、风险统计、风险清单、修改建议和可复制报告。

## 技术结构

```text
app/
  page.tsx              产品首页
  review/page.tsx       审查工作台
  result/page.tsx       审查报告页
  api/health/route.ts   接口联调健康检查
  api/review/route.ts   Coze 调用入口
  api/upload/route.ts   txt/docx 文件解析入口
lib/
  coze.ts               Coze Workflow API 封装
  normalizeResult.ts    结果标准化
  mockResult.ts         演示兜底结果
  types.ts              类型定义
data/samples/           示例合同
docs/deployment.md      Vercel 部署指南
docs/development-log.md 开发日志
```

## 本地启动

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

## Vercel 部署

项目支持 Next.js 全栈部署，推荐通过 Vercel 导入 GitHub 仓库：

[Vercel 部署指南](./docs/deployment.md)

## 产品体验流程

1. 打开首页，点击“开始审查”。
2. 在审查页点击“使用示例合同”，或粘贴 / 上传真实合同文本。
3. 确认我方公司名称、审查立场和审查模式。
4. 点击“生成审查报告”。
5. 进入结果页后，查看审查摘要、风险统计、风险清单。
6. 复制报告，或下载 `.md` / `.txt` 报告用于业务流转。

审查页右侧会显示接口联调状态：

- `示例结果模式`：未配置 Token 或 Workflow ID，系统使用示例结果完成体验。
- `工作流已连接`：Token 和 Workflow ID 已配置，可以发起真实工作流调用。

也可以直接访问：

```bash
curl http://127.0.0.1:3000/api/health
```

## 环境变量

复制 `.env.local.example` 为 `.env.local`，填入真实配置：

```bash
COZE_API_TOKEN=your_coze_api_token_here
COZE_MAIN_WORKFLOW_ID=7628612643297919030
COZE_API_BASE=https://api.coze.cn
COZE_TIMEOUT_MS=45000
```

不要提交 `.env.local`，不要把 Coze Token 写入前端代码。

## 工作流联调检查清单

外部工作流配置到位后，优先检查：

- `.env.local` 已填入 `COZE_API_TOKEN`。
- `.env.local` 已填入 `COZE_MAIN_WORKFLOW_ID`，也兼容 `COZE_WORKFLOW_ID`。
- 审查页右侧状态显示 `工作流已连接`。
- 跑通“采购方 + 快速审查”。
- Coze 返回 Markdown 审查结果，后端能解析 `workflowResponse.data` 内层 JSON 并取出 `inner.data`。
- 如果真实调用失败，页面应明确显示示例结果模式，不应白屏。

## Coze 入参约定

前端字段会在后端转换为 Coze 参数：

| 前端字段 | 后端字段 | Coze 参数 | 示例 |
| --- | --- | --- | --- |
| 我方公司名称 | `companyName` | `company_name` | 上海星河科技有限公司 |
| 审查立场 | `reviewStance` | `review_stance` | 采购方 / 销售方 |
| 审查模式 | `reviewMode` | `review_mode` | 快速审查 / 精细审查 |
| 合同文件 | `file` / `contractText` | `hetong` | `{"file_id":"7649778087966179369"}` |

## Coze 输出建议

当前文件版工作流返回 Markdown 审查报告。Coze `/v1/workflow/run` 外层 `data` 是 JSON 字符串，后端会解析后取 `inner.data` 作为报告正文：

```json
{
  "content_type": 1,
  "data": "## 购销合同采购方快速审查结果\\n\\n| 审查项 | 风险等级 | 修改建议 |",
  "original_result": null,
  "type_for_model": 2
}
```

`normalizeResult` 已兼容 Markdown 字符串、部分中文字段和结构化 JSON；如果后续需要更强的风险筛选和统计，建议 Coze 同步输出结构化风险项。

## 当前限制

- 当前本地文件解析支持粘贴文本、`.txt` 和 `.docx`。
- 复杂 PDF、扫描件 OCR 可作为后续增强。
- 卖方审查能否体现差异，取决于 Coze 工作流提示词改造质量。
- AI 内容仅供初步审查辅助，不构成正式法律意见。
