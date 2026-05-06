import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import {
  chatSubjectPackKey,
  clearLooMinisterContextPackCache,
  clearLooMinisterContextPackCacheAsync,
  createMemoryLooMinisterContextPackStore,
  externalIntelligencePackKey,
  createPostgresLooMinisterContextPackStore,
  getOrBuildContextPack,
  getOrBuildContextPackSync,
  getLooMinisterContextPackCacheStats,
  getLooMinisterContextPackCacheStatsAsync,
  globalUserContextPackKey,
  latestRecommendationPackKey,
  pruneExpiredLooMinisterContextPacks,
  projectKnowledgePackKey,
  resetLooMinisterContextPackStore,
  securityContextPackKey,
  setLooMinisterContextPackStore,
  type LooMinisterContextPackStore,
  type LooMinisterStoredContextPack,
  userPreferencePackKey,
} from "@/lib/backend/loo-minister-context-pack-cache";
import { getDb } from "@/lib/db/client";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("Loo Minister context pack cache reuses fresh async packs", async () => {
  clearLooMinisterContextPackCache();
  let buildCount = 0;

  const first = await getOrBuildContextPack({
    key: "test:async:fresh",
    kind: "security",
    ttlMs: 1_000,
    build: async () => {
      buildCount += 1;
      return { symbol: "VFV" };
    },
  });
  const second = await getOrBuildContextPack({
    key: "test:async:fresh",
    kind: "security",
    ttlMs: 1_000,
    build: async () => {
      buildCount += 1;
      return { symbol: "ZQQ" };
    },
  });

  assert.equal(buildCount, 1);
  assert.equal(first.source, "backend");
  assert.equal(second.source, "memory-cache");
  assert.deepEqual(second.data, { symbol: "VFV" });
});

test("Loo Minister context pack cache rebuilds after TTL and can serve stale on failure", async () => {
  clearLooMinisterContextPackCache();
  let buildCount = 0;

  await getOrBuildContextPack({
    key: "test:async:stale",
    kind: "recommendation",
    ttlMs: 1,
    build: async () => {
      buildCount += 1;
      return { runId: "run_1" };
    },
  });
  await sleep(5);

  const stale = await getOrBuildContextPack({
    key: "test:async:stale",
    kind: "recommendation",
    ttlMs: 1,
    build: async () => {
      buildCount += 1;
      throw new Error("backend unavailable");
    },
  });

  assert.equal(buildCount, 2);
  assert.equal(stale.source, "memory-cache");
  assert.equal(stale.freshness, "stale");
  assert.deepEqual(stale.data, { runId: "run_1" });
});

test("Loo Minister context pack cache supports sync project knowledge packs and stats", () => {
  clearLooMinisterContextPackCache();
  let buildCount = 0;

  const first = getOrBuildContextPackSync({
    key: "test:sync:project",
    kind: "project-knowledge",
    ttlMs: 1_000,
    build: () => {
      buildCount += 1;
      return ["overview"];
    },
  });
  const second = getOrBuildContextPackSync({
    key: "test:sync:project",
    kind: "project-knowledge",
    ttlMs: 1_000,
    build: () => {
      buildCount += 1;
      return ["portfolio"];
    },
  });
  const stats = getLooMinisterContextPackCacheStats();

  assert.equal(buildCount, 1);
  assert.equal(first.source, "backend");
  assert.equal(second.source, "memory-cache");
  assert.deepEqual(second.data, ["overview"]);
  assert.equal(stats.total, 1);
  assert.equal(stats.fresh, 1);
});

test("Loo Minister context pack cache supports a cloud-ready async store boundary", async () => {
  const packs = new Map<string, LooMinisterStoredContextPack>();
  const asyncOnlyStore: LooMinisterContextPackStore = {
    async get(key) {
      return packs.get(key) ?? null;
    },
    async set(pack) {
      packs.set(pack.key, pack);
    },
    async clear() {
      packs.clear();
    },
    async deletePrefix(prefix) {
      for (const key of packs.keys()) {
        if (key.startsWith(prefix)) packs.delete(key);
      }
    },
    async stats(nowMs = Date.now()) {
      let fresh = 0;
      let stale = 0;
      for (const pack of packs.values()) {
        const expiresAt = Date.parse(pack.expiresAt);
        if (Number.isFinite(expiresAt) && expiresAt > nowMs) {
          fresh += 1;
        } else {
          stale += 1;
        }
      }
      return { total: packs.size, fresh, stale };
    },
  };

  setLooMinisterContextPackStore(asyncOnlyStore);
  try {
    let buildCount = 0;
    const first = await getOrBuildContextPack({
      key: "cloud:security:vfv",
      kind: "security",
      ttlMs: 1_000,
      build: async () => {
        buildCount += 1;
        return { symbol: "VFV" };
      },
    });
    const second = await getOrBuildContextPack({
      key: "cloud:security:vfv",
      kind: "security",
      ttlMs: 1_000,
      build: async () => {
        buildCount += 1;
        return { symbol: "XEQT" };
      },
    });
    const stats = await getLooMinisterContextPackCacheStatsAsync();

    assert.equal(buildCount, 1);
    assert.equal(first.source, "backend");
    assert.equal(second.source, "memory-cache");
    assert.deepEqual(second.data, { symbol: "VFV" });
    assert.equal(stats.total, 1);

    await clearLooMinisterContextPackCacheAsync("cloud:");
    assert.equal((await getLooMinisterContextPackCacheStatsAsync()).total, 0);
  } finally {
    resetLooMinisterContextPackStore();
  }
});

test("Loo Minister context pack cache prunes expired packs", async () => {
  setLooMinisterContextPackStore(createMemoryLooMinisterContextPackStore());
  try {
    await getOrBuildContextPack({
      key: "prune:fresh",
      kind: "security",
      ttlMs: 60_000,
      build: () => ({ symbol: "VFV" }),
    });
    await getOrBuildContextPack({
      key: "prune:expired",
      kind: "security",
      ttlMs: 1,
      build: () => ({ symbol: "XBB" }),
    });
    await sleep(5);

    const deletedCount = await pruneExpiredLooMinisterContextPacks();
    const stats = await getLooMinisterContextPackCacheStatsAsync();

    assert.equal(deletedCount, 1);
    assert.equal(stats.total, 1);
    assert.equal(stats.fresh, 1);
  } finally {
    resetLooMinisterContextPackStore();
  }
});

test("Loo Minister postgres context pack store prunes expired rows", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured.");
    return;
  }

  const store = createPostgresLooMinisterContextPackStore();
  const prefix = `test:postgres-prune:${Date.now()}:`;
  await store.deletePrefix(prefix);

  try {
    await store.set({
      key: `${prefix}fresh`,
      kind: "security",
      data: { symbol: "VFV" },
      asOf: "2026-05-01T00:00:00.000Z",
      builtAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-05-01T00:10:00.000Z",
    });
    await store.set({
      key: `${prefix}expired`,
      kind: "security",
      data: { symbol: "XBB" },
      asOf: "2026-05-01T00:00:00.000Z",
      builtAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-05-01T00:00:01.000Z",
    });

    const deletedCount = await store.pruneExpired?.(
      Date.parse("2026-05-01T00:05:00.000Z"),
    );

    assert.equal(deletedCount, 1);
    assert.equal(await store.get(`${prefix}expired`), null);
    assert.deepEqual((await store.get(`${prefix}fresh`))?.data, {
      symbol: "VFV",
    });
  } finally {
    await store.deletePrefix(prefix);
  }
});

test("Loo Minister sync cache API requires a sync-capable store", () => {
  const asyncOnlyStore: LooMinisterContextPackStore = {
    async get() {
      return null;
    },
    async set() {},
    async clear() {},
    async deletePrefix() {},
    async stats() {
      return { total: 0, fresh: 0, stale: 0 };
    },
  };

  setLooMinisterContextPackStore(asyncOnlyStore);
  try {
    assert.throws(
      () =>
        getOrBuildContextPackSync({
          key: "sync:unsupported",
          kind: "project-knowledge",
          ttlMs: 1_000,
          build: () => [],
        }),
      /does not support getSync/,
    );
  } finally {
    setLooMinisterContextPackStore(createMemoryLooMinisterContextPackStore());
  }
});

test("Loo Minister postgres context pack store persists, upserts, and clears packs", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured.");
    return;
  }

  const db = getDb();
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "loo_minister_context_packs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "pack_key" varchar(360) NOT NULL,
        "pack_kind" varchar(40) NOT NULL,
        "payload_json" jsonb NOT NULL,
        "as_of" timestamp with time zone NOT NULL,
        "built_at" timestamp with time zone NOT NULL,
        "expires_at" timestamp with time zone NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "loo_minister_context_packs_key_idx"
        ON "loo_minister_context_packs" ("pack_key");
    `);
  } catch {
    t.skip("loo_minister_context_packs table is not available.");
    return;
  }

  const store = createPostgresLooMinisterContextPackStore();
  const prefix = `test:postgres:${Date.now()}:`;
  const key = `${prefix}security:vfv`;
  await store.deletePrefix(prefix);

  try {
    await store.set({
      key,
      kind: "security",
      data: { symbol: "VFV" },
      asOf: "2026-05-01T00:00:00.000Z",
      builtAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-05-01T00:01:00.000Z",
    });
    assert.deepEqual((await store.get(key))?.data, { symbol: "VFV" });

    await store.set({
      key,
      kind: "security",
      data: { symbol: "XEQT" },
      asOf: "2026-05-01T00:00:10.000Z",
      builtAt: "2026-05-01T00:00:10.000Z",
      expiresAt: "2026-05-01T00:02:00.000Z",
    });
    assert.deepEqual((await store.get(key))?.data, { symbol: "XEQT" });

    const stats = await store.stats(Date.parse("2026-05-01T00:01:30.000Z"));
    assert.ok(stats.total >= 1);
    assert.ok(stats.fresh >= 1);

    await store.deletePrefix(prefix);
    assert.equal(await store.get(key), null);
  } finally {
    await store.deletePrefix(prefix);
  }
});

test("Loo Minister context pack keys carry explicit invalidation dimensions", () => {
  assert.match(
    projectKnowledgePackKey({
      version: "v1",
      page: "overview",
      intent: "page:overview",
    }),
    /^projectKnowledgePack:v1:overview:/,
  );
  assert.equal(
    userPreferencePackKey("user_1", "2026-05-01T00:00:00.000Z"),
    "userPreferencePack:user_1:2026-05-01t00-00-00.000z",
  );
  assert.equal(
    latestRecommendationPackKey("user_1", "run_1"),
    "latestRecommendationPack:user_1:run_1",
  );
  assert.equal(
    securityContextPackKey({
      userId: "user_1",
      identity: "VFV|TSX|CAD",
      quoteUpdatedAt: "2026-05-01",
    }),
    "securityContextPack:user_1:vfv-tsx-cad:2026-05-01",
  );
  assert.equal(
    chatSubjectPackKey("session_1"),
    "chatSubjectPack:session_1:current",
  );
  assert.equal(
    globalUserContextPackKey({
      userId: "user_1",
      asOf: "2026-05-01T00:00:00.000Z",
    }),
    "globalUserContextPack:user_1:2026-05-01t00-00-00.000z",
  );
  assert.equal(
    externalIntelligencePackKey({
      userId: "user_1",
      identity: "security:VFV:TSX:CAD",
      quoteUpdatedAt: "2026-05-01T00:00:00.000Z",
    }),
    "externalIntelligencePack:user_1:security-vfv-tsx-cad:2026-05-01t00-00-00.000z",
  );
});
