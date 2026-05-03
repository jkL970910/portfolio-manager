import assert from "node:assert/strict";
import test from "node:test";
import {
  readPositiveWorkerLimit,
  verifyWorkerApiRequest,
} from "@/lib/backend/worker-api-auth";

function makeRequest(headers: Record<string, string | undefined>) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
  };
}

test("worker API auth rejects when no secret is configured", () => {
  const previousSecret = process.env.PORTFOLIO_WORKER_SECRET;
  delete process.env.PORTFOLIO_WORKER_SECRET;
  delete process.env.WORKER_CRON_SECRET;
  delete process.env.CRON_SECRET;

  const result = verifyWorkerApiRequest(makeRequest({}));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 503);
    assert.match(result.error, /PORTFOLIO_WORKER_SECRET/);
  }

  if (previousSecret) {
    process.env.PORTFOLIO_WORKER_SECRET = previousSecret;
  }
});

test("worker API auth accepts bearer or x-worker-secret", () => {
  const previousSecret = process.env.PORTFOLIO_WORKER_SECRET;
  process.env.PORTFOLIO_WORKER_SECRET = "test-worker-secret-12345";

  assert.deepEqual(
    verifyWorkerApiRequest(
      makeRequest({ authorization: "Bearer test-worker-secret-12345" }),
    ),
    { ok: true },
  );
  assert.deepEqual(
    verifyWorkerApiRequest(
      makeRequest({ "x-worker-secret": "test-worker-secret-12345" }),
    ),
    { ok: true },
  );

  const rejected = verifyWorkerApiRequest(
    makeRequest({ authorization: "Bearer wrong-secret" }),
  );
  assert.equal(rejected.ok, false);
  if (!rejected.ok) {
    assert.equal(rejected.status, 401);
  }

  if (previousSecret) {
    process.env.PORTFOLIO_WORKER_SECRET = previousSecret;
  } else {
    delete process.env.PORTFOLIO_WORKER_SECRET;
  }
});

test("worker limit parser uses query before env and rejects invalid values", () => {
  const previousLimit = process.env.MARKET_DATA_REFRESH_MAX_USERS;
  process.env.MARKET_DATA_REFRESH_MAX_USERS = "3";

  assert.equal(
    readPositiveWorkerLimit("5", "MARKET_DATA_REFRESH_MAX_USERS"),
    5,
  );
  assert.equal(
    readPositiveWorkerLimit(null, "MARKET_DATA_REFRESH_MAX_USERS"),
    3,
  );
  assert.throws(
    () => readPositiveWorkerLimit("0", "MARKET_DATA_REFRESH_MAX_USERS"),
    /positive integer/,
  );

  if (previousLimit) {
    process.env.MARKET_DATA_REFRESH_MAX_USERS = previousLimit;
  } else {
    delete process.env.MARKET_DATA_REFRESH_MAX_USERS;
  }
});
