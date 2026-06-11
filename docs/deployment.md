# Vercel 部署指南

本项目采用 Next.js App Router，前端页面与后端 API Route 在同一个应用中，适合直接部署到 Vercel。

## 部署方式

推荐通过 GitHub 仓库导入 Vercel：

1. 打开 Vercel Dashboard。
2. 选择 `Add New Project`。
3. 导入 GitHub 仓库：`ChenYanjun-hub/contract-review-assistant`。
4. Framework Preset 选择 `Next.js`。
5. Build Command 使用默认值：`npm run build`。
6. Output Directory 保持默认。
7. 配置环境变量。
8. 点击 Deploy。

## 环境变量

在 Vercel Project Settings -> Environment Variables 中配置：

| 变量名 | 是否必填 | 说明 |
| --- | --- | --- |
| `COZE_API_TOKEN` | 是 | Coze API Token，仅服务端读取 |
| `COZE_MAIN_WORKFLOW_ID` | 是 | Coze 主工作流 ID |
| `COZE_API_BASE` | 否 | 默认 `https://api.coze.cn` |
| `COZE_TIMEOUT_MS` | 否 | 默认 `45000` |

如果暂未配置 Token 或 Workflow ID，系统会进入示例结果模式，页面仍可完成完整体验。

## 部署后验证

部署完成后，依次检查：

1. 首页可访问。
2. `/review` 可打开审查工作台。
3. `/api/health` 返回 JSON 状态。
4. 如果环境变量已配置，审查页右侧显示工作流已连接。
5. 点击“生成审查报告”后能进入结果页。
6. 结果页可复制报告，并可下载 `.md` / `.txt` 报告。

## 常见问题

### 环境变量配置后仍显示示例结果模式

检查变量是否配置到了当前部署环境，例如 Production / Preview / Development。修改环境变量后需要重新部署。

### Coze 调用失败

优先检查：

- `COZE_API_TOKEN` 是否有效。
- `COZE_MAIN_WORKFLOW_ID` 是否正确。
- Coze 工作流是否支持后端传入的参数：`company_name`、`review_stance`、`review_mode`、`hetong`、`other_standard`。
- Coze 输出是否能被 `normalizeResult` 解析。

### Token 是否会暴露给浏览器

不会。`COZE_API_TOKEN` 只在 `app/api/review/route.ts` 的服务端运行时读取，前端页面不会接触该变量。
