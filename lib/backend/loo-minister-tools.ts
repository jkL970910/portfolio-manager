import type {
  HoldingPosition,
  RecommendationRun,
  SecurityRecord,
} from "@/lib/backend/models";
import { getRepositories } from "@/lib/backend/repositories/factory";
import type {
  LooMinisterFact,
  LooMinisterPageContext,
  LooMinisterSecurityIdentity,
} from "@/lib/backend/loo-minister-contracts";
import {
  getOrBuildContextPack,
  LOO_MINISTER_CONTEXT_PACK_TTL_MS,
  externalIntelligencePackKey,
  projectKnowledgePackKey,
  securityContextPackKey,
} from "@/lib/backend/loo-minister-context-pack-cache";
import { LOO_MINISTER_VERSION } from "@/lib/backend/loo-minister-contracts";
import { getDailyIntelligenceItemsForUser } from "@/lib/backend/mobile-daily-intelligence";
import {
  inferLooMinisterProjectKnowledgeIntent,
  searchLooMinisterProjectKnowledge,
} from "@/lib/backend/loo-minister-domain-knowledge";
import { resolveSecurity } from "@/lib/market-data/service";
import { resolveCanonicalSecurityIdentity } from "@/lib/market-data/security-identity";

export type MinisterSubjectRef = {
  securityId?: string | null;
  symbol: string;
  exchange?: string | null;
  currency?: "CAD" | "USD" | null;
  name?: string | null;
  source?: string | null;
};

const mentionStopWords = new Set([
  "AI",
  "API",
  "CAD",
  "USD",
  "ETF",
  "GPT",
  "HTTP",
  "HTTPS",
  "JSON",
  "Loo",
  "LOO",
  "MCP",
  "P0",
  "P1",
  "QA",
  "SOP",
  "TSX",
  "USD",
  "V2",
  "V3",
]);

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function normalizeMention(value: string) {
  return value.trim().toUpperCase().replace(/\.TO$/u, "");
}

function subjectKey(subject: MinisterSubjectRef) {
  return [
    normalizeKey(subject.securityId),
    normalizeKey(subject.symbol),
    normalizeKey(subject.exchange),
    normalizeKey(subject.currency),
  ].join("|");
}

function toSubjectRef(
  security: LooMinisterSecurityIdentity | SecurityRecord,
  source: string,
): MinisterSubjectRef {
  if ("canonicalExchange" in security) {
    return {
      securityId: security.id,
      symbol: security.symbol,
      exchange: security.canonicalExchange,
      currency: security.currency,
      name: security.name,
      source,
    };
  }

  return {
    securityId: security.securityId ?? null,
    symbol: security.symbol,
    exchange: security.exchange ?? null,
    currency: security.currency ?? null,
    name: security.name ?? null,
    source,
  };
}

function holdingToSubject(holding: HoldingPosition): MinisterSubjectRef {
  return {
    securityId: holding.securityId ?? null,
    symbol: holding.symbol,
    exchange: holding.exchangeOverride ?? null,
    currency: holding.currency,
    name: holding.name,
    source: "portfolio-holding",
  };
}

function recommendationItemsForSymbol(run: RecommendationRun | null, symbol: string) {
  return run?.items.filter(
    (item) => normalizeKey(item.securitySymbol) === normalizeKey(symbol),
  ) ?? [];
}

function getCurrencyForExchange(exchange: string | null | undefined) {
  const normalized = normalizeKey(exchange);
  if (["TSX", "TORONTO STOCK EXCHANGE", "XTSE", "NEO", "CBOE CA"].includes(normalized)) {
    return "CAD" as const;
  }
  if (["NASDAQ", "NYSE", "AMEX", "ARCA", "BATS"].includes(normalized)) {
    return "USD" as const;
  }
  return null;
}

function subjectToFact(subject: MinisterSubjectRef, index: number): LooMinisterFact {
  const display = [
    subject.symbol,
    subject.exchange,
    subject.currency,
  ].filter(Boolean).join(" · ");
  const detail = [
    subject.name ? `名称=${subject.name}` : null,
    subject.securityId ? `securityId=${subject.securityId}` : null,
    subject.source ? `来源=${subject.source}` : null,
  ]
    .filter(Boolean)
    .join("；")
    .slice(0, 240);
  return {
    id: `comparison-subject-${index + 1}`,
    label: `对比标的 ${index + 1}`,
    value: display,
    detail,
    source: "portfolio-data",
  };
}

export function extractSecurityMentions(question: string) {
  const matches = question.match(/\b[A-Z][A-Z0-9]{0,9}(?:\.TO)?\b/gu) ?? [];
  return Array.from(
    new Set(
      matches
        .map((match) => match.trim().toUpperCase())
        .filter((match) => !mentionStopWords.has(match))
        .filter((match) => !/^P\d+$/u.test(match))
        .filter((match) => match.length >= 2 || match.endsWith(".TO")),
    ),
  ).slice(0, 4);
}

export function isComparisonQuestion(question: string) {
  return /对比|比较|相比|比呢|和.+比|versus| vs\.? |compare/i.test(question);
}

export async function searchProjectKnowledgeTool(input: {
  page: LooMinisterPageContext["page"];
  question: string;
}) {
  const intent = inferLooMinisterProjectKnowledgeIntent(input);
  return (
    await getOrBuildContextPack({
      key: projectKnowledgePackKey({
        version: LOO_MINISTER_VERSION,
        page: input.page,
        intent,
      }),
      kind: "project-knowledge",
      ttlMs: LOO_MINISTER_CONTEXT_PACK_TTL_MS.projectKnowledge,
      build: () =>
        searchLooMinisterProjectKnowledge({
          page: input.page,
          question: input.question,
        }),
    })
  ).data;
}

export async function resolveSecurityMentionTool(
  userId: string,
  mention: string,
): Promise<{
  status: "resolved" | "ambiguous" | "unavailable";
  subject?: MinisterSubjectRef;
  options?: MinisterSubjectRef[];
  fact?: LooMinisterFact;
}> {
  const cleanSymbol = normalizeMention(mention);
  const mentionImpliesToronto = mention.toUpperCase().endsWith(".TO");
  const pack = await getOrBuildContextPack({
    key: securityContextPackKey({
      userId,
      identity: `${cleanSymbol}:${mentionImpliesToronto ? "tsx-cad" : "auto"}`,
      quoteUpdatedAt: "latest",
    }),
    kind: "security",
    ttlMs: LOO_MINISTER_CONTEXT_PACK_TTL_MS.security,
    build: async () => {
      const repositories = getRepositories();
      const [holdings, recommendationRun] = await Promise.all([
        repositories.holdings.listByUserId(userId),
        repositories.recommendations.getLatestByUserId(userId).catch(() => null),
      ]);

      const candidates = [
        ...holdings
          .filter((holding) => normalizeKey(holding.symbol) === cleanSymbol)
          .map(holdingToSubject),
        ...recommendationItemsForSymbol(recommendationRun, cleanSymbol)
          .filter((item) => item.securitySymbol)
          .map((item) => ({
            securityId: item.securityId ?? null,
            symbol: item.securitySymbol ?? cleanSymbol,
            exchange: item.securityExchange ?? null,
            currency: item.securityCurrency ?? null,
            name: item.securityName,
            source: "latest-recommendation",
          })),
      ];
      const unique = Array.from(
        new Map(candidates.map((subject) => [subjectKey(subject), subject])).values(),
      );

      if (mentionImpliesToronto) {
        const cadMatch = unique.find(
          (subject) =>
            normalizeKey(subject.symbol) === cleanSymbol &&
            subject.currency === "CAD" &&
            ["TSX", "XTSE", "TORONTO STOCK EXCHANGE", "TOR"].includes(
              normalizeKey(subject.exchange),
            ),
        );
        if (cadMatch) {
          return { status: "resolved" as const, subject: cadMatch };
        }
      }

      if (unique.length === 1) {
        return { status: "resolved" as const, subject: unique[0] };
      }
      if (unique.length > 1) {
        return {
          status: "ambiguous" as const,
          options: unique,
          fact: {
            id: `security-mention-ambiguous-${cleanSymbol}`,
            label: `标的 ${cleanSymbol} 需要选择 listing`,
            value: unique
              .map((subject) =>
                [subject.symbol, subject.exchange, subject.currency]
                  .filter(Boolean)
                  .join(" · "),
              )
              .join(" / ")
              .slice(0, 240),
            detail:
              "同一 ticker 可能存在 CAD/US 或不同交易所 listing；大臣不会 ticker-only 猜测。请指定交易所和币种。",
            source: "system" as const,
          },
        };
      }

      try {
        const resolved = await resolveSecurity(mention);
        const resolution = resolved.result;
        const exchange = mentionImpliesToronto
          ? "TSX"
          : resolution.exchange ?? resolution.micCode ?? null;
        const currency = mentionImpliesToronto
          ? "CAD"
          : getCurrencyForExchange(exchange);
        if (!exchange || !currency || resolution.provider === "fallback") {
          return {
            status: "unavailable" as const,
            fact: {
              id: `security-mention-unavailable-${cleanSymbol}`,
              label: `标的 ${cleanSymbol} 暂未补齐 context`,
              value: "已尝试本地缓存和市场数据 resolver，但缺少唯一 listing 身份。",
              detail:
                "如果你想让大臣分析这个标的，请补充交易所和币种，例如 TSX/CAD 或 NASDAQ/USD。",
              source: "system" as const,
            },
          };
        }

        const security = await resolveCanonicalSecurityIdentity({
          symbol: cleanSymbol,
          exchange,
          micCode: resolution.micCode,
          currency,
          name: resolution.name,
          securityType: resolution.securityType,
          marketSector: resolution.marketSector,
          provider: resolution.provider,
          providerSymbol: mention,
        });
        return {
          status: "resolved" as const,
          subject: toSubjectRef(security, "market-data-resolver"),
        };
      } catch {
        return {
          status: "unavailable" as const,
          fact: {
            id: `security-mention-resolver-failed-${cleanSymbol}`,
            label: `标的 ${cleanSymbol} context 自动补齐失败`,
            value: "市场数据 resolver 当前不可用或 provider 受限。",
            detail:
              "大臣本次只能基于当前页面和已有缓存回答；不会实时抓新闻/论坛，也不会绕过 provider limit。",
            source: "system" as const,
          },
        };
      }
    },
  });

  return pack.data;
}

export async function getCachedExternalIntelligenceTool(
  userId: string,
  subject: MinisterSubjectRef,
) {
  const pack = await getOrBuildContextPack({
    key: externalIntelligencePackKey({
      userId,
      identity: [
        subject.securityId,
        subject.symbol,
        subject.exchange,
        subject.currency,
        "external-intelligence",
      ]
        .filter(Boolean)
        .join("|"),
      quoteUpdatedAt: "latest",
    }),
    kind: "external-intelligence",
    ttlMs: LOO_MINISTER_CONTEXT_PACK_TTL_MS.externalIntelligence,
    build: async () => {
      const items = await getDailyIntelligenceItemsForUser(userId, 8);
      return items.filter((item) => {
        if (subject.securityId && item.identity.securityId === subject.securityId) {
          return true;
        }
        return normalizeKey(item.identity.symbol) === normalizeKey(subject.symbol) &&
          normalizeKey(item.identity.exchange) === normalizeKey(subject.exchange) &&
          normalizeKey(item.identity.currency) === normalizeKey(subject.currency);
      });
    },
  });

  return pack.data;
}

export function subjectRefsToFacts(subjects: MinisterSubjectRef[]) {
  return subjects.slice(0, 3).map(subjectToFact);
}
