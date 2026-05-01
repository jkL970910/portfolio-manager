import assert from "node:assert/strict";
import test from "node:test";
import {
  chatSubjectPackKey,
  clearLooMinisterContextPackCache,
  getOrBuildContextPack,
  getOrBuildContextPackSync,
  getLooMinisterContextPackCacheStats,
  latestRecommendationPackKey,
  projectKnowledgePackKey,
  securityContextPackKey,
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
