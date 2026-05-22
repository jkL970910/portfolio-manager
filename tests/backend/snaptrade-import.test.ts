import assert from "node:assert/strict";
import test from "node:test";
import { buildSnapTradePreview } from "@/lib/backend/import/snaptrade";

test("builds SnapTrade preview from connection-scoped accounts and positions", () => {
  const preview = buildSnapTradePreview({
    connections: [
      {
        id: "auth-1",
        brokerage: { display_name: "Wealthsimple", slug: "WEALTHSIMPLE" },
        disabled: false,
      },
    ],
    accountsByConnection: {
      "auth-1": [
        {
          id: "account-1",
          number: "TFSA-1234",
          institution_name: "Wealthsimple",
          raw_type: "TFSA",
          account_category: "INVESTMENT",
          is_paper: false,
          balance: { total: { amount: 12500.25, currency: "CAD" } },
          brokerage_authorization: "auth-1",
          name: "TFSA",
          created_date: "2026-01-01T00:00:00Z",
          sync_status: {},
        },
      ],
    },
    positionsByAccount: {
      "account-1": [
        {
          instrument: {
            kind: "etf",
            id: "zqq",
            symbol: "ZQQ.TO",
            raw_symbol: "ZQQ",
            description: "BMO Nasdaq 100 Equity Hedged",
            currency: "CAD",
            exchange: "XTSE",
          },
          units: "10",
          price: "140.12",
          currency: "CAD",
        },
      ],
    },
  });

  assert.equal(preview.provider, "snaptrade");
  assert.equal(preview.accountCount, 1);
  assert.equal(preview.holdingCount, 1);
  assert.equal(preview.accounts[0]?.accountType, "TFSA");
  assert.equal(preview.accounts[0]?.netLiquidation, 12500.25);
  assert.equal(preview.accounts[0]?.holdings[0]?.symbol, "ZQQ");
  assert.equal(preview.accounts[0]?.holdings[0]?.assetCategory, "ETF");
  assert.equal(preview.accounts[0]?.holdings[0]?.exchange, "XTSE");
  assert.equal(preview.accounts[0]?.holdings[0]?.identityStatus, "ready");
});

test("preserves SnapTrade TSX suffix when raw symbol is unavailable", () => {
  const preview = buildSnapTradePreview({
    connections: [
      {
        id: "auth-1",
        brokerage: { display_name: "Wealthsimple", slug: "WEALTHSIMPLE" },
        disabled: false,
      },
    ],
    accountsByConnection: {
      "auth-1": [
        {
          id: "account-1",
          number: "TFSA-1234",
          institution_name: "Wealthsimple",
          raw_type: "TFSA",
          account_category: "INVESTMENT",
          is_paper: false,
          balance: { total: { amount: 12500.25, currency: "CAD" } },
          brokerage_authorization: "auth-1",
          name: "TFSA",
          created_date: "2026-01-01T00:00:00Z",
          sync_status: {},
        },
      ],
    },
    positionsByAccount: {
      "account-1": [
        {
          instrument: {
            kind: "etf",
            id: "vfv",
            symbol: "VFV.TO",
            description: "Vanguard S&P 500 Index ETF",
            currency: "CAD",
            exchange: "XTSE",
          },
          units: "10",
          price: "140.12",
          currency: "CAD",
        },
      ],
    },
  });

  assert.equal(preview.accounts[0]?.holdings[0]?.symbol, "VFV.TO");
  assert.equal(preview.accounts[0]?.holdings[0]?.exchange, "XTSE");
  assert.equal(preview.accounts[0]?.holdings[0]?.currency, "CAD");
});

test("marks SnapTrade positions without exchange as needing review", () => {
  const preview = buildSnapTradePreview({
    connections: [
      {
        id: "auth-1",
        brokerage: { display_name: "Wealthsimple", slug: "WEALTHSIMPLE" },
        disabled: false,
      },
    ],
    accountsByConnection: {
      "auth-1": [
        {
          id: "account-1",
          number: "RRSP-1234",
          institution_name: "Wealthsimple",
          raw_type: "RRSP",
          account_category: "INVESTMENT",
          is_paper: false,
          balance: { total: { amount: 5000, currency: "CAD" } },
          brokerage_authorization: "auth-1",
          name: "RRSP",
          created_date: "2026-01-01T00:00:00Z",
          sync_status: {},
        },
      ],
    },
    positionsByAccount: {
      "account-1": [
        {
          instrument: {
            kind: "stock",
            id: "aaoi",
            symbol: "AAOI",
            raw_symbol: "AAOI",
            description: "Applied Optoelectronics Inc",
            currency: "USD",
            exchange: null,
          },
          units: "3",
          price: "17.5",
          currency: "USD",
        },
      ],
    },
  });

  assert.equal(preview.holdingCount, 1);
  assert.equal(
    preview.accounts[0]?.holdings[0]?.identityStatus,
    "needs_review",
  );
  assert.match(preview.accounts[0]?.holdings[0]?.warnings[0] ?? "", /交易所/);
});
