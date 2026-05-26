import assert from "node:assert/strict";
import test from "node:test";

import {
  getMobileViewerFromRequest,
  issueMobileAuthTokens,
  rotateMobileRefreshToken,
  verifyMobileRefreshToken,
  revokeMobileRefreshToken,
} from "@/lib/auth/mobile-tokens";
import type { Viewer } from "@/lib/auth/session";

const viewer: Viewer = {
  id: "user_demo",
  email: "jiekun@example.com",
  displayName: "Jiekun Liu",
  baseCurrency: "CAD",
  displayLanguage: "zh",
};

test("mobile refresh tokens are server-tracked and single-use after rotation", async () => {
  const tokens = await issueMobileAuthTokens(viewer);

  const verified = await verifyMobileRefreshToken(tokens.refreshToken);
  assert.equal(verified.sub, viewer.id);
  assert.equal(verified.type, "refresh");
  assert.ok(verified.jti);

  const rotated = await rotateMobileRefreshToken(tokens.refreshToken);
  assert.equal(rotated.sub, viewer.id);

  await assert.rejects(
    () => verifyMobileRefreshToken(tokens.refreshToken),
    /revoked|invalid/i,
  );
});

test("mobile logout revokes the current refresh token", async () => {
  const tokens = await issueMobileAuthTokens(viewer);

  await revokeMobileRefreshToken(tokens.refreshToken);

  await assert.rejects(
    () => verifyMobileRefreshToken(tokens.refreshToken),
    /revoked|invalid/i,
  );
});

test("mobile API auth does not fall back to browser cookie sessions", async () => {
  const request = {
    headers: {
      get() {
        return null;
      },
    },
  };

  assert.equal(await getMobileViewerFromRequest(request as never), null);
});
