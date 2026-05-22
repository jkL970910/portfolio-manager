import assert from "node:assert/strict";
import test from "node:test";

import { recordMobileSecurityObservation } from "@/lib/backend/services";
import { mockRepositories } from "@/lib/backend/repositories/mock-repositories";

test("security observations reuse canonical identity and remove naked ticker duplicates", async () => {
  const userId = "user_demo";
  const symbol = `QAOBS${Date.now()}`;

  const naked = await recordMobileSecurityObservation(userId, {
    symbol,
    source: "search",
  });
  assert.equal(naked.exchange, null);
  assert.equal(naked.currency, null);

  const canonical = await recordMobileSecurityObservation(userId, {
    symbol,
    exchange: "NASDAQ",
    currency: "USD",
    name: "QA Observation Inc.",
    source: "security-detail",
  });
  assert.equal(canonical.exchange, "NASDAQ");
  assert.equal(canonical.currency, "USD");
  assert.ok(canonical.securityId);

  const reused = await recordMobileSecurityObservation(userId, {
    symbol,
    source: "search",
  });
  assert.equal(reused.securityId, canonical.securityId);
  assert.equal(reused.exchange, "NASDAQ");
  assert.equal(reused.currency, "USD");

  const observations =
    await mockRepositories.mobileSecurityObservations.listByUserAndSymbol(
      userId,
      symbol,
    );
  assert.equal(observations.length, 1);
  assert.equal(observations[0]?.exchange, "NASDAQ");
  assert.equal(observations[0]?.currency, "USD");
});
