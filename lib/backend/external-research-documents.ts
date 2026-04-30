import { z } from "zod";
import type {
  AnalyzerSecurityIdentity,
  PortfolioAnalyzerRequest,
} from "@/lib/backend/portfolio-analyzer-contracts";
import type {
  ExternalResearchProviderInput,
  ExternalResearchProviderResult,
  ExternalResearchProviderSource,
} from "@/lib/backend/portfolio-external-research-providers";

const sourceTypeSchema = z.enum([
  "market-data",
  "news",
  "forum",
  "institutional",
  "manual",
]);

const confidenceSchema = z.enum(["low", "medium", "high"]);
const sentimentSchema = z.enum(["positive", "neutral", "negative", "mixed"]);

export const externalResearchDocumentSchema = z.object({
  id: z.string().trim().min(1).max(120),
  userId: z.string().trim().min(1).max(120).nullable().optional(),
  sourceType: sourceTypeSchema,
  providerId: z.string().trim().min(1).max(64),
  sourceName: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(1200),
  url: z.string().url().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  capturedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  language: z.enum(["zh", "en", "unknown"]).default("unknown"),
  security: z
    .object({
      securityId: z.string().trim().min(1).max(80).nullable().optional(),
      symbol: z.string().trim().min(1).max(32).nullable().optional(),
      exchange: z.string().trim().min(1).max(64).nullable().optional(),
      currency: z.enum(["CAD", "USD"]).nullable().optional(),
      name: z.string().trim().min(1).max(160).nullable().optional(),
      provider: z.string().trim().min(1).max(64).nullable().optional(),
      securityType: z.string().trim().min(1).max(64).nullable().optional(),
    })
    .nullable()
    .optional(),
  underlyingId: z.string().trim().min(1).max(120).nullable().optional(),
  confidence: confidenceSchema,
  sentiment: sentimentSchema,
  relevanceScore: z.number().min(0).max(100),
  sourceReliability: z.number().min(0).max(100),
  keyPoints: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
  riskFlags: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
  tags: z.array(z.string().trim().min(1).max(64)).max(16).default([]),
});

export type ExternalResearchDocument = z.infer<
  typeof externalResearchDocumentSchema
>;

export type RankedExternalResearchDocument = ExternalResearchDocument & {
  isExpired: boolean;
  identityScope: "listing" | "underlying" | "macro" | "unresolved";
  rankingScore: number;
};

function normalizeToken(value: string | null | undefined) {
  return value?.trim().toUpperCase() || null;
}

function readRequestSecurity(
  request: PortfolioAnalyzerRequest,
): AnalyzerSecurityIdentity | null {
  return request.scope === "security" ? request.security ?? null : null;
}

function documentMatchesSecurity(
  document: ExternalResearchDocument,
  security: AnalyzerSecurityIdentity,
) {
  const docSecurity = document.security;
  if (!docSecurity) {
    return false;
  }

  if (security.securityId && docSecurity.securityId) {
    return security.securityId === docSecurity.securityId;
  }

  const requestSymbol = normalizeToken(security.symbol);
  const requestExchange = normalizeToken(security.exchange ?? null);
  const requestCurrency = normalizeToken(security.currency ?? null);
  const documentSymbol = normalizeToken(docSecurity.symbol ?? null);
  const documentExchange = normalizeToken(docSecurity.exchange ?? null);
  const documentCurrency = normalizeToken(docSecurity.currency ?? null);

  return Boolean(
    requestSymbol &&
      requestExchange &&
      requestCurrency &&
      documentSymbol === requestSymbol &&
      documentExchange === requestExchange &&
      documentCurrency === requestCurrency,
  );
}

function getIdentityScope(
  document: ExternalResearchDocument,
  request: PortfolioAnalyzerRequest,
): RankedExternalResearchDocument["identityScope"] {
  const security = readRequestSecurity(request);
  if (!document.security && document.underlyingId) {
    return "underlying";
  }
  if (!document.security) {
    return document.tags.includes("macro") ? "macro" : "unresolved";
  }
  if (security && documentMatchesSecurity(document, security)) {
    return "listing";
  }
  return document.underlyingId ? "underlying" : "unresolved";
}

function confidenceScore(confidence: ExternalResearchDocument["confidence"]) {
  switch (confidence) {
    case "high":
      return 12;
    case "medium":
      return 6;
    default:
      return 0;
  }
}

function freshnessScore(document: ExternalResearchDocument, now: Date) {
  const publishedAt = document.publishedAt
    ? Date.parse(document.publishedAt)
    : Date.parse(document.capturedAt);
  if (!Number.isFinite(publishedAt)) {
    return 0;
  }
  const ageHours = Math.max(0, (now.getTime() - publishedAt) / 3_600_000);
  if (ageHours <= 24) {
    return 12;
  }
  if (ageHours <= 72) {
    return 8;
  }
  if (ageHours <= 168) {
    return 4;
  }
  return 0;
}

export function rankExternalResearchDocuments(
  documents: ExternalResearchDocument[],
  request: PortfolioAnalyzerRequest,
  now = new Date(),
): RankedExternalResearchDocument[] {
  return documents
    .map((document) => {
      const parsed = externalResearchDocumentSchema.parse(document);
      const isExpired = Date.parse(parsed.expiresAt) <= now.getTime();
      const identityScope = getIdentityScope(parsed, request);
      const identityBonus = identityScope === "listing"
        ? 14
        : identityScope === "underlying"
          ? 6
          : identityScope === "macro"
            ? 2
            : -10;
      const expiryPenalty = isExpired ? 30 : 0;
      const rankingScore = Math.max(
        0,
        Math.min(
          100,
          parsed.relevanceScore * 0.45 +
            parsed.sourceReliability * 0.25 +
            confidenceScore(parsed.confidence) +
            freshnessScore(parsed, now) +
            identityBonus -
            expiryPenalty,
        ),
      );
      return {
        ...parsed,
        isExpired,
        identityScope,
        rankingScore: Math.round(rankingScore * 10) / 10,
      };
    })
    .sort((left, right) => {
      if (left.isExpired !== right.isExpired) {
        return left.isExpired ? 1 : -1;
      }
      return right.rankingScore - left.rankingScore;
    });
}

function sourceForDocument(
  document: ExternalResearchDocument,
): ExternalResearchProviderSource {
  const sourceType =
    document.sourceType === "manual" ? "news" : document.sourceType;
  return {
    title: `${document.sourceName}: ${document.title}`,
    url: document.url ?? undefined,
    date: document.publishedAt?.slice(0, 10) ?? document.capturedAt.slice(0, 10),
    sourceType,
    providerId: document.providerId as ExternalResearchProviderSource["providerId"],
  };
}

export function buildExternalResearchResultFromDocuments(
  input: ExternalResearchProviderInput,
  documents: ExternalResearchDocument[],
): ExternalResearchProviderResult {
  const ranked = rankExternalResearchDocuments(
    documents,
    input.request,
    input.now,
  );
  const usable = ranked
    .filter((document) => !document.isExpired)
    .filter((document) => document.identityScope !== "unresolved")
    .slice(0, 6);
  const top = usable[0] ?? null;

  return {
    sourceMode: "cached-external",
    externalResearchAsOf: input.now.toISOString(),
    targetKey: input.targetKey,
    security: readRequestSecurity(input.request) ?? undefined,
    summaryPoints: usable.length > 0
      ? usable.flatMap((document) => [
          `${document.sourceName}：${document.title}`,
          ...document.keyPoints.slice(0, 2),
        ]).slice(0, 8)
      : ["没有找到未过期且身份可解释的结构化外部研究文档。"],
    risks: [
      ...(ranked.some((document) => document.isExpired)
        ? ["部分外部研究文档已过期，已从主要信号中降权或排除。"]
        : []),
      ...(ranked.some((document) => document.identityScope === "unresolved")
        ? ["部分文档缺少 securityId 或完整 listing 身份，只能作为低权重背景，不能用于当前 listing 评分。"]
        : []),
      ...(top?.riskFlags ?? []),
    ],
    sources: usable.map(sourceForDocument),
  };
}
