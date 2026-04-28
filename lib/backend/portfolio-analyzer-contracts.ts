import { z } from "zod";

export const PORTFOLIO_ANALYZER_VERSION = "0.1";

export const PORTFOLIO_ANALYZER_DISCLAIMER = {
  zh: "仅用于研究学习，不构成投资建议。",
  en: "For research and educational purposes only. Not investment advice."
} as const;

const currencySchema = z.enum(["CAD", "USD"]);

export const analyzerSecurityIdentitySchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  exchange: z.string().trim().min(1).max(64).nullable().optional(),
  currency: currencySchema.nullable().optional(),
  name: z.string().trim().min(1).max(160).nullable().optional(),
  provider: z.string().trim().min(1).max(64).nullable().optional(),
  securityType: z.string().trim().min(1).max(64).nullable().optional()
});

export const portfolioAnalyzerRequestSchema = z.object({
  scope: z.enum(["security", "portfolio", "recommendation-run"]),
  mode: z.enum(["quick", "full"]).default("quick"),
  security: analyzerSecurityIdentitySchema.optional(),
  holdingId: z.string().trim().min(1).max(80).optional(),
  accountId: z.string().trim().min(1).max(80).optional(),
  recommendationRunId: z.string().trim().min(1).max(80).optional(),
  includeExternalResearch: z.boolean().default(false)
}).superRefine((value, context) => {
  if (value.scope === "security" && !value.security && !value.holdingId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["security"],
      message: "Security analysis requires a resolved security identity or holding id."
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

const severitySchema = z.enum(["info", "low", "medium", "high"]);

export const portfolioAnalyzerResultSchema = z.object({
  version: z.literal(PORTFOLIO_ANALYZER_VERSION),
  scope: z.enum(["security", "portfolio", "recommendation-run"]),
  mode: z.enum(["quick", "full"]),
  generatedAt: z.string().datetime(),
  identity: analyzerSecurityIdentitySchema.optional(),
  dataFreshness: z.object({
    portfolioAsOf: z.string().datetime(),
    quotesAsOf: z.string().datetime().nullable(),
    externalResearchAsOf: z.string().datetime().nullable(),
    sourceMode: z.enum(["local", "cached-external", "live-external"])
  }),
  summary: z.object({
    title: z.string().trim().min(1).max(120),
    thesis: z.string().trim().min(1).max(800),
    confidence: z.enum(["low", "medium", "high"])
  }),
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
export type PortfolioAnalyzerRequest = z.infer<typeof portfolioAnalyzerRequestSchema>;
export type PortfolioAnalyzerResult = z.infer<typeof portfolioAnalyzerResultSchema>;
