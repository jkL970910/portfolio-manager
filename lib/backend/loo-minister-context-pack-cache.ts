import { eq, like, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { looMinisterContextPacks } from "@/lib/db/schema";

export type LooMinisterContextPackKind =
  | "project-knowledge"
  | "preference"
  | "recommendation"
  | "portfolio"
  | "security"
  | "external-intelligence"
  | "chat-subjects"
  | "global-user";

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
  pruneExpired?(nowMs?: number): Promise<number>;
  stats(nowMs?: number): Promise<LooMinisterContextPackCacheStats>;
  getSync?: (key: string) => LooMinisterStoredContextPack | null;
  setSync?: (pack: LooMinisterStoredContextPack) => void;
  clearSync?: () => void;
  deletePrefixSync?: (prefix: string) => void;
  pruneExpiredSync?: (nowMs?: number) => number;
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
  globalUser: 60 * 1000,
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

  async pruneExpired(nowMs = Date.now()) {
    return this.pruneExpiredSync(nowMs);
  }

  pruneExpiredSync(nowMs = Date.now()) {
    let deleted = 0;
    for (const [key, pack] of this.packs.entries()) {
      const expiresAt = Date.parse(pack.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
        this.packs.delete(key);
        deleted += 1;
      }
    }
    return deleted;
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

function rowToStoredPack(
  row: typeof looMinisterContextPacks.$inferSelect,
): LooMinisterStoredContextPack {
  return {
    key: row.packKey,
    kind: row.packKind as LooMinisterContextPackKind,
    data: row.payloadJson,
    asOf: row.asOf.toISOString(),
    builtAt: row.builtAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export function createPostgresLooMinisterContextPackStore(): LooMinisterContextPackStore {
  return {
    async get(key) {
      const db = getDb();
      const [row] = await db
        .select()
        .from(looMinisterContextPacks)
        .where(eq(looMinisterContextPacks.packKey, key))
        .limit(1);
      return row ? rowToStoredPack(row) : null;
    },
    async set(pack) {
      const db = getDb();
      await db
        .insert(looMinisterContextPacks)
        .values({
          packKey: pack.key,
          packKind: pack.kind,
          payloadJson: pack.data,
          asOf: new Date(pack.asOf),
          builtAt: new Date(pack.builtAt),
          expiresAt: new Date(pack.expiresAt),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: looMinisterContextPacks.packKey,
          set: {
            packKind: pack.kind,
            payloadJson: pack.data,
            asOf: new Date(pack.asOf),
            builtAt: new Date(pack.builtAt),
            expiresAt: new Date(pack.expiresAt),
            updatedAt: new Date(),
          },
        });
    },
    async clear() {
      const db = getDb();
      await db.delete(looMinisterContextPacks);
    },
    async deletePrefix(prefix) {
      const db = getDb();
      await db
        .delete(looMinisterContextPacks)
        .where(like(looMinisterContextPacks.packKey, `${prefix}%`));
    },
    async pruneExpired(nowMs = Date.now()) {
      const db = getDb();
      const result = await db
        .delete(looMinisterContextPacks)
        .where(sql`${looMinisterContextPacks.expiresAt} <= ${new Date(nowMs)}`);
      return result.rowCount ?? 0;
    },
    async stats(nowMs = Date.now()) {
      const db = getDb();
      const now = new Date(nowMs);
      const [row] = await db
        .select({
          total: sql<number>`count(*)::int`,
          fresh:
            sql<number>`count(*) filter (where ${looMinisterContextPacks.expiresAt} > ${now})::int`,
          stale:
            sql<number>`count(*) filter (where ${looMinisterContextPacks.expiresAt} <= ${now})::int`,
        })
        .from(looMinisterContextPacks);
      return {
        total: Number(row?.total ?? 0),
        fresh: Number(row?.fresh ?? 0),
        stale: Number(row?.stale ?? 0),
      };
    },
  };
}

export type LooMinisterContextPackStoreMode = "memory" | "postgres";

function getConfiguredStoreMode(): LooMinisterContextPackStoreMode {
  return process.env.LOO_MINISTER_CONTEXT_PACK_STORE === "postgres"
    ? "postgres"
    : "memory";
}

export function createConfiguredLooMinisterContextPackStore() {
  return getConfiguredStoreMode() === "postgres"
    ? createPostgresLooMinisterContextPackStore()
    : createMemoryLooMinisterContextPackStore();
}

let contextPackStore: LooMinisterContextPackStore =
  createConfiguredLooMinisterContextPackStore();

export function setLooMinisterContextPackStore(
  store: LooMinisterContextPackStore,
) {
  contextPackStore = store;
}

export function resetLooMinisterContextPackStore() {
  contextPackStore = createConfiguredLooMinisterContextPackStore();
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
  intent: string;
}) {
  return [
    "projectKnowledgePack",
    keyPart(input.version),
    keyPart(input.page),
    keyPart(input.intent),
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

export function globalUserContextPackKey(input: {
  userId: string;
  asOf?: string | null;
}) {
  return [
    "globalUserContextPack",
    keyPart(input.userId),
    keyPart(input.asOf),
  ].join(":");
}

export function externalIntelligencePackKey(input: {
  userId: string;
  identity: string;
  quoteUpdatedAt?: string | null;
}) {
  return [
    "externalIntelligencePack",
    keyPart(input.userId),
    keyPart(input.identity),
    keyPart(input.quoteUpdatedAt),
  ].join(":");
}

export function chatSubjectPackKey(sessionId: string) {
  return ["chatSubjectPack", keyPart(sessionId), "current"].join(":");
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

export async function pruneExpiredLooMinisterContextPacks(nowMs = Date.now()) {
  if (contextPackStore.pruneExpired) {
    return contextPackStore.pruneExpired(nowMs);
  }
  return 0;
}
