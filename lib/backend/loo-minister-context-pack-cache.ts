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

export type LooMinisterStoredContextPack = Omit<
  LooMinisterContextPack<unknown>,
  "source" | "freshness"
>;

export type LooMinisterContextPackCacheStats = {
  total: number;
  fresh: number;
  stale: number;
};

export type LooMinisterContextPackStore = {
  get(key: string): Promise<LooMinisterStoredContextPack | null>;
  set(pack: LooMinisterStoredContextPack): Promise<void>;
  clear(): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  stats(nowMs?: number): Promise<LooMinisterContextPackCacheStats>;
  getSync?: (key: string) => LooMinisterStoredContextPack | null;
  setSync?: (pack: LooMinisterStoredContextPack) => void;
  clearSync?: () => void;
  deletePrefixSync?: (prefix: string) => void;
  statsSync?: (nowMs?: number) => LooMinisterContextPackCacheStats;
};

export const LOO_MINISTER_CONTEXT_PACK_TTL_MS = {
  projectKnowledge: 60 * 60 * 1000,
  preference: 2 * 60 * 1000,
  recommendation: 2 * 60 * 1000,
  portfolio: 60 * 1000,
  security: 60 * 1000,
  externalIntelligence: 2 * 60 * 1000,
  chatSubjects: 60 * 1000,
} as const;

class MemoryLooMinisterContextPackStore
  implements LooMinisterContextPackStore
{
  private readonly packs = new Map<string, LooMinisterStoredContextPack>();

  async get(key: string) {
    return this.getSync(key);
  }

  getSync(key: string) {
    return this.packs.get(key) ?? null;
  }

  async set(pack: LooMinisterStoredContextPack) {
    this.setSync(pack);
  }

  setSync(pack: LooMinisterStoredContextPack) {
    this.packs.set(pack.key, pack);
  }

  async clear() {
    this.clearSync();
  }

  clearSync() {
    this.packs.clear();
  }

  async deletePrefix(prefix: string) {
    this.deletePrefixSync(prefix);
  }

  deletePrefixSync(prefix: string) {
    for (const key of this.packs.keys()) {
      if (key.startsWith(prefix)) {
        this.packs.delete(key);
      }
    }
  }

  async stats(nowMs = Date.now()) {
    return this.statsSync(nowMs);
  }

  statsSync(nowMs = Date.now()) {
    let fresh = 0;
    let stale = 0;
    for (const pack of this.packs.values()) {
      const expiresAt = Date.parse(pack.expiresAt);
      if (Number.isFinite(expiresAt) && expiresAt > nowMs) {
        fresh += 1;
      } else {
        stale += 1;
      }
    }
    return {
      total: this.packs.size,
      fresh,
      stale,
    };
  }
}

export function createMemoryLooMinisterContextPackStore() {
  return new MemoryLooMinisterContextPackStore();
}

let contextPackStore: LooMinisterContextPackStore =
  createMemoryLooMinisterContextPackStore();

export function setLooMinisterContextPackStore(
  store: LooMinisterContextPackStore,
) {
  contextPackStore = store;
}

export function resetLooMinisterContextPackStore() {
  contextPackStore = createMemoryLooMinisterContextPackStore();
}

function nowIso(nowMs = Date.now()) {
  return new Date(nowMs).toISOString();
}

function packFromStored<T>(
  stored: LooMinisterStoredContextPack,
  freshness: LooMinisterContextPackFreshness,
): LooMinisterContextPack<T> {
  return {
    ...stored,
    data: stored.data as T,
    source: "memory-cache",
    freshness,
  };
}

function getSyncStoreMethod<TMethod extends keyof LooMinisterContextPackStore>(
  method: TMethod,
): NonNullable<LooMinisterContextPackStore[TMethod]> {
  const handler = contextPackStore[method];
  if (!handler) {
    throw new Error(
      `Loo Minister context pack store does not support ${String(method)}. Use the async cache API for cloud-backed stores.`,
    );
  }
  if (typeof handler === "function") {
    return handler.bind(contextPackStore) as NonNullable<
      LooMinisterContextPackStore[TMethod]
    >;
  }
  return handler as NonNullable<LooMinisterContextPackStore[TMethod]>;
}

function buildStoredPack<T>(args: {
  key: string;
  kind: LooMinisterContextPackKind;
  data: T;
  ttlMs: number;
  asOf?: string;
  nowMs?: number;
}): LooMinisterContextPack<T> {
  const nowMs = args.nowMs ?? Date.now();
  const builtAt = nowIso(nowMs);
  const stored: LooMinisterStoredContextPack = {
    key: args.key,
    kind: args.kind,
    data: args.data,
    asOf: args.asOf ?? builtAt,
    builtAt,
    expiresAt: nowIso(nowMs + args.ttlMs),
  };
  return {
    ...stored,
    data: stored.data as T,
    source: "backend",
    freshness: "fresh",
  };
}

async function storePack<T>(args: {
  key: string;
  kind: LooMinisterContextPackKind;
  data: T;
  ttlMs: number;
  asOf?: string;
  nowMs?: number;
}) {
  const pack = buildStoredPack(args);
  await contextPackStore.set(pack);
  return pack;
}

function storePackSync<T>(args: {
  key: string;
  kind: LooMinisterContextPackKind;
  data: T;
  ttlMs: number;
  asOf?: string;
  nowMs?: number;
}) {
  const pack = buildStoredPack(args);
  getSyncStoreMethod("setSync")(pack);
  return pack;
}

function packFreshness(
  stored: LooMinisterStoredContextPack,
  nowMs = Date.now(),
) {
  const expiresAt = Date.parse(stored.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > nowMs ? "fresh" : "stale";
}

async function cachedPack<T>(key: string, nowMs = Date.now()) {
  const stored = await contextPackStore.get(key);
  if (!stored) return null;
  return packFromStored<T>(stored, packFreshness(stored, nowMs));
}

function cachedPackSync<T>(key: string, nowMs = Date.now()) {
  const stored = getSyncStoreMethod("getSync")(key);
  if (!stored) return null;
  return packFromStored<T>(stored, packFreshness(stored, nowMs));
}

export function getOrBuildContextPackSync<T>(args: {
  key: string;
  kind: LooMinisterContextPackKind;
  ttlMs: number;
  asOf?: string;
  build: () => T;
}): LooMinisterContextPack<T> {
  const cached = cachedPackSync<T>(args.key);
  if (cached?.freshness === "fresh") {
    return cached;
  }

  try {
    return storePackSync({
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
  const cached = await cachedPack<T>(args.key);
  if (cached?.freshness === "fresh") {
    return cached;
  }

  try {
    return await storePack({
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
    getSyncStoreMethod("clearSync")();
    return;
  }
  getSyncStoreMethod("deletePrefixSync")(prefix);
}

export async function clearLooMinisterContextPackCacheAsync(prefix?: string) {
  if (!prefix) {
    await contextPackStore.clear();
    return;
  }
  await contextPackStore.deletePrefix(prefix);
}

export function getLooMinisterContextPackCacheStats() {
  return getSyncStoreMethod("statsSync")();
}

export async function getLooMinisterContextPackCacheStatsAsync() {
  return contextPackStore.stats();
}
