import type {
  LooMinisterFact,
  LooMinisterPageContext,
  LooMinisterQuestionRequest,
} from "@/lib/backend/loo-minister-contracts";
import {
  extractSecurityMentions,
  getCachedExternalIntelligenceTool,
  isComparisonQuestion,
  resolveSecurityMentionTool,
  searchProjectKnowledgeTool,
  subjectRefsToFacts,
  type MinisterSubjectRef,
} from "@/lib/backend/loo-minister-tools";

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function subjectFromPageContext(
  pageContext: LooMinisterPageContext,
): MinisterSubjectRef | null {
  const security = pageContext.subject.security;
  if (!security) return null;
  return {
    securityId: security.securityId ?? null,
    symbol: security.symbol,
    exchange: security.exchange ?? null,
    currency: security.currency ?? null,
    name: security.name ?? null,
    source: "current-page",
  };
}

function subjectKey(subject: MinisterSubjectRef) {
  return [
    normalizeKey(subject.securityId),
    normalizeKey(subject.symbol),
    normalizeKey(subject.exchange),
    normalizeKey(subject.currency),
  ].join("|");
}

function isSameSubject(a: MinisterSubjectRef | null, b: MinisterSubjectRef | null) {
  if (!a || !b) return false;
  if (a.securityId && b.securityId && a.securityId === b.securityId) {
    return true;
  }
  return normalizeKey(a.symbol) === normalizeKey(b.symbol) &&
    normalizeKey(a.exchange) === normalizeKey(b.exchange) &&
    normalizeKey(a.currency) === normalizeKey(b.currency);
}

function contextStatusFact(status: string, detail: string): LooMinisterFact {
  return {
    id: `context-resolver-status-${status}`,
    label: "大臣上下文补齐状态",
    value: status,
    detail,
    source: "system",
  };
}

function intelligenceFacts(
  items: Awaited<ReturnType<typeof getCachedExternalIntelligenceTool>>,
): LooMinisterFact[] {
  return items.slice(0, 2).map((item, index) => ({
    id: `comparison-intelligence-${index + 1}`,
    label: `对比标的秘闻：${item.title}`.slice(0, 120),
    value: item.summary.slice(0, 240),
    detail: [
      item.reason,
      item.freshnessLabel,
      item.confidenceLabel,
      item.relevanceLabel,
      ...item.keyPoints.slice(0, 1),
      ...item.riskFlags.slice(0, 1).map((flag) => `风险：${flag}`),
    ]
      .filter(Boolean)
      .join("；")
      .slice(0, 600),
    source: "external-intelligence",
  }));
}

function dedupeFacts(facts: LooMinisterFact[]) {
  return Array.from(new Map(facts.map((fact) => [fact.id, fact])).values());
}

export async function resolveLooMinisterContext(input: {
  userId: string;
  request: LooMinisterQuestionRequest;
  sessionSubjects?: MinisterSubjectRef[];
}): Promise<{
  request: LooMinisterQuestionRequest;
  subjectUpdates: MinisterSubjectRef[];
}> {
  const currentSubject = subjectFromPageContext(input.request.pageContext);
  const subjectUpdates = currentSubject ? [currentSubject] : [];
  const facts: LooMinisterFact[] = [
    ...searchProjectKnowledgeTool({
      page: input.request.pageContext.page,
      question: input.request.question,
    }),
  ];
  const comparisonSubjects: MinisterSubjectRef[] = [];
  const mentions = extractSecurityMentions(input.request.question);
  const sessionSubjects = input.sessionSubjects ?? [];

  for (const mention of mentions) {
    if (currentSubject && normalizeKey(currentSubject.symbol) === normalizeKey(mention.replace(/\.TO$/u, ""))) {
      continue;
    }
    const resolved = await resolveSecurityMentionTool(input.userId, mention);
    if (resolved.status === "resolved" && resolved.subject) {
      if (!isSameSubject(currentSubject, resolved.subject)) {
        comparisonSubjects.push(resolved.subject);
      }
      subjectUpdates.push(resolved.subject);
      continue;
    }
    if (resolved.fact) {
      facts.push(resolved.fact);
    }
  }

  if (isComparisonQuestion(input.request.question) && comparisonSubjects.length === 0) {
    const latestDifferent = [...sessionSubjects]
      .reverse()
      .find((subject) => !isSameSubject(currentSubject, subject));
    if (latestDifferent) {
      comparisonSubjects.push({
        ...latestDifferent,
        source: latestDifferent.source ?? "chat-subject-history",
      });
    }
  }

  const uniqueComparisonSubjects = Array.from(
    new Map(comparisonSubjects.map((subject) => [subjectKey(subject), subject])).values(),
  ).slice(0, 3);
  if (uniqueComparisonSubjects.length > 0) {
    facts.push(...subjectRefsToFacts(uniqueComparisonSubjects));
    const intelligence = (
      await Promise.all(
        uniqueComparisonSubjects.map((subject) =>
          getCachedExternalIntelligenceTool(input.userId, subject).catch(
            () => [],
          ),
        ),
      )
    ).flat();
    facts.push(...intelligenceFacts(intelligence));
    facts.push(
      contextStatusFact(
        "hydrated",
        "大臣已为本轮问题补齐对比标的 context；若对比标的来自缓存或 resolver，会在回答中说明来源和数据边界。",
      ),
    );
  } else if (mentions.length > 0) {
    facts.push(
      contextStatusFact(
        "partial",
        "大臣尝试识别问题中的标的 mention，但没有得到唯一可用 listing context；回答必须说明缺失项或要求用户指定交易所/币种。",
      ),
    );
  }

  return {
    request: {
      ...input.request,
      pageContext: {
        ...input.request.pageContext,
        facts: dedupeFacts([...facts, ...input.request.pageContext.facts]).slice(
          0,
          40,
        ),
      },
    },
    subjectUpdates,
  };
}
