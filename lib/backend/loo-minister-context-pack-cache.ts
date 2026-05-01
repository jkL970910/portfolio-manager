export type LooMinisterContextPackKind =
  | "project-knowledge"
  | "preference"
  | "recommendation"
  | "portfolio"
  | "security"
  | "external-intelligence"
  | "chat-subjects";

export type LooMinisterContextPackSource = "backend" | "memory-cache";
export type LooMinisterContextPackFreshness = "fresh" | "stale";

export type LooMinisterContextPack<T> = {
  key: string;
  kind: LooMinisterContextPackKind;
  data: T;
  asOf: string;
  source: LooMinisterContextPackSource;
  freshness: LooMinisterContextPackFreshness;
  builtAt: string;
  expiresAt: string;
};

type StoredContextPack = Omit<
  LooMinisterContextPack<unknown>,
  "source" | "freshness"
>;

export const LOO_MINISTER_CONTEXT_PACK_TTL_MS = {
  projectKnowledge: 60 * 60 * 1000,
  preference: 2 * 60 * 1000,
  recommendation: 2 * 60 * 1000,
  portfolio: 60 * 1000,
  security: 60 * 1000,
  externalIntelligence: 2 * 60 * 1000,
  chatSubjects: 60 * 1000,
} as const;

const contextPackCache = new Map<string, StoredContextPack>();

function nowIso(nowMs = Date.now()) {
  return new Date(nowMs).toISOString();
}

function packFromStored<T>(
  stored: StoredContextPack,
  freshness: LooMinisterContextPackFreshness,
): LooMinisterContextPack<T> {
  return {
    ...stored,
    data: stored.data as T,
    source: "memory-cache",
    freshness,
  };
}

function storePack<T>(args: {
  key: string;
  kind: LooMinisterContextPackKind;
  data: T;
  ttlMs: number;
  asOf?: string;
  nowMs?: number;
}): LooMinisterContextPack<T> {
  const nowMs = args.nowMs ?? Date.now();
  const builtAt = nowIso(nowMs);
  const stored: StoredContextPack = {
    key: args.key,
    kind: args.kind,
    data: args.data,
    asOf: args.asOf ?? builtAt,
    builtAt,
    expiresAt: nowIso(nowMs + args.ttlMs),
  };
  contextPackCache.set(args.key, stored);
  return {
    ...stored,
    data: stored.data as T,
    source: "backend",
    freshness: "fresh",
  };
}

function cachedPack<T>(key: string, nowMs = Date.now()) {
  const stored = contextPackCache.get(key);
  if (!stored) return null;
  const expiresAt = Date.parse(stored.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt > nowMs) {
    return packFromStored<T>(stored, "fresh");
  }
  return packFromStored<T>(stored, "stale");
}

export function getOrBuildContextPackSync<T>(args: {
  key: string;
  kind: LooMinisterContextPackKind;
  ttlMs: number;
  asOf?: string;
  build: () => T;
}): LooMinisterContextPack<T> {
  const cached = cachedPack<T>(args.key);
  if (cached?.freshness === "fresh") {
    return cached;
  }

  try {
    return storePack({
      key: args.key,
      kind: args.kind,
      data: args.build(),
      ttlMs: args.ttlMs,
      asOf: args.asOf,
    });
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

export async function getOrBuildContextPack<T>(args: {
  key: string;
  kind: LooMinisterContextPackKind;
  ttlMs: number;
  asOf?: string;
  build: () => Promise<T> | T;
}): Promise<LooMinisterContextPack<T>> {
  const cached = cachedPack<T>(args.key);
  if (cached?.freshness === "fresh") {
    return cached;
  }

  try {
    return storePack({
      key: args.key,
      kind: args.kind,
      data: await args.build(),
      ttlMs: args.ttlMs,
      asOf: args.asOf,
    });
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

function keyPart(value: string | number | null | undefined) {
  const text = String(value ?? "none")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[:|]/g, "-");
  return text.slice(0, 160) || "none";
}

export function projectKnowledgePackKey(input: {
  version: string;
  page: string;
  question: string;
}) {
  return [
    "projectKnowledgePack",
    keyPart(input.version),
    keyPart(input.page),
    keyPart(input.question),
  ].join(":");
}

export function userPreferencePackKey(userId: string, updatedAt: string) {
  return ["userPreferencePack", keyPart(userId), keyPart(updatedAt)].join(":");
}

export function latestRecommendationPackKey(userId: string, runId: string) {
  return ["latestRecommendationPack", keyPart(userId), keyPart(runId)].join(
    ":",
  );
}

export function securityContextPackKey(input: {
  userId: string;
  identity: string;
  quoteUpdatedAt?: string | null;
}) {
  return [
    "securityContextPack",
    keyPart(input.userId),
    keyPart(input.identity),
    keyPart(input.quoteUpdatedAt),
  ].join(":");
}

export function chatSubjectPackKey(sessionId: string, updatedAt: string) {
  return ["chatSubjectPack", keyPart(sessionId), keyPart(updatedAt)].join(":");
}

export function clearLooMinisterContextPackCache(prefix?: string) {
  if (!prefix) {
    contextPackCache.clear();
    return;
  }
  for (const key of contextPackCache.keys()) {
    if (key.startsWith(prefix)) {
      contextPackCache.delete(key);
    }
  }
}

export function getLooMinisterContextPackCacheStats() {
  const nowMs = Date.now();
  let fresh = 0;
  let stale = 0;
  for (const pack of contextPackCache.values()) {
    const expiresAt = Date.parse(pack.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt > nowMs) {
      fresh += 1;
    } else {
      stale += 1;
    }
  }
  return {
    total: contextPackCache.size,
    fresh,
    stale,
  };
}
