import { z } from "zod";
import { PORTFOLIO_ANALYZER_DISCLAIMER } from "@/lib/backend/portfolio-analyzer-contracts";

export const LOO_MINISTER_VERSION = "0.1";

const ministerCurrencySchema = z.enum(["CAD", "USD"]);

export const looMinisterSecurityIdentitySchema = z
  .object({
    securityId: z.string().trim().min(1).max(80).nullable().optional(),
    symbol: z.string().trim().min(1).max(32),
    exchange: z.string().trim().min(1).max(64).nullable().optional(),
    currency: ministerCurrencySchema.nullable().optional(),
    name: z.string().trim().min(1).max(160).nullable().optional(),
    provider: z.string().trim().min(1).max(64).nullable().optional(),
    securityType: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .superRefine((value, context) => {
    const hasExchange = Boolean(value.exchange?.trim());
    const hasCurrency = Boolean(value.currency);
    if (hasExchange !== hasCurrency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasExchange ? ["currency"] : ["exchange"],
        message:
          "Security identity must keep exchange and currency together when either is available.",
      });
    }
  });

export const looMinisterRecentSubjectSchema = looMinisterSecurityIdentitySchema
  .extend({
    source: z.string().trim().min(1).max(80).optional(),
  })
  .transform((value) => ({
    securityId: value.securityId ?? null,
    symbol: value.symbol,
    exchange: value.exchange ?? null,
    currency: value.currency ?? null,
    name: value.name ?? null,
    source: value.source ?? "recent-subject-stack",
  }));

export const looMinisterPageSchema = z.enum([
  "overview",
  "portfolio",
  "account-detail",
  "holding-detail",
  "security-detail",
  "portfolio-health",
  "recommendations",
  "import",
  "settings",
  "spending",
]);

export const looMinisterFactSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(240),
  detail: z.string().trim().min(1).max(600).optional(),
  source: z
    .enum([
      "portfolio-data",
      "quote-cache",
      "fx-cache",
      "user-input",
      "analysis-cache",
      "external-intelligence",
      "system",
    ])
    .default("portfolio-data"),
});

export const looMinisterSuggestedActionSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(140),
    detail: z.string().trim().min(1).max(600).optional(),
    actionType: z.enum([
      "explain",
      "navigate",
      "open-form",
      "create-draft",
      "update-preferences",
      "refresh-data",
      "run-analysis",
    ]),
    target: z
      .object({
        page: looMinisterPageSchema.optional(),
        route: z.string().trim().min(1).max(240).optional(),
        accountId: z.string().trim().min(1).max(80).optional(),
        holdingId: z.string().trim().min(1).max(80).optional(),
        security: looMinisterSecurityIdentitySchema.optional(),
      })
      .default({}),
    requiresConfirmation: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (
      [
        "create-draft",
        "update-preferences",
        "refresh-data",
        "run-analysis",
      ].includes(value.actionType) &&
      !value.requiresConfirmation
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requiresConfirmation"],
        message:
          "Actions that create, update, refresh, or run analysis must require explicit user confirmation.",
      });
    }
  });

export const looMinisterPageContextSchema = z
  .object({
    version: z.literal(LOO_MINISTER_VERSION),
    page: looMinisterPageSchema,
    locale: z.literal("zh").default("zh"),
    title: z.string().trim().min(1).max(160),
    asOf: z.string().datetime(),
    displayCurrency: ministerCurrencySchema.default("CAD"),
    subject: z
      .object({
        accountId: z.string().trim().min(1).max(80).optional(),
        holdingId: z.string().trim().min(1).max(80).optional(),
        recommendationRunId: z.string().trim().min(1).max(80).optional(),
        security: looMinisterSecurityIdentitySchema.optional(),
      })
      .default({}),
    dataFreshness: z
      .object({
        portfolioAsOf: z.string().datetime().nullable().default(null),
        quotesAsOf: z.string().datetime().nullable().default(null),
        fxAsOf: z.string().datetime().nullable().default(null),
        chartFreshness: z
          .enum(["fresh", "stale", "fallback", "reference", "unknown"])
          .default("unknown"),
        sourceMode: z
          .enum(["local", "cached-external", "live-external", "reference"])
          .default("local"),
      })
      .default({
        portfolioAsOf: null,
        quotesAsOf: null,
        fxAsOf: null,
        chartFreshness: "unknown",
        sourceMode: "local",
      }),
    facts: z.array(looMinisterFactSchema).max(40).default([]),
    warnings: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
    allowedActions: z
      .array(looMinisterSuggestedActionSchema)
      .max(12)
      .default([]),
  })
  .superRefine((value, context) => {
    if (value.page === "account-detail" && !value.subject.accountId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject", "accountId"],
        message: "Account detail minister context requires accountId.",
      });
    }

    if (value.page === "holding-detail" && !value.subject.holdingId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject", "holdingId"],
        message: "Holding detail minister context requires holdingId.",
      });
    }

    if (value.page === "security-detail" && !value.subject.security) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subject", "security"],
        message:
          "Security detail minister context requires resolved security identity.",
      });
    }

    if (
      value.dataFreshness.sourceMode === "local" &&
      value.dataFreshness.chartFreshness === "reference"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dataFreshness", "chartFreshness"],
        message: "Reference curves must not be marked as local real data.",
      });
    }
  });

export const looMinisterQuestionRequestSchema = z
  .object({
    pageContext: looMinisterPageContextSchema,
    question: z.string().trim().min(2).max(800),
    recentSubjects: z.array(looMinisterRecentSubjectSchema).max(5).default([]),
    answerStyle: z.enum(["concise", "beginner", "deep"]).default("beginner"),
    cacheStrategy: z.enum(["prefer-cache", "refresh"]).default("prefer-cache"),
    includeExternalResearch: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.includeExternalResearch) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["includeExternalResearch"],
        message:
          "Live external research is not available for Loo Minister answers until worker/cache policy is enabled.",
      });
    }
  });

export const looMinisterChatRequestSchema = looMinisterQuestionRequestSchema.extend({
  answerMode: z.enum(["auto", "local"]).default("auto"),
  sessionId: z.string().trim().min(1).max(80).optional(),
});

export const looMinisterAnswerResultSchema = z
  .object({
    version: z.literal(LOO_MINISTER_VERSION),
    generatedAt: z.string().datetime(),
    role: z.literal("loo-minister"),
    page: looMinisterPageSchema,
    title: z.string().trim().min(1).max(140),
    answer: z.string().trim().min(1).max(2400),
    structured: z
      .object({
        directAnswer: z.string().trim().min(1).max(700),
        reasoning: z.array(z.string().trim().min(1).max(500)).max(6).default([]),
        decisionGates: z.array(z.string().trim().min(1).max(500)).max(6).default([]),
        boundary: z.string().trim().min(1).max(700).nullable().default(null),
        nextStep: z.string().trim().min(1).max(500).nullable().default(null),
      })
      .optional(),
    keyPoints: z.array(z.string().trim().min(1).max(360)).max(8).default([]),
    suggestedActions: z
      .array(looMinisterSuggestedActionSchema)
      .max(8)
      .default([]),
    sources: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(200),
          sourceType: z.enum([
            "page-context",
            "portfolio-data",
            "quote-cache",
            "fx-cache",
            "analysis-cache",
            "external-intelligence",
            "manual",
          ]),
          asOf: z.string().datetime().nullable().default(null),
        }),
      )
      .max(12)
      .default([]),
    disclaimer: z
      .object({
        zh: z.string().trim().min(1),
        en: z.string().trim().min(1),
      })
      .default(PORTFOLIO_ANALYZER_DISCLAIMER),
  })
  .superRefine((value, context) => {
    if (!value.disclaimer.zh.includes("不构成投资建议")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disclaimer", "zh"],
        message:
          "Chinese disclaimer must state that this is not investment advice.",
      });
    }

    if (!value.disclaimer.en.toLowerCase().includes("not investment advice")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disclaimer", "en"],
        message:
          "English disclaimer must state that this is not investment advice.",
      });
    }
  });

export type LooMinisterSecurityIdentity = z.infer<
  typeof looMinisterSecurityIdentitySchema
>;
export type LooMinisterFact = z.infer<typeof looMinisterFactSchema>;
export type LooMinisterPageContext = z.infer<
  typeof looMinisterPageContextSchema
>;
export type LooMinisterQuestionRequest = z.infer<
  typeof looMinisterQuestionRequestSchema
>;
export type LooMinisterQuestionRequestInput = z.input<
  typeof looMinisterQuestionRequestSchema
>;
export type LooMinisterAnswerResult = z.infer<
  typeof looMinisterAnswerResultSchema
>;
export type LooMinisterSuggestedAction = z.infer<
  typeof looMinisterSuggestedActionSchema
>;
