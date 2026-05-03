import assert from "node:assert/strict";
import test from "node:test";
import {
  chatSubjectPackKey,
  clearLooMinisterContextPackCache,
  clearLooMinisterContextPackCacheAsync,
  createMemoryLooMinisterContextPackStore,
  getOrBuildContextPack,
  getOrBuildContextPackSync,
  getLooMinisterContextPackCacheStats,
  getLooMinisterContextPackCacheStatsAsync,
  latestRecommendationPackKey,
  projectKnowledgePackKey,
  resetLooMinisterContextPackStore,
  securityContextPackKey,
  setLooMinisterContextPackStore,
  type LooMinisterContextPackStore,
  type LooMinisterStoredContextPack,
  userPreferencePackKey,
} from "@/lib/backend/loo-minister-context-pack-cache";

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

test("Loo Minister context pack keys carry explicit invalidation dimensions", () => {
  assert.match(
    projectKnowledgePackKey({
      version: "v1",
      page: "overview",
      question: "为什么总资产不同？",
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
    chatSubjectPackKey("session_1", "2026-05-01T00:00:00.000Z"),
    "chatSubjectPack:session_1:2026-05-01t00-00-00.000z",
  );
});
