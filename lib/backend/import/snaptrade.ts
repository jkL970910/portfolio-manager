import { Snaptrade } from "snaptrade-typescript-sdk";
import type {
  Account,
  AccountPosition,
  BrokerageAuthorization,
  Position,
} from "snaptrade-typescript-sdk";
import type { CurrencyCode } from "@/lib/backend/models";
import type {
  BrokerageImportPreview,
  IbkrFlexPreviewAccount,
  IbkrFlexPreviewHolding,
} from "@/lib/backend/import/ibkr-flex";
import { resolveSnapTradeApiCredentials } from "@/lib/backend/external-service-credentials";

type SnapTradeCredential = {
  snapTradeUserId: string;
  userSecret: string;
};

type SnapTradePortalInput = {
  reconnectAuthorizationId?: string | null;
  customRedirect?: string | null;
};

type SnapTradePortal = {
  redirectUri: string;
  sessionId: string | null;
};

const SNAPTRADE_PROVIDER = "snaptrade";
const DEFAULT_SNAPTRADE_TTL_DAYS = 365;

export type SnapTradePreview = BrokerageImportPreview & {
  provider: "snaptrade";
};

export type SnapTradePreviewInput = {
  connections: BrokerageAuthorization[];
  accountsByConnection: Record<string, Account[]>;
  positionsByAccount: Record<string, Array<AccountPosition | Position>>;
};

export function getSnapTradeConnectionTtlDays() {
  const parsed = Number(process.env.SNAPTRADE_CONNECTION_TTL_DAYS);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(Math.trunc(parsed), 3650)
    : DEFAULT_SNAPTRADE_TTL_DAYS;
}

export function buildSnapTradeUserId(userId: string) {
  return `loo-${userId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export async function isSnapTradeConfigured(userId?: string | null) {
  return Boolean(await resolveSnapTradeApiCredentials(userId));
}

export async function getSnapTradeClient(userId?: string | null) {
  const credentials = await resolveSnapTradeApiCredentials(userId);
  if (!credentials) {
    throw new Error(
      "SnapTrade 尚未配置。请先在设置页保存 SnapTrade Client ID 和 Consumer Key；没有用户凭证时才会使用 Vercel 服务端兜底凭证。",
    );
  }
  return new Snaptrade({
    clientId: credentials.clientId,
    consumerKey: credentials.consumerKey,
    basePath: process.env.SNAPTRADE_BASE_URL?.trim() || undefined,
  });
}

export async function registerSnapTradeCredential(
  userId: string,
): Promise<SnapTradeCredential> {
  const snapTradeUserId = buildSnapTradeUserId(userId);
  const client = await getSnapTradeClient(userId);
  const response = await client.authentication.registerSnapTradeUser({
    userId: snapTradeUserId,
  });
  const userSecret = response.data.userSecret;
  if (!userSecret) {
    throw new Error("SnapTrade 注册没有返回 userSecret。");
  }
  return { snapTradeUserId, userSecret };
}

export async function createSnapTradeConnectionPortal(
  credential: SnapTradeCredential,
  input: SnapTradePortalInput = {},
  appUserId?: string | null,
): Promise<SnapTradePortal> {
  const client = await getSnapTradeClient(appUserId);
  const response = await client.authentication.loginSnapTradeUser({
    userId: credential.snapTradeUserId,
    userSecret: credential.userSecret,
    reconnect: input.reconnectAuthorizationId ?? undefined,
    customRedirect: input.customRedirect ?? undefined,
    connectionType: "read",
    showCloseButton: true,
    darkMode: true,
    connectionPortalVersion: "v4",
  });
  const data = response.data;
  const redirectUri =
    typeof data === "string"
      ? data
      : "redirectURI" in data
        ? data.redirectURI
        : null;
  if (!redirectUri) {
    throw new Error("SnapTrade 没有返回连接入口链接。");
  }
  return {
    redirectUri,
    sessionId:
      typeof data === "object" && "sessionId" in data
        ? (data.sessionId ?? null)
        : null,
  };
}

export async function fetchSnapTradePreview(
  credential: SnapTradeCredential,
  appUserId?: string | null,
): Promise<SnapTradePreview> {
  const client = await getSnapTradeClient(appUserId);
  const connectionsResponse =
    await client.connections.listBrokerageAuthorizations({
      userId: credential.snapTradeUserId,
      userSecret: credential.userSecret,
    });
  const connections = connectionsResponse.data.filter(
    (connection) => !connection.disabled,
  );
  const accounts = (
    await Promise.all(
      connections.map(async (connection) =>
        fetchConnectionAccounts(client, credential, connection),
      ),
    )
  ).flat();
  return buildSnapTradePreview(
    {
      connections,
      accountsByConnection: {},
      positionsByAccount: {},
    },
    accounts,
  );
}

export function buildSnapTradePreview(
  input: SnapTradePreviewInput,
  prebuiltAccounts?: IbkrFlexPreviewAccount[],
): SnapTradePreview {
  const connections = input.connections.filter(
    (connection) => !connection.disabled,
  );
  const accounts =
    prebuiltAccounts ??
    connections.flatMap((connection) => {
      const connectionId = connection.id ?? "";
      const brokerageName = getBrokerageName(connection) ?? "SnapTrade";
      return (input.accountsByConnection[connectionId] ?? []).map((account) =>
        mapSnapTradeAccount(
          account,
          brokerageName,
          input.positionsByAccount[account.id] ?? [],
        ),
      );
    });
  const holdingCount = accounts.reduce(
    (sum, account) => sum + account.holdings.length,
    0,
  );
  const brokerageNames = Array.from(
    new Set(
      connections
        .map((connection) => getBrokerageName(connection))
        .filter((name): name is string => Boolean(name)),
    ),
  );

  return {
    provider: SNAPTRADE_PROVIDER,
    draftId: undefined,
    generatedAt: new Date().toISOString(),
    referenceCode: `snaptrade:${connections.map((item) => item.id).join(",")}`,
    accountCount: accounts.length,
    holdingCount,
    accounts,
    summary: {
      title: `读取到 ${accounts.length} 个 SnapTrade 账户`,
      subtitle: `${holdingCount} 个持仓已进入草稿；确认后才会写入主账本。`,
      warnings: buildSnapTradeWarnings({
        connectionCount: connections.length,
        accounts,
        brokerageNames,
      }),
    },
  };
}

async function fetchConnectionAccounts(
  client: Snaptrade,
  credential: SnapTradeCredential,
  connection: BrokerageAuthorization,
): Promise<IbkrFlexPreviewAccount[]> {
  if (!connection.id) {
    return [];
  }
  const accountsResponse =
    await client.connections.listBrokerageAuthorizationAccounts({
      authorizationId: connection.id,
      userId: credential.snapTradeUserId,
      userSecret: credential.userSecret,
    });
  const brokerageName = getBrokerageName(connection) ?? "SnapTrade";

  return Promise.all(
    accountsResponse.data
      .filter((account) => account.account_category !== "DEPOSIT")
      .map(async (account) => {
        const positions = await fetchAccountPositions(
          client,
          credential,
          account.id,
        );
        return mapSnapTradeAccount(account, brokerageName, positions);
      }),
  );
}

async function fetchAccountPositions(
  client: Snaptrade,
  credential: SnapTradeCredential,
  accountId: string,
) {
  try {
    const response = await client.accountInformation.getAllAccountPositions({
      accountId,
      userId: credential.snapTradeUserId,
      userSecret: credential.userSecret,
    });
    return response.data.results ?? [];
  } catch {
    const response = await client.accountInformation.getUserAccountPositions({
      accountId,
      userId: credential.snapTradeUserId,
      userSecret: credential.userSecret,
    });
    return response.data;
  }
}

function mapSnapTradeAccount(
  account: Account,
  brokerageName: string,
  positions: Array<AccountPosition | Position>,
): IbkrFlexPreviewAccount {
  const total = account.balance?.total;
  const currency = normalizeCurrency(total?.currency);
  const holdings = positions
    .map(mapSnapTradePosition)
    .filter((holding): holding is IbkrFlexPreviewHolding => holding != null);

  return {
    accountId:
      account.institution_account_id ??
      account.number ??
      account.id ??
      `${brokerageName} Account`,
    accountType: account.raw_type ?? account.name ?? brokerageName,
    currency,
    netLiquidation: normalizeNumber(total?.amount),
    cash: null,
    holdings,
  };
}

function mapSnapTradePosition(
  position: AccountPosition | Position,
): IbkrFlexPreviewHolding | null {
  const instrument = getPositionInstrument(position);
  const symbol =
    getString(instrument?.raw_symbol) ?? getString(instrument?.symbol);
  const quantity = normalizeNumber("units" in position ? position.units : null);
  if (!symbol || quantity == null || quantity === 0) {
    return null;
  }

  const description =
    getString(instrument?.description) ??
    getLegacyPositionDescription(position) ??
    symbol;
  const price = normalizeNumber(position.price);
  const currency = normalizeCurrency(
    getString(instrument?.currency) ??
      ("currency" in position ? getCurrencyCode(position.currency) : null) ??
      getString(position.currency),
  );
  const exchange = getString(instrument?.exchange);
  const assetCategory = mapInstrumentKind(getString(instrument?.kind));
  const marketValue =
    price != null && quantity != null ? round(price * quantity, 2) : null;
  const avgCostPerShare =
    normalizeNumber("cost_basis" in position ? position.cost_basis : null) ??
    normalizeNumber(
      "average_purchase_price" in position
        ? position.average_purchase_price
        : null,
    );
  const costBasis =
    avgCostPerShare != null && quantity > 0
      ? round(avgCostPerShare * quantity, 2)
      : marketValue != null && normalizeNumber("open_pnl" in position ? position.open_pnl : null) != null
        ? round(marketValue - normalizeNumber("open_pnl" in position ? position.open_pnl : null)!, 2)
        : null;
  const warnings = buildSnapTradeHoldingWarnings({
    exchange,
    price,
    marketValue,
    assetCategory,
  });

  return {
    symbol: symbol.toUpperCase(),
    description,
    currency,
    quantity,
    price,
    marketValue,
    avgCostPerShare,
    costBasis,
    assetCategory,
    exchange,
    identityStatus: warnings.length > 0 ? "needs_review" : "ready",
    warnings,
  };
}

function getPositionInstrument(position: AccountPosition | Position) {
  if ("instrument" in position && position.instrument) {
    return position.instrument as Record<string, unknown>;
  }
  if ("symbol" in position && position.symbol?.symbol) {
    return position.symbol.symbol as Record<string, unknown>;
  }
  return null;
}

function getLegacyPositionDescription(position: AccountPosition | Position) {
  if ("symbol" in position) {
    return getString(position.symbol?.description);
  }
  return null;
}

function buildSnapTradeHoldingWarnings(input: {
  exchange: string | null;
  price: number | null;
  marketValue: number | null;
  assetCategory: string;
}) {
  const warnings: string[] = [];
  if (!input.exchange) {
    warnings.push("SnapTrade 没有返回交易所，写入前需要人工确认标的映射。");
  }
  if (input.price == null) {
    warnings.push("缺少最新价格。");
  }
  if (input.marketValue == null) {
    warnings.push("缺少市值。");
  }
  if (!/^(STK|ETF|FUND|CRYPTO|BOND|METAL)$/i.test(input.assetCategory)) {
    warnings.push(`资产类型 ${input.assetCategory} 可能需要人工确认。`);
  }
  return warnings;
}

function buildSnapTradeWarnings(input: {
  connectionCount: number;
  accounts: IbkrFlexPreviewAccount[];
  brokerageNames: string[];
}) {
  const warnings: string[] = [];
  if (input.connectionCount === 0) {
    warnings.push("还没有 SnapTrade 券商连接。请先打开连接入口并完成授权。");
  }
  if (input.accounts.length === 0) {
    warnings.push("没有读取到账户。请确认 Wealthsimple 授权已完成。");
  }
  const holdingCount = input.accounts.reduce(
    (sum, account) => sum + account.holdings.length,
    0,
  );
  if (holdingCount === 0) {
    warnings.push(
      "没有读取到持仓。可能是账户暂未同步或 SnapTrade 只返回了现金。",
    );
  }
  const needsReview = input.accounts
    .flatMap((account) => account.holdings)
    .filter((holding) => holding.identityStatus !== "ready").length;
  if (needsReview > 0) {
    warnings.push(`${needsReview} 个持仓需要补齐交易所或价格后才能写入账本。`);
  }
  const brokerages = input.brokerageNames.join("、");
  warnings.push(
    brokerages
      ? `来源：${brokerages} via SnapTrade。当前是预览草稿，不会自动覆盖账本。`
      : "来源：SnapTrade。当前是预览草稿，不会自动覆盖账本。",
  );
  return warnings;
}

function getBrokerageName(connection: BrokerageAuthorization) {
  return (
    connection.brokerage?.display_name ??
    connection.brokerage?.name ??
    connection.name ??
    null
  );
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getCurrencyCode(value: unknown) {
  if (typeof value === "string") {
    return getString(value);
  }
  if (value && typeof value === "object" && "code" in value) {
    return getString((value as { code?: unknown }).code);
  }
  return null;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrency(value: string | null | undefined): CurrencyCode {
  return value?.trim().toUpperCase() === "USD" ? "USD" : "CAD";
}

function mapInstrumentKind(value: string | null) {
  switch (value) {
    case "stock":
    case "adr":
      return "STK";
    case "etf":
    case "cef":
      return "ETF";
    case "mutualfund":
      return "FUND";
    case "crypto":
      return "CRYPTO";
    case "future":
      return "FUT";
    default:
      return value?.toUpperCase() || "Unknown";
  }
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
