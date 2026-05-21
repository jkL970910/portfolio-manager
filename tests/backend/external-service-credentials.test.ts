import assert from "node:assert/strict";
import test from "node:test";

import { resolveSnapTradeApiCredentials } from "@/lib/backend/external-service-credentials";

test("resolves SnapTrade server credentials as fallback when no user credential is requested", async () => {
  const previousClientId = process.env.SNAPTRADE_CLIENT_ID;
  const previousConsumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
  process.env.SNAPTRADE_CLIENT_ID = "server-client";
  process.env.SNAPTRADE_CONSUMER_KEY = "server-consumer";

  try {
    const credentials = await resolveSnapTradeApiCredentials(null);
    assert.deepEqual(credentials, {
      clientId: "server-client",
      consumerKey: "server-consumer",
      source: "server",
    });
  } finally {
    if (previousClientId == null) {
      delete process.env.SNAPTRADE_CLIENT_ID;
    } else {
      process.env.SNAPTRADE_CLIENT_ID = previousClientId;
    }
    if (previousConsumerKey == null) {
      delete process.env.SNAPTRADE_CONSUMER_KEY;
    } else {
      process.env.SNAPTRADE_CONSUMER_KEY = previousConsumerKey;
    }
  }
});

test("returns null when SnapTrade has neither user nor server credentials", async () => {
  const previousClientId = process.env.SNAPTRADE_CLIENT_ID;
  const previousConsumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
  delete process.env.SNAPTRADE_CLIENT_ID;
  delete process.env.SNAPTRADE_CONSUMER_KEY;

  try {
    assert.equal(await resolveSnapTradeApiCredentials(null), null);
  } finally {
    if (previousClientId != null) {
      process.env.SNAPTRADE_CLIENT_ID = previousClientId;
    }
    if (previousConsumerKey != null) {
      process.env.SNAPTRADE_CONSUMER_KEY = previousConsumerKey;
    }
  }
});
