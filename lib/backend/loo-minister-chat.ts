import { and, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { apiSuccess } from "@/lib/backend/contracts";
import { getLooMinisterAnswer } from "@/lib/backend/loo-minister";
import {
  chatSubjectPackKey,
  clearLooMinisterContextPackCacheAsync,
  getOrBuildContextPack,
  LOO_MINISTER_CONTEXT_PACK_TTL_MS,
} from "@/lib/backend/loo-minister-context-pack-cache";
import { resolveLooMinisterContext } from "@/lib/backend/loo-minister-context-resolver";
import {
  type LooMinisterFact,
  type LooMinisterQuestionRequest,
  type looMinisterChatRequestSchema,
} from "@/lib/backend/loo-minister-contracts";
import type { MinisterSubjectRef } from "@/lib/backend/loo-minister-tools";
import { getDb } from "@/lib/db/client";
import {
  looMinisterChatMessages,
  looMinisterChatSessions,
} from "@/lib/db/schema";

type LooMinisterChatRequest = z.infer<typeof looMinisterChatRequestSchema>;

const pageLabels: Record<
  LooMinisterChatRequest["pageContext"]["page"],
  string
> = {
  overview: "总览",
  portfolio: "组合",
  "account-detail": "账户",
  "holding-detail": "持仓",
  "security-detail": "标的",
  "portfolio-health": "健康巡查",
  recommendations: "推荐",
  import: "导入",
  settings: "设置",
  spending: "收支",
};

const projectContextFact: LooMinisterFact = {
  id: "project-context",
  label: "Loo国项目能力",
  value:
    "大臣可以解释总览、组合、账户、持仓、标的、推荐、健康分、导入、设置偏好、行情刷新、今日秘闻和 AI 快扫。",
  detail:
    "回答必须基于当前页面 DTO、用户保存的偏好/推荐/缓存分析和明确的数据新鲜度；不能把实时新闻、论坛或未缓存外部信息当作事实。",
  source: "system",
};

function titleFromQuestion(question: string) {
  const compact = question.replace(/\s+/g, " ").trim();
  return compact.length > 40 ? `${compact.slice(0, 40)}...` : compact;
}

function messageLine(message: { role: string; content: string }) {
  const role = message.role === "assistant" ? "大臣" : "用户";
  return `${role}: ${message.content.replace(/\s+/g, " ").slice(0, 220)}`;
}

function buildSummary(
  previousSummary: string | null,
  recentMessages: Array<{ role: string; content: string }>,
) {
  const lines = [
    previousSummary ? `既有摘要：${previousSummary}` : "",
    ...recentMessages.map(messageLine),
  ].filter(Boolean);
  return lines.join("\n").slice(-1800);
}

function parseSubjectHistory(value: unknown): MinisterSubjectRef[] {
  if (!Array.isArray(value)) return [];
  const subjects: MinisterSubjectRef[] = [];
  for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const subject = item as Record<string, unknown>;
      if (typeof subject.symbol !== "string" || !subject.symbol.trim()) {
        continue;
      }
      subjects.push({
        securityId:
          typeof subject.securityId === "string" ? subject.securityId : null,
        symbol: subject.symbol,
        exchange: typeof subject.exchange === "string" ? subject.exchange : null,
        currency:
          subject.currency === "CAD" || subject.currency === "USD"
            ? subject.currency
            : null,
        name: typeof subject.name === "string" ? subject.name : null,
        source: typeof subject.source === "string" ? subject.source : null,
      });
  }
  return subjects.slice(-8);
}

function subjectKey(subject: MinisterSubjectRef) {
  return [
    subject.securityId?.trim().toUpperCase() ?? "",
    subject.symbol.trim().toUpperCase(),
    subject.exchange?.trim().toUpperCase() ?? "",
    subject.currency ?? "",
  ].join("|");
}

function mergeSubjectHistory(
  existing: MinisterSubjectRef[],
  updates: MinisterSubjectRef[],
) {
  const merged = new Map<string, MinisterSubjectRef>();
  for (const subject of [...existing, ...updates]) {
    merged.set(subjectKey(subject), subject);
  }
  return Array.from(merged.values()).slice(-8);
}

function chatFacts(args: {
  summary: string | null;
  recentMessages: Array<{ role: string; content: string }>;
  previousPage: string;
  currentPage: LooMinisterChatRequest["pageContext"]["page"];
}): LooMinisterFact[] {
  const facts = [projectContextFact];
  if (args.previousPage !== args.currentPage) {
    facts.push({
      id: "chat-context-switch",
      label: "页面上下文切换",
      value: `本轮对话从「${pageLabels[args.previousPage as LooMinisterChatRequest["pageContext"]["page"]] ?? args.previousPage}」切换到「${pageLabels[args.currentPage]}」。`,
      detail:
        "后续回答必须优先使用当前页面 DTO；历史对话只能作为追问语义，不能覆盖当前页面的标的、账户、持仓或数据新鲜度。",
      source: "system",
    });
  }
  if (args.summary) {
    facts.push({
      id: "chat-session-summary",
      label: "本轮对话摘要",
      value: args.summary.slice(0, 240),
      detail: args.summary.slice(0, 600),
      source: "user-input",
    });
  }
  if (args.recentMessages.length > 0) {
    const detail = args.recentMessages.map(messageLine).join("\n");
    facts.push({
      id: "chat-recent-messages",
      label: "最近追问上下文",
      value: `${args.recentMessages.length} 条最近消息`,
      detail: detail.slice(0, 600),
      source: "user-input",
    });
  }
  return facts;
}

export async function askLooMinisterChat(
  userId: string,
  input: LooMinisterChatRequest,
) {
  const db = getDb();
  const now = new Date();
  const session = input.sessionId
    ? await db.query.looMinisterChatSessions.findFirst({
        where: and(
          eq(looMinisterChatSessions.id, input.sessionId),
          eq(looMinisterChatSessions.userId, userId),
        ),
      })
    : null;

  const activeSession =
    session ??
    (
      await db
        .insert(looMinisterChatSessions)
        .values({
          userId,
          title: titleFromQuestion(input.question),
          page: input.pageContext.page,
          pageContextJson: input.pageContext,
          subjectHistoryJson: [],
          summary: null,
          messageCount: 0,
        })
        .returning()
    )[0];

  if (!activeSession) {
    throw new Error("Failed to create Loo Minister chat session.");
  }

  const previousMessages = (
    await db.query.looMinisterChatMessages.findMany({
      where: eq(looMinisterChatMessages.sessionId, activeSession.id),
      orderBy: desc(looMinisterChatMessages.createdAt),
      limit: 8,
    })
  )
    .reverse()
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  await db.insert(looMinisterChatMessages).values({
    sessionId: activeSession.id,
    userId,
    role: "user",
    content: input.question,
    pageContextJson: input.pageContext,
  });

  const sessionSubjectHistory = (
    await getOrBuildContextPack({
      key: chatSubjectPackKey(activeSession.id),
      kind: "chat-subjects",
      ttlMs: LOO_MINISTER_CONTEXT_PACK_TTL_MS.chatSubjects,
      build: () => parseSubjectHistory(activeSession.subjectHistoryJson),
    })
  ).data;
  const resolvedContext = await resolveLooMinisterContext({
    userId,
    request: input,
    sessionSubjects: sessionSubjectHistory,
  });
  const enrichedRequest: LooMinisterQuestionRequest = {
    ...resolvedContext.request,
    pageContext: {
      ...resolvedContext.request.pageContext,
      facts: [
        ...resolvedContext.request.pageContext.facts,
        ...chatFacts({
          summary: activeSession.summary,
          recentMessages: previousMessages,
          previousPage: activeSession.page,
          currentPage: resolvedContext.request.pageContext.page,
        }),
      ].slice(0, 40),
    },
  };
  const answerResponse = await getLooMinisterAnswer(userId, enrichedRequest, {
    skipContextResolver: true,
    forceLocal: input.answerMode === "local",
    allowProviderFallback: input.answerMode === "local",
  });
  const answer = answerResponse.data;
  const recentWithCurrent = [
    ...previousMessages,
    { role: "user", content: input.question },
    { role: "assistant", content: answer.answer },
  ].slice(-10);
  const summary = buildSummary(activeSession.summary, recentWithCurrent);

  await db.insert(looMinisterChatMessages).values({
    sessionId: activeSession.id,
    userId,
    role: "assistant",
    content: answer.answer,
    answerJson: answer,
  });

  await db
    .update(looMinisterChatSessions)
    .set({
      page: input.pageContext.page,
      pageContextJson: input.pageContext,
      subjectHistoryJson: mergeSubjectHistory(
        sessionSubjectHistory,
        resolvedContext.subjectUpdates,
      ),
      summary,
      messageCount: sql`${looMinisterChatSessions.messageCount} + 2`,
      updatedAt: now,
    })
    .where(eq(looMinisterChatSessions.id, activeSession.id));
  await clearLooMinisterContextPackCacheAsync(
    chatSubjectPackKey(activeSession.id),
  );

  return apiSuccess(
    {
      sessionId: activeSession.id,
      title: activeSession.title,
      answer,
      recentMessages: recentWithCurrent.slice(-6),
    },
    "service",
  );
}
