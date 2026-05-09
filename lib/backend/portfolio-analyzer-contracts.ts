import { z } from "zod";

export const PORTFOLIO_ANALYZER_VERSION = "0.1";

export const PORTFOLIO_ANALYZER_DISCLAIMER = {
  zh: "仅用于研究学习，不构成投资建议。",
  en: "For research and educational purposes only. Not investment advice."
} as const;

const currencySchema = z.enum(["CAD", "USD"]);

export const analyzerSecurityIdentitySchema = z.object({
  securityId: z.string().trim().min(1).max(80).nullable().optional(),
  symbol: z.string().trim().min(1).max(32),
  exchange: z.string().trim().min(1).max(64).nullable().optional(),
  currency: currencySchema.nullable().optional(),
  name: z.string().trim().min(1).max(160).nullable().optional(),
  provider: z.string().trim().min(1).max(64).nullable().optional(),
  securityType: z.string().trim().min(1).max(64).nullable().optional()
});

export const portfolioAnalyzerRequestSchema = z.object({
  scope: z.enum(["security", "portfolio", "account", "recommendation-run"]),
  mode: z.enum(["quick", "full"]).default("quick"),
  security: analyzerSecurityIdentitySchema.optional(),
  holdingId: z.string().trim().min(1).max(80).optional(),
  accountId: z.string().trim().min(1).max(80).optional(),
  recommendationRunId: z.string().trim().min(1).max(80).optional(),
  cacheStrategy: z.enum(["prefer-cache", "refresh"]).default("prefer-cache"),
  maxCacheAgeSeconds: z.number().int().min(60).max(86400).default(900),
  includeExternalResearch: z.boolean().default(false)
}).superRefine((value, context) => {
  if (value.scope === "security" && !value.security && !value.holdingId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["security"],
      message: "Security analysis requires a resolved security identity or holding id."
    });
  }

  if (value.scope === "account" && !value.accountId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["accountId"],
      message: "Account analysis requires an account id."
    });
  }

  if (value.scope === "recommendation-run" && !value.recommendationRunId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recommendationRunId"],
      message: "Recommendation-run analysis requires a recommendation run id."
    });
  }
});

export const portfolioAnalyzerGptEnhancementRequestSchema = portfolioAnalyzerRequestSchema.extend({
  forceFreshBaseAnalysis: z.boolean().default(false),
  forceFreshEnhancement: z.boolean().default(false),
  readCacheOnly: z.boolean().default(false)
});

export const portfolioAnalyzerGptEnhancementSchema = z.object({
  generatedAt: z.string().datetime(),
  title: z.string().trim().min(1).max(120),
  role: z.literal("explanation-only").default("explanation-only"),
  directAnswer: z.string().trim().min(1).max(800),
  reasoning: z.array(z.string().trim().min(1).max(500)).max(6).default([]),
  decisionGates: z.array(z.string().trim().min(1).max(500)).max(6).default([]),
  boundary: z.string().trim().min(1).max(700).nullable().default(null),
  nextStep: z.string().trim().min(1).max(500).nullable().default(null),
  sourceLabel: z.string().trim().min(1).max(120),
  authorityBoundary: z.string().trim().min(1).max(300).default("GPT 只增强解释，不改变智能快扫结论、护栏或行动优先级。"),
  disclaimer: z.object({
    zh: z.string().trim().min(1),
    en: z.string().trim().min(1)
  })
}).superRefine((value, context) => {
  if (!value.disclaimer.zh.includes("不构成投资建议")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["disclaimer", "zh"],
      message: "Chinese disclaimer must state that this is not investment advice."
    });
  }

  if (!value.disclaimer.en.toLowerCase().includes("not investment advice")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["disclaimer", "en"],
      message: "English disclaimer must state that this is not investment advice."
    });
  }
});

const severitySchema = z.enum(["info", "low", "medium", "high"]);
const guardrailCategorySchema = z.enum([
  "identity",
  "freshness",
  "duplicate-exposure",
  "preference-conflict",
  "tax-account-mismatch",
  "liquidity",
  "account-fit",
  "market-data",
  "portfolio-fit"
]);
const securityGuardrailSchema = z.object({
  id: z.string().trim().min(1).max(120),
  category: guardrailCategorySchema,
  severity: severitySchema,
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(800),
  blocking: z.boolean(),
  source: z.string().trim().min(1).max(120).nullable().optional()
});
const securityPortfolioFitSchema = z.object({
  score: z.number().min(0).max(100),
  targetGapPct: z.number(),
  currentSleevePct: z.number().min(0),
  targetPct: z.number().min(0),
  heldWeightPct: z.number().min(0),
  duplicateExposurePct: z.number().min(0),
  accountFitScore: z.number().min(0).max(100),
  taxFitScore: z.number().min(0).max(100),
  fxFitScore: z.number().min(0).max(100),
  liquidityFitScore: z.number().min(0).max(100),
  summary: z.string().trim().min(1).max(800),
  strengths: z.array(z.string().trim().min(1).max(500)).max(6).default([]),
  concerns: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  accountNotes: z.array(z.string().trim().min(1).max(500)).max(6).default([])
});
const analyzerPrimaryActionSchema = z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  label: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(800)
});
const analyzerEvidenceItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
  sourceType: z.enum(["portfolio-data", "quote-cache", "market-data", "news", "forum", "institutional", "manual", "derived"]),
  sourceMode: z.enum(["local", "cached-external", "live-external", "derived"]),
  confidence: z.enum(["low", "medium", "high"]),
  freshness: z.enum(["fresh", "stale", "partial", "missing"]),
  asOf: z.string().datetime().nullable().optional(),
  detail: z.string().trim().min(1).max(800)
});

const securityResearchGuardrailSchema = z.object({
  id: z.string().trim().min(1).max(120),
  severity: z.enum(["info", "warning", "blocker"]),
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(800)
});

export const securityResearchDecisionSchema = z.object({
  version: z.literal("security-research-v1"),
  generatedAt: z.string().datetime(),
  security: z.object({
    securityId: z.string().trim().min(1).max(80).nullable().optional(),
    symbol: z.string().trim().min(1).max(32),
    exchange: z.string().trim().min(1).max(64).nullable().optional(),
    currency: currencySchema.nullable().optional(),
    name: z.string().trim().min(1).max(160).nullable().optional(),
    assetType: z.enum(["stock", "etf", "fund", "cash", "other"]),
    identityStatus: z.enum(["resolved", "ambiguous", "missing"])
  }),
  decision: z.object({
    label: z.enum(["适合继续研究", "继续持有观察", "保持观察", "暂不适合", "需要补充数据"]),
    confidenceScore: z.number().min(0).max(100),
    primaryReason: z.string().trim().min(1).max(500),
    vetoedBy: z
      .array(z.enum(["identity", "freshness", "portfolio_fit", "account_tax", "liquidity"]))
      .max(8)
      .default([])
  }),
  guardrails: z.array(securityResearchGuardrailSchema).max(16).default([]),
  portfolioFit: z.object({
    score: z.number().min(0).max(100),
    sleeve: z.string().trim().min(1).max(120),
    targetGapLabel: z.string().trim().min(1).max(160),
    currentExposureLabel: z.string().trim().min(1).max(160),
    duplicateExposureLabel: z.string().trim().min(1).max(160).nullable().optional(),
    accountTaxFitLabel: z.string().trim().min(1).max(160).nullable().optional(),
    liquidityFitLabel: z.string().trim().min(1).max(160).nullable().optional()
  }),
  valuationEvidence: z.object({
    method: z.enum([
      "multiples_evidence",
      "analyst_consensus",
      "dcf_reference",
      "etf_macro_proxy",
      "unavailable"
    ]),
    confidence: z.enum(["low", "medium", "high"]),
    summary: z.string().trim().min(1).max(700),
    anchors: z.array(z.object({
      label: z.string().trim().min(1).max(120),
      value: z.string().trim().min(1).max(160),
      source: z.string().trim().min(1).max(160),
      asOf: z.string().trim().min(1).max(80).nullable().optional()
    })).max(8).default([]),
    sanityChecks: z.array(z.object({
      label: z.string().trim().min(1).max(120),
      status: z.enum(["pass", "watch", "fail", "unavailable"]),
      detail: z.string().trim().min(1).max(500)
    })).max(8).default([])
  }),
  entryTiming: z.object({
    posture: z.enum(["consider_now", "wait_for_pullback", "wait_for_confirmation", "not_applicable"]),
    keyLevels: z.array(z.object({
      label: z.string().trim().min(1).max(120),
      value: z.string().trim().min(1).max(160),
      type: z.enum(["MA200", "52W_HIGH", "52W_LOW", "RECENT_HIGH", "RECENT_LOW", "VALUATION_ANCHOR"]),
      source: z.string().trim().min(1).max(160)
    })).max(10).default([]),
    marketPulseLabel: z.string().trim().min(1).max(160).nullable().optional()
  }),
  actionPlans: z.array(z.object({
    type: z.enum(["watch_only", "dca_accumulate", "value_pullback", "breakout_confirmed", "avoid"]),
    title: z.string().trim().min(1).max(160),
    detail: z.string().trim().min(1).max(800),
    isBlockedByPortfolioFit: z.boolean(),
    requiredConfirmations: z.array(z.string().trim().min(1).max(200)).max(8).default([])
  })).max(8).default([]),
  evidence: z.array(z.object({
    source: z.string().trim().min(1).max(160),
    sourceType: z.enum(["quote", "history", "fundamental", "macro", "portfolio", "preference", "external_research"]),
    freshnessLabel: z.string().trim().min(1).max(160),
    reliabilityLabel: z.string().trim().min(1).max(160)
  })).max(12).default([])
});

export const portfolioAnalyzerResultSchema = z.object({
  version: z.literal(PORTFOLIO_ANALYZER_VERSION),
  scope: z.enum(["security", "portfolio", "account", "recommendation-run"]),
  mode: z.enum(["quick", "full"]),
  generatedAt: z.string().datetime(),
  identity: analyzerSecurityIdentitySchema.optional(),
  dataFreshness: z.object({
    portfolioAsOf: z.string().datetime(),
    quotesAsOf: z.string().datetime().nullable(),
    externalResearchAsOf: z.string().datetime().nullable(),
    sourceMode: z.enum(["local", "cached-external", "live-external"]),
    freshnessLabel: z.string().trim().min(1).max(160).optional(),
    reliabilityScore: z.number().min(0).max(100).optional(),
    limitationSummary: z.string().trim().min(1).max(700).optional(),
    quoteSourceSummary: z.string().trim().min(1).max(240).nullable().optional(),
    quoteFreshnessSummary: z
      .string()
      .trim()
      .min(1)
      .max(240)
      .nullable()
      .optional(),
    priceHistoryPointCount: z.number().int().min(0).optional(),
    fallbackPointCount: z.number().int().min(0).optional()
  }),
  evidenceTrail: z.array(analyzerEvidenceItemSchema).max(12).default([]).optional(),
  summary: z.object({
    title: z.string().trim().min(1).max(120),
    thesis: z.string().trim().min(1).max(800),
    confidence: z.enum(["low", "medium", "high"])
  }),
  securityDecision: z.object({
    lens: z.enum(["existing-holding-review", "candidate-new-buy", "watchlist-review"]),
    verdict: z.enum(["good-candidate", "watch-only", "weak-fit", "review-existing", "needs-more-data"]),
    decisionLabel: z.string().trim().min(1).max(120).optional(),
    confidenceScore: z.number().min(0).max(100).optional(),
    directAnswer: z.string().trim().min(1).max(800),
    primaryAction: analyzerPrimaryActionSchema.optional(),
    whyNow: z.array(z.string().trim().min(1).max(500)).max(6).default([]),
    portfolioFit: z.array(z.string().trim().min(1).max(500)).max(6).default([]),
    keyBlockers: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
    guardrails: z.array(securityGuardrailSchema).max(12).default([]),
    fit: securityPortfolioFitSchema.optional(),
    decisionGates: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
    nextSteps: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
    boundary: z.string().trim().min(1).max(700).nullable().optional(),
    positionSizingIdea: z.string().trim().min(1).max(500).nullable().optional(),
    watchlistTriggers: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
    evidence: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  }).optional(),
  securityResearchDecision: securityResearchDecisionSchema.optional(),
  scorecards: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    score: z.number().min(0).max(100),
    rationale: z.string().trim().min(1).max(600)
  })).max(12),
  risks: z.array(z.object({
    severity: severitySchema,
    title: z.string().trim().min(1).max(160),
    detail: z.string().trim().min(1).max(800),
    relatedIdentity: analyzerSecurityIdentitySchema.optional()
  })).max(20),
  taxNotes: z.array(z.string().trim().min(1).max(500)).max(12),
  portfolioFit: z.array(z.string().trim().min(1).max(500)).max(12),
  actionItems: z.array(z.object({
    priority: z.enum(["P0", "P1", "P2"]),
    title: z.string().trim().min(1).max(160),
    detail: z.string().trim().min(1).max(800)
  })).max(12),
  sources: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    url: z.string().url().optional(),
    date: z.string().trim().min(1).max(40).optional(),
    sourceType: z.enum(["portfolio-data", "quote-cache", "market-data", "news", "forum", "institutional", "manual"])
  })).max(30),
  disclaimer: z.object({
    zh: z.string().trim().min(1),
    en: z.string().trim().min(1)
  })
}).superRefine((value, context) => {
  if (!value.disclaimer.zh.includes("不构成投资建议")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["disclaimer", "zh"],
      message: "Chinese disclaimer must state that this is not investment advice."
    });
  }

  if (!value.disclaimer.en.toLowerCase().includes("not investment advice")) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["disclaimer", "en"],
      message: "English disclaimer must state that this is not investment advice."
    });
  }

  if (value.dataFreshness.sourceMode === "local" && value.dataFreshness.externalResearchAsOf !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dataFreshness", "externalResearchAsOf"],
      message: "Local analysis cannot claim external research freshness."
    });
  }
});

export type AnalyzerSecurityIdentity = z.infer<typeof analyzerSecurityIdentitySchema>;
export type SecurityResearchDecision = z.infer<typeof securityResearchDecisionSchema>;
export type PortfolioAnalyzerRequest = z.infer<typeof portfolioAnalyzerRequestSchema>;
export type PortfolioAnalyzerGptEnhancementRequest = z.infer<typeof portfolioAnalyzerGptEnhancementRequestSchema>;
export type PortfolioAnalyzerResult = z.infer<typeof portfolioAnalyzerResultSchema>;
export type PortfolioAnalyzerGptEnhancement = z.infer<typeof portfolioAnalyzerGptEnhancementSchema>;
