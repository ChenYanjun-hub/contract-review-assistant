export type ReviewStance = "buyer" | "seller";
export type ReviewMode = "quick" | "detailed";
export type RiskLevel = "high" | "medium" | "low";

export type ReviewRequest = {
  companyName: string;
  reviewStance: ReviewStance;
  reviewMode: ReviewMode;
  contractText: string;
  otherStandard?: string;
};

export type RiskItem = {
  id: string;
  checkPoint: string;
  riskLevel: RiskLevel;
  contractText: string;
  reason: string;
  suggestion: string;
  confidence: number;
};

export type ReviewResult = {
  overallRisk: RiskLevel;
  summary: string;
  riskStats: {
    high: number;
    medium: number;
    low: number;
  };
  riskItems: RiskItem[];
  finalAdvice: string;
  reportText?: string;
  isMock?: boolean;
  source?: "coze" | "mock";
  rawText?: string;
};

export type HealthStatus = {
  mode: "mock" | "coze-ready";
  cozeTokenConfigured: boolean;
  workflowIdConfigured: boolean;
  apiBase: string;
  workflowIdPreview: string;
  checkedAt: string;
};
