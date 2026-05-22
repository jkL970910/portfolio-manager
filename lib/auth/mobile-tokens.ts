import { jwtVerify, SignJWT } from "jose";
import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getRepositories } from "@/lib/backend/repositories/factory";
import { getAuthenticatedUserId, getViewerByUserId, type Viewer } from "@/lib/auth/session";

type MobileTokenType = "access" | "refresh";

type MobileTokenPayload = {
  sub: string;
  type: MobileTokenType;
  email: string;
  displayName: string;
  jti?: string;
};

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function getAuthSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-auth-secret-change-me");
}

function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function signMobileToken(
  viewer: Viewer,
  type: MobileTokenType,
  ttlSeconds: number,
  tokenId?: string,
) {
  return new SignJWT({
    email: viewer.email,
    displayName: viewer.displayName,
    type,
    ...(tokenId ? { jti: tokenId } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(viewer.id)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getAuthSecret());
}

export async function issueMobileAuthTokens(viewer: Viewer) {
  const accessToken = await signMobileToken(viewer, "access", ACCESS_TOKEN_TTL_SECONDS);
  const refreshTokenId = randomUUID();
  const refreshToken = await signMobileToken(
    viewer,
    "refresh",
    REFRESH_TOKEN_TTL_SECONDS,
    refreshTokenId,
  );
  await getRepositories().mobileRefreshTokens.create({
    userId: viewer.id,
    tokenId: refreshTokenId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
  });

  return {
    accessToken,
    accessTokenExpiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
    refreshToken,
    refreshTokenExpiresInSeconds: REFRESH_TOKEN_TTL_SECONDS,
    tokenType: "Bearer" as const,
  };
}

export async function verifyMobileToken(token: string, expectedType: MobileTokenType) {
  const verified = await jwtVerify<MobileTokenPayload>(token, getAuthSecret());
  if (verified.payload.type !== expectedType) {
    throw new Error("Invalid token type.");
  }
  return verified.payload;
}

export async function verifyMobileRefreshToken(token: string) {
  const payload = await verifyMobileToken(token, "refresh");
  if (!payload.jti) {
    throw new Error("Refresh token is missing server id.");
  }
  const record = await getRepositories().mobileRefreshTokens.getByTokenId(
    payload.jti,
  );
  if (
    !record ||
    record.userId !== payload.sub ||
    record.revokedAt ||
    Date.parse(record.expiresAt) <= Date.now() ||
    record.tokenHash !== hashRefreshToken(token)
  ) {
    throw new Error("Refresh token was revoked or is invalid.");
  }
  return payload;
}

export async function revokeMobileRefreshToken(token: string) {
  const payload = await verifyMobileToken(token, "refresh");
  if (payload.jti) {
    await getRepositories().mobileRefreshTokens.revoke(payload.jti, new Date());
  }
}

export async function rotateMobileRefreshToken(token: string) {
  const payload = await verifyMobileRefreshToken(token);
  if (payload.jti) {
    await getRepositories().mobileRefreshTokens.revoke(payload.jti, new Date());
  }
  return payload;
}

function readBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function getMobileViewerFromRequest(request: NextRequest): Promise<Viewer | null> {
  const bearerToken = readBearerToken(request);
  if (bearerToken) {
    try {
      const payload = await verifyMobileToken(bearerToken, "access");
      if (!payload.sub) {
        return null;
      }
      return getViewerByUserId(payload.sub);
    } catch {
      return null;
    }
  }

  const sessionUserId = await getAuthenticatedUserId();
  if (!sessionUserId) {
    return null;
  }

  return getViewerByUserId(sessionUserId);
}
