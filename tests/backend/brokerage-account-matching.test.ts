import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSingleBrokerageMatch,
  getBrokerageSourceAccountIds,
  isSameBrokerageLineage,
  mergeBrokerageSourceAccountAliases,
} from "@/lib/backend/import/brokerage-account-matching";

test("uses stable brokerage account id first and keeps aliases for migration", () => {
  const sourceIds = getBrokerageSourceAccountIds({
    accountId: "snaptrade-account-id",
    accountAliases: ["WS-TFSA-1234", "TFSA", "WS-TFSA-1234"],
    accountType: "TFSA",
    currency: "CAD",
    netLiquidation: null,
    cash: null,
    holdings: [],
  });

  assert.deepEqual(sourceIds, ["snaptrade-account-id", "WS-TFSA-1234", "TFSA"]);
});

test("matches renamed accounts through stored brokerage lineage", () => {
  assert.equal(
    isSameBrokerageLineage(
      {
        importSourceProvider: "snaptrade",
        importSourceAccountId: "snaptrade-account-id",
      },
      "snaptrade",
      "snaptrade-account-id",
    ),
    true,
  );
});

test("dedupes alias matches that point to the same saved account", () => {
  const match = assertSingleBrokerageMatch(
    [
      { id: "account-row-1", importSourceProvider: "snaptrade" },
      { id: "account-row-1", importSourceProvider: "snaptrade" },
      null,
    ],
    "snaptrade-account-id",
  );

  assert.equal(match?.id, "account-row-1");
});

test("rejects aliases that match different saved accounts", () => {
  assert.throws(
    () =>
      assertSingleBrokerageMatch(
        [
          { id: "account-row-1", importSourceProvider: "snaptrade" },
          { id: "account-row-2", importSourceProvider: "snaptrade" },
        ],
        "snaptrade-account-id",
      ),
    /matches multiple saved accounts/i,
  );
});

test("merges persisted brokerage aliases with the latest provider ids", () => {
  const aliases = mergeBrokerageSourceAccountAliases(
    {
      importSourceAccountId: "snaptrade-account-id",
      importSourceAccountAliases: ["snaptrade-account-id", "old-account-number"],
    },
    ["new-primary-id", "old-account-number", "TFSA"],
  );

  assert.deepEqual(aliases, [
    "new-primary-id",
    "old-account-number",
    "TFSA",
    "snaptrade-account-id",
  ]);
});
