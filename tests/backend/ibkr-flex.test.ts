import assert from "node:assert/strict";
import test from "node:test";
import { parseIbkrFlexStatement } from "@/lib/backend/import/ibkr-flex";

test("parses IBKR Flex open positions into preview accounts", () => {
  const xml = `
    <FlexQueryResponse>
      <FlexStatements count="1">
        <FlexStatement accountId="U1234567" accountType="Individual" currency="CAD">
          <EquitySummaryInBase accountId="U1234567" currency="CAD" netLiquidation="12345.67" />
          <CashReportCurrency accountId="U1234567" currency="CAD" endingCash="234.56" />
          <OpenPositions>
            <OpenPosition symbol="AAPL" description="APPLE INC" assetCategory="STK" currency="USD" position="10" markPrice="190.25" positionValue="1902.5" listingExchange="NASDAQ" />
            <OpenPosition symbol="VFV" description="VANGUARD S&amp;P 500 INDEX ETF" assetCategory="ETF" currency="CAD" position="22" markPrice="145.3" positionValue="3196.6" listingExchange="TSE" />
          </OpenPositions>
        </FlexStatement>
      </FlexStatements>
    </FlexQueryResponse>`;

  const preview = parseIbkrFlexStatement(xml, "abc123");

  assert.equal(preview.provider, "ibkr-flex");
  assert.equal(preview.referenceCode, "abc123");
  assert.equal(preview.accountCount, 1);
  assert.equal(preview.holdingCount, 2);
  assert.equal(preview.accounts[0]?.accountId, "U1234567");
  assert.equal(preview.accounts[0]?.currency, "CAD");
  assert.equal(preview.accounts[0]?.netLiquidation, 12345.67);
  assert.equal(preview.accounts[0]?.holdings[0]?.symbol, "AAPL");
  assert.equal(preview.accounts[0]?.holdings[0]?.currency, "USD");
  assert.equal(preview.accounts[0]?.holdings[0]?.identityStatus, "ready");
  assert.equal(
    preview.accounts[0]?.holdings[1]?.description,
    "VANGUARD S&P 500 INDEX ETF",
  );
});

test("ignores zero-quantity IBKR Flex positions", () => {
  const xml = `
    <FlexStatement accountId="U7654321" currency="USD">
      <OpenPosition symbol="MSFT" assetCategory="STK" currency="USD" position="0" markPrice="400" positionValue="0" />
      <OpenPosition symbol="VOO" assetCategory="ETF" currency="USD" position="3" markPrice="500" positionValue="1500" />
    </FlexStatement>`;

  const preview = parseIbkrFlexStatement(xml);

  assert.equal(preview.holdingCount, 1);
  assert.equal(preview.accounts[0]?.holdings[0]?.symbol, "VOO");
});

test("marks IBKR Flex positions without exchange as needing review", () => {
  const xml = `
    <FlexStatement accountId="U7654321" currency="USD">
      <OpenPosition symbol="QQQ" assetCategory="ETF" currency="USD" position="4" markPrice="450" positionValue="1800" />
    </FlexStatement>`;

  const preview = parseIbkrFlexStatement(xml);

  assert.equal(preview.holdingCount, 1);
  assert.equal(
    preview.accounts[0]?.holdings[0]?.identityStatus,
    "needs_review",
  );
  assert.match(preview.accounts[0]?.holdings[0]?.warnings[0] ?? "", /交易所/);
});

test("marks IBKR Flex SMART routed positions as needing review", () => {
  const xml = `
    <FlexStatement accountId="U7654321" currency="USD">
      <OpenPosition symbol="AAPL" assetCategory="STK" currency="USD" position="4" markPrice="180" positionValue="720" listingExchange="SMART" />
    </FlexStatement>`;

  const preview = parseIbkrFlexStatement(xml);

  assert.equal(preview.holdingCount, 1);
  assert.equal(
    preview.accounts[0]?.holdings[0]?.identityStatus,
    "needs_review",
  );
  assert.match(preview.accounts[0]?.holdings[0]?.warnings[0] ?? "", /SMART/);
});
