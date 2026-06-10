# 购销合同法务审查助手

本项目是一个本地 Web MVP，用 Next.js 封装 Coze 购销合同法务审查工作流。目标是在本地完成合同输入、审查参数配置、Coze 调用、结果展示和报告复制。

## 功能范围

- 粘贴合同文本或上传 `.txt` 合同。
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
  page.tsx              首页
  review/page.tsx       审查表单页
  result/page.tsx       结果展示页
  api/health/route.ts   接口联调健康检查
  api/review/route.ts   Coze 调用入口
  api/upload/route.ts   txt 文件解析入口
lib/
  coze.ts               Coze Workflow API 封装
  normalizeResult.ts    结果标准化
  mockResult.ts         演示兜底结果
  types.ts              类型定义
data/samples/           示例合同
docs/task-breakdown.md  分工和任务拆解
```

## 本地启动

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

## 演示流程

1. 打开首页，点击“开始审查”。
2. 在审查页点击“填入示例合同”，或直接使用默认示例合同。
3. 确认我方公司名称、审查立场和审查模式。
4. 点击“生成审查报告”。
5. 进入结果页后，查看审查摘要、风险统计、风险清单。
6. 点击“复制报告”，将报告正文复制到提交材料或演示文档中。

审查页右侧会显示接口联调状态：

- `Mock 兜底`：未配置 Token 或 Workflow ID，演示走示例结果。
- `Coze 可联调`：Token 和 Workflow ID 已配置，可以发起真实工作流调用。

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

## 联调检查清单

队友 API 到位后，优先检查：

- `.env.local` 已填入 `COZE_API_TOKEN`。
- `.env.local` 已填入 `COZE_MAIN_WORKFLOW_ID`。
- 审查页右侧状态显示 `Coze 可联调`。
- 跑通“买方 + 快速审查”。
- Coze 返回能被 `normalizeResult` 转换成结果页结构。
- 如果真实调用失败，页面应明确显示示例/兜底结果，不应白屏。

## Coze 入参约定

前端字段会在后端转换为 Coze 参数：

| 前端字段 | 后端字段 | Coze 参数 | 示例 |
| --- | --- | --- | --- |
| 我方公司名称 | `companyName` | `company_name` | 上海星河科技有限公司 |
| 审查立场 | `reviewStance` | `review_stance` | 买方 / 卖方 |
| 审查模式 | `reviewMode` | `review_mode` | 快速审查 / 精细审查 |
| 合同文本 | `contractText` | `hetong` | 合同正文 |
| 其他规则 | `otherStandard` | `other_standard` | 可选 |

## Coze 输出建议

建议队友在 Coze 结束节点输出以下 JSON：

```json
{
  "overallRisk": "medium",
  "summary": "合同总体摘要",
  "riskStats": { "high": 1, "medium": 3, "low": 1 },
  "riskItems": [
    {
      "id": "R-001",
      "checkPoint": "质量标准",
      "riskLevel": "high",
      "contractText": "产品质量按双方约定执行。",
      "reason": "质量标准过于笼统。",
      "suggestion": "补充型号、规格、检测标准和不合格处理方式。",
      "confidence": 0.91
    }
  ],
  "finalAdvice": "签署前建议重点修改高风险条款。"
}
```

`normalizeResult` 已兼容部分中文字段和 Coze 字符串化 JSON，但最终展示最稳定的方式仍然是固定输出结构。

## 当前限制

- 当前本地文件解析优先支持 `.txt` 和粘贴文本。
- `docx`、复杂 PDF、扫描件 OCR 暂不作为 MVP 主线。
- 卖方审查能否体现差异，取决于 Coze 工作流提示词改造质量。
- AI 内容仅供初步审查辅助，不构成正式法律意见。
