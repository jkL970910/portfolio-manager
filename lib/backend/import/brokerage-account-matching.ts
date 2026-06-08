import type { IbkrFlexPreviewAccount } from "@/lib/backend/import/ibkr-flex";

export type BrokerageLineageRow = {
  id: string;
  importSourceProvider?: string | null;
  importSourceAccountId?: string | null;
  importSourceAccountAliases?: unknown;
};

export function getBrokerageSourceAccountIds(account: IbkrFlexPreviewAccount) {
  return Array.from(
    new Set(
      [account.accountId, ...(account.accountAliases ?? [])]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export function isSameBrokerageLineage(
  row: {
    importSourceProvider?: string | null;
    importSourceAccountId?: string | null;
  },
  provider: string,
  sourceAccountId: string,
) {
  return (
    row.importSourceProvider === provider &&
    row.importSourceAccountId === sourceAccountId
  );
}

export function uniqueBrokerageRows<T extends BrokerageLineageRow>(
  rows: Array<T | null | undefined>,
) {
  const byId = new Map<string, T>();
  for (const row of rows) {
    if (row) {
      byId.set(row.id, row);
    }
  }
  return Array.from(byId.values());
}

export function assertSingleBrokerageMatch<T extends BrokerageLineageRow>(
  rows: Array<T | null | undefined>,
  sourceAccountId: string,
) {
  const uniqueRows = uniqueBrokerageRows(rows);
  if (uniqueRows.length > 1) {
    throw new Error(
      `Brokerage account ${sourceAccountId} matches multiple saved accounts. Merge or unlink the duplicates before syncing.`,
    );
  }
  return uniqueRows[0] ?? null;
}

export function getBrokerageStoredAccountAliases(
  row: { importSourceAccountAliases?: unknown },
) {
  return Array.isArray(row.importSourceAccountAliases)
    ? row.importSourceAccountAliases
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
}

export function mergeBrokerageSourceAccountAliases(
  row: { importSourceAccountId?: string | null; importSourceAccountAliases?: unknown },
  sourceAccountIds: string[],
) {
  return Array.from(
    new Set(
      [
        ...sourceAccountIds,
        row.importSourceAccountId ?? null,
        ...getBrokerageStoredAccountAliases(row),
      ]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}
