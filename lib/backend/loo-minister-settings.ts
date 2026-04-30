import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";

import { apiSuccess } from "@/lib/backend/contracts";
import type { LooMinisterSettingsInputPayload } from "@/lib/backend/payload-schemas";
import { getDb } from "@/lib/db/client";
import { looMinisterSettings, looMinisterUsageLogs } from "@/lib/db/schema";

export type LooMinisterMode = "local" | "gpt-5.5";
export type LooMinisterProvider = "official-openai" | "openrouter-compatible";

export interface LooMinisterSettingsView {
  mode: LooMinisterMode;
  provider: LooMinisterProvider;
  providerLabel: string;
  model: string;
  reasoningEffort: string;
  baseUrl: string | null;
  apiKeyConfigured: boolean;
  apiKeyLast4: string | null;
  serverKeyAvailable: boolean;
  providerEnabled: boolean;
  effectiveMode: "local" | "gpt-5.5" | "gpt-5.5-pending-key";
  privacyNote: string;
  recentUsage: LooMinisterUsageItem[];
}

export interface LooMinisterUsageItem {
  id: string;
  page: string;
  mode: string;
  provider: string;
  model: string;
  status: string;
  tokenLabel: string;
  errorMessage: string | null;
  createdAt: string;
}

export interface ResolvedLooMinisterSettings {
  mode: LooMinisterMode;
  provider: LooMinisterProvider;
  model: string;
  reasoningEffort: string;
  endpoint: string;
  apiKey: string | null;
  apiKeySource: "user" | "server" | "none";
  providerEnabled: boolean;
}

export interface LooMinisterUsageInsert {
  page: string;
  mode: string;
  provider: string;
  model: string;
  status: "success" | "fallback" | "failed" | "skipped";
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  errorMessage?: string | null;
}

const MODEL = "gpt-5.5" as const;
const REASONING_EFFORT = "medium" as const;
const OFFICIAL_OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/responses";

function getServerApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function serverKeyAllowed() {
  return process.env.LOO_MINISTER_ALLOW_SERVER_KEY === "true";
}

function providerGloballyEnabled() {
  return process.env.LOO_MINISTER_PROVIDER_ENABLED === "true";
}

function getEncryptionKey() {
  const secret =
    process.env.LOO_MINISTER_ENCRYPTION_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "AI Minister API key encryption requires LOO_MINISTER_ENCRYPTION_SECRET or AUTH_SECRET.",
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptApiKey(apiKey: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(apiKey.trim(), "utf8"),
    cipher.final(),
  ]);
  return {
    encryptedApiKey: encrypted.toString("base64"),
    apiKeyIv: iv.toString("base64"),
    apiKeyAuthTag: cipher.getAuthTag().toString("base64"),
    apiKeyLast4: apiKey.trim().slice(-4),
  };
}

function decryptApiKey(row: {
  encryptedApiKey: string | null;
  apiKeyIv: string | null;
  apiKeyAuthTag: string | null;
}) {
  if (!row.encryptedApiKey || !row.apiKeyIv || !row.apiKeyAuthTag) {
    return null;
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(row.apiKeyIv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(row.apiKeyAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.encryptedApiKey, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function normalizeMode(value: string | null | undefined): LooMinisterMode {
  return value === "gpt-5.5" ? "gpt-5.5" : "local";
}

function normalizeProvider(
  value: string | null | undefined,
): LooMinisterProvider {
  return value === "openrouter-compatible"
    ? "openrouter-compatible"
    : "official-openai";
}

function normalizeModel(value: string | null | undefined) {
  const model = value?.trim();
  return model && model.length >= 2 ? model : MODEL;
}

function normalizeReasoningEffort(value: string | null | undefined) {
  return ["minimal", "low", "medium", "high", "xhigh"].includes(value ?? "")
    ? value!
    : getDefaultReasoningEffort();
}

function getDefaultReasoningEffort() {
  const value = process.env.LOO_MINISTER_REASONING_EFFORT;
  return ["minimal", "low", "medium", "high", "xhigh"].includes(value ?? "")
    ? value!
    : REASONING_EFFORT;
}

function getDefaultOpenRouterEndpoint() {
  return (
    process.env.LOO_MINISTER_OPENROUTER_BASE_URL?.trim() ||
    DEFAULT_OPENROUTER_ENDPOINT
  );
}

function normalizeOpenRouterEndpoint(value: string | null | undefined) {
  const raw = value?.trim() || getDefaultOpenRouterEndpoint();
  const withoutTrailingSlash = raw.replace(/\/+$/, "");
  if (withoutTrailingSlash.endsWith("/responses")) {
    return withoutTrailingSlash;
  }
  if (withoutTrailingSlash.endsWith("/api/v1")) {
    return `${withoutTrailingSlash}/responses`;
  }
  if (withoutTrailingSlash.endsWith("/v1")) {
    return `${withoutTrailingSlash}/responses`;
  }

  const host = (() => {
    try {
      return new URL(withoutTrailingSlash).hostname;
    } catch {
      return "";
    }
  })();

  return host === "openrouter.ai"
    ? `${withoutTrailingSlash}/api/v1/responses`
    : `${withoutTrailingSlash}/v1/responses`;
}

function getEndpoint(provider: LooMinisterProvider, baseUrl?: string | null) {
  return provider === "openrouter-compatible"
    ? normalizeOpenRouterEndpoint(baseUrl)
    : OFFICIAL_OPENAI_ENDPOINT;
}

function getProviderLabel(provider: LooMinisterProvider) {
  return provider === "openrouter-compatible"
    ? "OpenRouter-compatible"
    : "OpenAI 官方";
}

async function getSettingsRow(userId: string) {
  return getDb().query.looMinisterSettings.findFirst({
    where: eq(looMinisterSettings.userId, userId),
  });
}

async function getRecentUsage(userId: string): Promise<LooMinisterUsageItem[]> {
  const rows = await getDb().query.looMinisterUsageLogs.findMany({
    where: eq(looMinisterUsageLogs.userId, userId),
    orderBy: [desc(looMinisterUsageLogs.createdAt)],
    limit: 5,
  });
  return rows.map((row) => ({
    id: row.id,
    page: row.page,
    mode: row.mode,
    provider: row.provider,
    model: row.model,
    status: row.status,
    tokenLabel:
      row.totalTokens == null ? "token 未返回" : `${row.totalTokens} tokens`,
    errorMessage: row.errorMessage ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function resolveLooMinisterSettings(
  userId: string,
): Promise<ResolvedLooMinisterSettings> {
  const row = await getSettingsRow(userId);
  const mode = normalizeMode(row?.mode);
  const provider = normalizeProvider(row?.provider);
  const userKey = row ? decryptApiKey(row) : null;
  const serverKey =
    !userKey && provider === "official-openai" && serverKeyAllowed()
      ? getServerApiKey()
      : null;

  return {
    mode,
    provider,
    model: normalizeModel(row?.model),
    reasoningEffort: normalizeReasoningEffort(row?.reasoningEffort),
    endpoint: getEndpoint(provider, row?.baseUrl),
    apiKey: userKey || serverKey,
    apiKeySource: userKey ? "user" : serverKey ? "server" : "none",
    providerEnabled: providerGloballyEnabled(),
  };
}

export async function getMobileLooMinisterSettings(userId: string) {
  const row = await getSettingsRow(userId);
  const mode = normalizeMode(row?.mode);
  const provider = normalizeProvider(row?.provider);
  const apiKeyConfigured = Boolean(row?.apiKeyLast4);
  const serverKeyAvailable =
    provider === "official-openai" &&
    serverKeyAllowed() &&
    Boolean(getServerApiKey());
  const providerEnabled = providerGloballyEnabled();
  const effectiveMode: LooMinisterSettingsView["effectiveMode"] =
    mode === "local"
      ? "local"
      : providerEnabled && (apiKeyConfigured || serverKeyAvailable)
        ? "gpt-5.5"
        : "gpt-5.5-pending-key";

  return apiSuccess<LooMinisterSettingsView>(
    {
      mode,
      provider,
      providerLabel: getProviderLabel(provider),
      model: normalizeModel(row?.model),
      reasoningEffort: normalizeReasoningEffort(row?.reasoningEffort),
      baseUrl:
        provider === "openrouter-compatible"
          ? getEndpoint(provider, row?.baseUrl)
          : null,
      apiKeyConfigured,
      apiKeyLast4: row?.apiKeyLast4 ?? null,
      serverKeyAvailable,
      providerEnabled,
      effectiveMode,
      privacyNote:
        "开启外部大臣后，仅当前页面的结构化摘要会发送到所选模型供应商；不会把完整数据库或原始 API Key 发给 Flutter 客户端。",
      recentUsage: await getRecentUsage(userId),
    },
    "database",
  );
}

export async function updateMobileLooMinisterSettings(
  userId: string,
  payload: LooMinisterSettingsInputPayload,
) {
  const now = new Date();
  const existing = await getSettingsRow(userId);
  const provider = normalizeProvider(payload.provider ?? existing?.provider);
  const encrypted = payload.apiKey ? encryptApiKey(payload.apiKey) : null;
  const keyPatch = encrypted
    ? { ...encrypted, apiKeyUpdatedAt: now }
    : payload.clearApiKey
      ? {
          encryptedApiKey: null,
          apiKeyIv: null,
          apiKeyAuthTag: null,
          apiKeyLast4: null,
          apiKeyUpdatedAt: null,
        }
      : {};

  if (existing) {
    await getDb()
      .update(looMinisterSettings)
      .set({
        mode: payload.mode,
        provider,
        model: normalizeModel(payload.model ?? existing.model),
        reasoningEffort: normalizeReasoningEffort(
          payload.reasoningEffort ?? existing.reasoningEffort,
        ),
        baseUrl:
          provider === "openrouter-compatible"
            ? normalizeOpenRouterEndpoint(payload.baseUrl ?? existing.baseUrl)
            : null,
        ...keyPatch,
        updatedAt: now,
      })
      .where(eq(looMinisterSettings.userId, userId));
  } else {
    await getDb()
      .insert(looMinisterSettings)
      .values({
        userId,
        mode: payload.mode,
        provider,
        model: normalizeModel(payload.model),
        reasoningEffort: normalizeReasoningEffort(payload.reasoningEffort),
        baseUrl:
          provider === "openrouter-compatible"
            ? normalizeOpenRouterEndpoint(payload.baseUrl)
            : null,
        ...keyPatch,
        createdAt: now,
        updatedAt: now,
      });
  }

  return getMobileLooMinisterSettings(userId);
}

export async function recordLooMinisterUsage(
  userId: string,
  usage: LooMinisterUsageInsert,
) {
  try {
    await getDb()
      .insert(looMinisterUsageLogs)
      .values({
        userId,
        page: usage.page,
        mode: usage.mode,
        provider: usage.provider,
        model: usage.model,
        status: usage.status,
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        totalTokens: usage.totalTokens ?? null,
        errorMessage: usage.errorMessage ?? null,
      });
  } catch {
    // Usage logs must never break the user-facing minister answer.
  }
}
