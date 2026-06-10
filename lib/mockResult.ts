import type { ReviewResult } from "./types";

export const mockResult: ReviewResult = {
  overallRisk: "medium",
  summary:
    "该购销合同具备基本交易框架，但在签约授权、质量标准、交付与风险转移、验收期限、违约责任等关键条款上存在不明确或对我方保护不足的问题，建议在签署前补充细化。",
  riskStats: {
    high: 1,
    medium: 3,
    low: 1
  },
  riskItems: [
    {
      id: "R-001",
      checkPoint: "主体资格与签约授权",
      riskLevel: "medium",
      contractText: "乙方加盖合同专用章后生效。",
      reason:
        "合同未明确签署人员授权文件、营业执照信息或签约权限核验方式，后续可能出现签约主体或授权瑕疵争议。",
      suggestion:
        "补充双方统一社会信用代码、注册地址、法定代表人/授权代表信息，并要求授权代表提供有效授权文件。",
      confidence: 0.82
    },
    {
      id: "R-002",
      checkPoint: "质量标准",
      riskLevel: "high",
      contractText: "产品质量按双方约定执行。",
      reason:
        "质量标准表述过于笼统，缺少型号、规格、检测标准、合格证明和不合格处理方式，买方难以据此主张质量违约。",
      suggestion:
        "写明产品名称、型号、技术参数、国家/行业标准、验收检测方法、质量异议期和退换货责任。",
      confidence: 0.91
    },
    {
      id: "R-003",
      checkPoint: "交付与风险转移",
      riskLevel: "medium",
      contractText: "货物交付至甲方指定地点。",
      reason:
        "合同未明确运输责任、交付完成标准、签收主体以及货损风险何时转移，运输损坏或迟延时责任边界不清。",
      suggestion:
        "补充交付地点、承运安排、运输费用承担、风险转移节点、签收单据和逾期交付责任。",
      confidence: 0.86
    },
    {
      id: "R-004",
      checkPoint: "验收条款",
      riskLevel: "medium",
      contractText: "甲方收到货物后进行验收。",
      reason:
        "未约定明确验收期限、验收标准和逾期未验收的法律后果，容易产生默认验收或质量异议失权争议。",
      suggestion:
        "约定验收期限、书面验收流程、质量异议提出方式，以及隐蔽瑕疵的追责期限。",
      confidence: 0.84
    },
    {
      id: "R-005",
      checkPoint: "违约责任",
      riskLevel: "low",
      contractText: "违约方应赔偿守约方损失。",
      reason:
        "已有一般违约责任，但缺少逾期交付、逾期付款、质量不合格等场景的具体计算方式。",
      suggestion:
        "按主要违约场景分别约定违约金比例、损失赔偿范围和解除权触发条件。",
      confidence: 0.79
    }
  ],
  finalAdvice:
    "建议签署前优先修改质量标准、验收、交付风险转移和违约责任条款；如涉及大额交易，应由法务结合交易背景进行人工复核。",
  isMock: true,
  source: "mock"
};
