import type { CurrencyCode } from "@/lib/backend/models";

const IBKR_FLEX_BASE_URL =
  "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService";

const FLEX_STATEMENT_REQUEST_ERROR =
  /<ErrorCode>([^<]+)<\/ErrorCode>[\s\S]*?<ErrorMessage>([^<]+)<\/ErrorMessage>/i;

export type IbkrFlexPreviewHolding = {
  symbol: string;
  description: string;
  currency: CurrencyCode;
  quantity: number;
  price: number | null;
  marketValue: number | null;
  assetCategory: string;
  exchange: string | null;
  identityStatus: "ready" | "needs_review" | "skipped";
  warnings: string[];
};

export type IbkrFlexPreviewAccount = {
  accountId: string;
  accountType: string;
  currency: CurrencyCode;
  netLiquidation: number | null;
  cash: number | null;
  holdings: IbkrFlexPreviewHolding[];
};

export type BrokerageImportPreviewProvider = "ibkr-flex" | "snaptrade";

export type BrokerageImportPreview = {
  draftId?: string;
  provider: BrokerageImportPreviewProvider;
  generatedAt: string;
  referenceCode: string;
  accountCount: number;
  holdingCount: number;
  accounts: IbkrFlexPreviewAccount[];
  summary: {
    title: string;
    subtitle: string;
    warnings: string[];
  };
};

export type IbkrFlexPreview = BrokerageImportPreview & {
  provider: "ibkr-flex";
};

export type FetchIbkrFlexPreviewInput = {
  token: string;
  queryId: string;
};

export async function fetchIbkrFlexPreview(
  input: FetchIbkrFlexPreviewInput,
): Promise<IbkrFlexPreview> {
  const token = input.token.trim();
  const queryId = input.queryId.trim();
  if (!token || !queryId) {
    throw new Error("IBKR Flex Token 和 Query ID 都不能为空。");
  }

  const referenceCode = await requestFlexStatementReference({
    token,
    queryId,
  });
  const xml = await fetchFlexStatementXml({ token, referenceCode });
  return parseIbkrFlexStatement(xml, referenceCode);
}

async function requestFlexStatementReference(input: {
  token: string;
  queryId: string;
}) {
  const url = new URL(`${IBKR_FLEX_BASE_URL}/SendRequest`);
  url.searchParams.set("t", input.token);
  url.searchParams.set("q", input.queryId);
  url.searchParams.set("v", "3");

  const response = await fetch(url, {
    headers: { Accept: "application/xml,text/xml,*/*" },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`IBKR Flex 请求失败：HTTP ${response.status}`);
  }

  const error = parseFlexError(body);
  if (error) {
    throw new Error(`IBKR Flex 请求失败：${error}`);
  }

  const referenceCode =
    getFirstTagText(body, "ReferenceCode") ??
    getFirstTagText(body, "Reference");
  if (!referenceCode) {
    throw new Error("IBKR Flex 没有返回 reference code，请检查 Query ID。");
  }
  return referenceCode;
}

async function fetchFlexStatementXml(input: {
  token: string;
  referenceCode: string;
}) {
  const url = new URL(`${IBKR_FLEX_BASE_URL}/GetStatement`);
  url.searchParams.set("t", input.token);
  url.searchParams.set("q", input.referenceCode);
  url.searchParams.set("v", "3");

  const response = await fetch(url, {
    headers: { Accept: "application/xml,text/xml,*/*" },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`IBKR Flex Statement 拉取失败：HTTP ${response.status}`);
  }

  const error = parseFlexError(body);
  if (error) {
    throw new Error(`IBKR Flex Statement 拉取失败：${error}`);
  }
  if (!/<FlexStatement\b/i.test(body)) {
    throw new Error("IBKR Flex 返回内容不是 Statement XML。");
  }
  return body;
}

export function parseIbkrFlexStatement(
  xml: string,
  referenceCode = "local-preview",
): IbkrFlexPreview {
  const statementBlocks = matchElements(xml, "FlexStatement");
  const fallbackAccountId = getAttribute(xml, "accountId") ?? "IBKR";

  const accounts =
    statementBlocks.length > 0
      ? statementBlocks.map((block) => parseFlexStatementAccount(block))
      : [parseFlexStatementAccount(xml, fallbackAccountId)];

  const normalizedAccounts = accounts.filter(
    (account) => account.holdings.length > 0 || account.netLiquidation != null,
  );
  const holdingCount = normalizedAccounts.reduce(
    (sum, account) => sum + account.holdings.length,
    0,
  );

  return {
    provider: "ibkr-flex",
    draftId: undefined,
    generatedAt: new Date().toISOString(),
    referenceCode,
    accountCount: normalizedAccounts.length,
    holdingCount,
    accounts: normalizedAccounts,
    summary: {
      title: `读取到 ${normalizedAccounts.length} 个 IBKR 账户`,
      subtitle: `${holdingCount} 个持仓已进入预览；当前不会写入主账本。`,
      warnings: buildPreviewWarnings(normalizedAccounts),
    },
  };
}

function parseFlexStatementAccount(
  statementXml: string,
  fallbackAccountId = "IBKR",
): IbkrFlexPreviewAccount {
  const accountId =
    getAttribute(statementXml, "accountId") ??
    getFirstAttribute(statementXml, "EquitySummaryInBase", "accountId") ??
    getFirstAttribute(statementXml, "CashReportCurrency", "accountId") ??
    fallbackAccountId;
  const currency = normalizeCurrency(
    getAttribute(statementXml, "currency") ??
      getFirstAttribute(statementXml, "EquitySummaryInBase", "currency") ??
      getFirstAttribute(statementXml, "CashReportCurrency", "currency"),
  );
  const accountType =
    getAttribute(statementXml, "accountType") ??
    getFirstAttribute(statementXml, "AccountInformation", "accountType") ??
    "IBKR";
  const netLiquidation =
    getFirstNumericAttribute(statementXml, "EquitySummaryInBase", [
      "netLiquidation",
      "total",
      "endingValue",
    ]) ??
    getFirstNumericAttribute(statementXml, "EquitySummaryByReportDateInBase", [
      "netLiquidation",
      "total",
      "endingValue",
    ]);
  const cash =
    getFirstNumericAttribute(statementXml, "CashReportCurrency", [
      "total",
      "endingCash",
      "cash",
    ]) ??
    getFirstNumericAttribute(statementXml, "CashReport", [
      "total",
      "endingCash",
      "cash",
    ]);

  return {
    accountId,
    accountType,
    currency,
    netLiquidation,
    cash,
    holdings: parseOpenPositions(statementXml),
  };
}

function parseOpenPositions(xml: string): IbkrFlexPreviewHolding[] {
  return matchSelfClosingElements(xml, "OpenPosition")
    .map((element) => {
      const quantity = parseFlexNumber(
        getAttribute(element, "position") ??
          getAttribute(element, "quantity") ??
          getAttribute(element, "qty"),
      );
      const symbol =
        getAttribute(element, "symbol") ??
        getAttribute(element, "underlyingSymbol") ??
        "";
      if (!symbol || quantity == null || quantity === 0) {
        return null;
      }

      const exchange =
        getAttribute(element, "listingExchange") ??
        getAttribute(element, "exchange") ??
        null;
      const warnings = buildHoldingWarnings({
        assetCategory: getAttribute(element, "assetCategory") ?? "Unknown",
        exchange,
        price:
          parseFlexNumber(getAttribute(element, "markPrice")) ??
          parseFlexNumber(getAttribute(element, "costPrice")),
        marketValue: parseFlexNumber(getAttribute(element, "positionValue")),
      });

      const holding: IbkrFlexPreviewHolding = {
        symbol: symbol.toUpperCase(),
        description:
          getAttribute(element, "description") ??
          getAttribute(element, "issuer") ??
          symbol.toUpperCase(),
        currency: normalizeCurrency(getAttribute(element, "currency")),
        quantity,
        price:
          parseFlexNumber(getAttribute(element, "markPrice")) ??
          parseFlexNumber(getAttribute(element, "costPrice")),
        marketValue: parseFlexNumber(getAttribute(element, "positionValue")),
        assetCategory: getAttribute(element, "assetCategory") ?? "Unknown",
        exchange,
        identityStatus: warnings.length > 0 ? "needs_review" : "ready",
        warnings,
      };
      return holding;
    })
    .filter((holding): holding is IbkrFlexPreviewHolding => holding != null);
}

function buildHoldingWarnings(input: {
  assetCategory: string;
  exchange: string | null;
  price: number | null;
  marketValue: number | null;
}) {
  const warnings: string[] = [];
  const exchange = input.exchange?.trim().toUpperCase() ?? "";
  if (!exchange) {
    warnings.push("缺少交易所，确认写入前需要先补齐标的映射。");
  }
  if (exchange === "SMART") {
    warnings.push("IBKR 返回 SMART 路由，不是实际上市交易所。");
  }
  if (input.marketValue == null) {
    warnings.push("缺少市值。");
  }
  if (input.price == null) {
    warnings.push("缺少最新价格。");
  }
  if (!/^(STK|ETF|FUND)$/i.test(input.assetCategory)) {
    warnings.push(`资产类型 ${input.assetCategory} 可能需要人工确认。`);
  }
  return warnings;
}

function buildPreviewWarnings(accounts: IbkrFlexPreviewAccount[]) {
  const warnings: string[] = [];
  if (accounts.length === 0) {
    warnings.push("没有读取到账户。请确认 Flex Query 包含 Open Positions。");
  }
  const holdingCount = accounts.reduce(
    (sum, account) => sum + account.holdings.length,
    0,
  );
  if (holdingCount === 0) {
    warnings.push(
      "没有读取到持仓。请在 IBKR Flex Query 中启用 Open Positions。",
    );
  }
  const unknownCurrencyCount = accounts
    .flatMap((account) => account.holdings)
    .filter((holding) => !["CAD", "USD"].includes(holding.currency)).length;
  if (unknownCurrencyCount > 0) {
    warnings.push("部分持仓币种不是 CAD/USD，正式写入前需要人工确认。");
  }
  warnings.push("当前是预览模式：不会保存 Flex Token，也不会写入主账本。");
  return warnings;
}

function parseFlexError(xml: string) {
  const match = FLEX_STATEMENT_REQUEST_ERROR.exec(xml);
  if (!match) {
    return null;
  }
  return `${match[1]} ${decodeXml(match[2] ?? "")}`;
}

function matchElements(xml: string, tag: string) {
  return Array.from(
    xml.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi")),
  ).map((match) => match[0] ?? "");
}

function matchSelfClosingElements(xml: string, tag: string) {
  return Array.from(xml.matchAll(new RegExp(`<${tag}\\b[^>]*/>`, "gi"))).map(
    (match) => match[0] ?? "",
  );
}

function getFirstTagText(xml: string, tag: string) {
  const match = new RegExp(`<${tag}\\b[^>]*>([^<]*)<\\/${tag}>`, "i").exec(xml);
  return match?.[1] ? decodeXml(match[1]).trim() : null;
}

function getFirstAttribute(xml: string, tag: string, attribute: string) {
  const match = new RegExp(`<${tag}\\b[^>]*`, "i").exec(xml);
  return match?.[0] ? getAttribute(match[0], attribute) : null;
}

function getFirstNumericAttribute(
  xml: string,
  tag: string,
  attributes: string[],
) {
  for (const attribute of attributes) {
    const value = parseFlexNumber(getFirstAttribute(xml, tag, attribute));
    if (value != null) {
      return value;
    }
  }
  return null;
}

function getAttribute(element: string, attribute: string) {
  const match = new RegExp(`${attribute}="([^"]*)"`, "i").exec(element);
  return match?.[1] ? decodeXml(match[1]).trim() : null;
}

function parseFlexNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrency(value: string | null | undefined): CurrencyCode {
  const normalized = value?.trim().toUpperCase();
  return normalized === "USD" ? "USD" : "CAD";
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}
