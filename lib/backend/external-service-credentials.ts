import crypto from "node:crypto";
import { eq } from "drizzle-orm";

import { apiSuccess } from "@/lib/backend/contracts";
import type { ExternalServiceCredentialsInputPayload } from "@/lib/backend/payload-schemas";
import { getDb } from "@/lib/db/client";
import { externalServiceCredentials } from "@/lib/db/schema";

export type ExternalServiceId = "snaptrade";

export interface ResolvedSnapTradeApiCredentials {
  clientId: string;
  consumerKey: string;
  source: "user" | "server";
}

export interface MobileExternalServiceCredentialsView {
  snaptrade: {
    clientIdConfigured: boolean;
    clientId: string | null;
    consumerKeyConfigured: boolean;
    consumerKeyLast4: string | null;
    serverCredentialsAvailable: boolean;
    effectiveSource: "user" | "server" | "none";
    statusLabel: string;
    privacyNote: string;
  };
}

function getEncryptionKey() {
  const secret =
    process.env.EXTERNAL_SERVICE_CREDENTIALS_ENCRYPTION_SECRET ||
    process.env.BROKERAGE_CONNECTION_ENCRYPTION_SECRET ||
    process.env.LOO_MINISTER_ENCRYPTION_SECRET ||
    process.env.AUTH_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "External service credential encryption requires EXTERNAL_SERVICE_CREDENTIALS_ENCRYPTION_SECRET, BROKERAGE_CONNECTION_ENCRYPTION_SECRET, LOO_MINISTER_ENCRYPTION_SECRET, or AUTH_SECRET.",
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecret(secret: string) {
  const normalized = secret.trim();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  return {
    encryptedSecret: encrypted.toString("base64"),
    secretIv: iv.toString("base64"),
    secretAuthTag: cipher.getAuthTag().toString("base64"),
    secretLast4: normalized.slice(-4),
  };
}

function decryptSecret(row: {
  encryptedSecret: string | null;
  secretIv: string | null;
  secretAuthTag: string | null;
}) {
  if (!row.encryptedSecret || !row.secretIv || !row.secretAuthTag) {
    return null;
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(row.secretIv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(row.secretAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.encryptedSecret, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function serverSnapTradeCredentialsAvailable() {
  return Boolean(
    process.env.SNAPTRADE_CLIENT_ID?.trim() &&
      process.env.SNAPTRADE_CONSUMER_KEY?.trim(),
  );
}

async function getCredentialRow(userId: string, service: ExternalServiceId) {
  return getDb().query.externalServiceCredentials.findFirst({
    where: (table, { and }) =>
      and(eq(table.userId, userId), eq(table.service, service)),
  });
}

export async function resolveSnapTradeApiCredentials(
  userId?: string | null,
): Promise<ResolvedSnapTradeApiCredentials | null> {
  if (userId) {
    const row = await getCredentialRow(userId, "snaptrade");
    const userSecret = row ? decryptSecret(row) : null;
    if (row?.clientId?.trim() && userSecret) {
      return {
        clientId: row.clientId.trim(),
        consumerKey: userSecret,
        source: "user",
      };
    }
  }

  const clientId = process.env.SNAPTRADE_CLIENT_ID?.trim();
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY?.trim();
  if (clientId && consumerKey) {
    return { clientId, consumerKey, source: "server" };
  }
  return null;
}

export async function getMobileExternalServiceCredentials(userId: string) {
  const row = await getCredentialRow(userId, "snaptrade");
  const userConfigured = Boolean(row?.clientId && row.secretLast4);
  const serverConfigured = serverSnapTradeCredentialsAvailable();
  const effectiveSource: MobileExternalServiceCredentialsView["snaptrade"]["effectiveSource"] =
    userConfigured ? "user" : serverConfigured ? "server" : "none";

  return apiSuccess<MobileExternalServiceCredentialsView>(
    {
      snaptrade: {
        clientIdConfigured: Boolean(row?.clientId),
        clientId: row?.clientId ?? null,
        consumerKeyConfigured: Boolean(row?.secretLast4),
        consumerKeyLast4: row?.secretLast4 ?? null,
        serverCredentialsAvailable: serverConfigured,
        effectiveSource,
        statusLabel:
          effectiveSource === "user"
            ? "使用你的 SnapTrade 凭证"
            : effectiveSource === "server"
              ? "使用 Loo国服务端凭证"
              : "尚未配置 SnapTrade",
        privacyNote:
          "Wealthsimple 同步会优先使用你保存的 SnapTrade Client ID 和 Consumer Key；未配置时才使用 Loo国服务端兜底凭证。",
      },
    },
    "database",
  );
}

export async function updateMobileExternalServiceCredentials(
  userId: string,
  payload: ExternalServiceCredentialsInputPayload,
) {
  if (payload.service !== "snaptrade") {
    throw new Error("Unsupported external service.");
  }

  const db = getDb();
  const existing = await getCredentialRow(userId, "snaptrade");
  const now = new Date();

  if (payload.clearCredentials) {
    if (existing) {
      await db
        .delete(externalServiceCredentials)
        .where(eq(externalServiceCredentials.id, existing.id));
    }
    return getMobileExternalServiceCredentials(userId);
  }

  const encrypted = payload.consumerKey
    ? encryptSecret(payload.consumerKey)
    : null;
  const values = {
    userId,
    service: payload.service,
    clientId: payload.clientId?.trim() ?? existing?.clientId ?? null,
    ...(encrypted
      ? {
          ...encrypted,
          secretUpdatedAt: now,
        }
      : {}),
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(externalServiceCredentials)
      .set(values)
      .where(eq(externalServiceCredentials.id, existing.id));
  } else {
    await db.insert(externalServiceCredentials).values({
      ...values,
      createdAt: now,
    });
  }

  return getMobileExternalServiceCredentials(userId);
}
