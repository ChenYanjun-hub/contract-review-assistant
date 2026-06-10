# 购销合同法务审查 Web MVP 任务拆解

提交截止：周五 24:00 前。

## 项目边界

- 运行方式：本地前后端联调版。
- 主链路：前端输入合同与审查参数 -> 后端 `/api/review` -> Coze 主工作流 -> 后端标准化结果 -> 前端展示报告。
- 不做：正式上线、备案、后台管理、OCR、自建向量库、人工复核闭环。

## 两人分工

### 队友 A：Coze 法务化改造

- 将原采购/财务视角工作流改成购销合同法务审查。
- 固定入参：`hetong`、`company_name`、`review_stance`、`review_mode`、`other_standard`。
- 固定输出：`overallRisk`、`summary`、`riskStats`、`riskItems`、`finalAdvice`。
- 交付给 B：workflow id、API 输入说明、真实输出样例、mockResult、测试合同、已知问题。
- 最低验收：买方 + 快速审查可以从 API 跑通。

### 你 B：前后端封装

- Next.js 本地项目。
- 审查页：合同文本、公司名称、买方/卖方、快速/精细、其他规则。
- 后端：`/api/review` 调用 Coze，失败返回 mock 兜底。
- 标准化：`normalizeResult` 屏蔽 Coze 原始字段变化。
- 结果页：总体风险、风险统计、风险清单、报告复制、免责声明。
- 文档：README、`.env.local.example`、测试说明、演示脚本。

## 三次对齐

1. 开工前：字段、mockResult、快速/精细映射确认。
2. 中期联调：至少买方快速审查跑通，确认 Coze 返回能被标准化。
3. 最终验收：本地启动、提交合同、生成结果、复制报告、文档齐全。

## 优先级

1. P0：页面闭环 + mock 兜底 + README。
2. P0：真实 Coze 调用参数与环境变量。
3. P1：买方快速审查真实联调。
4. P1：精细审查结果兼容。
5. P2：卖方审查差异化、docx/pdf 文件能力。
