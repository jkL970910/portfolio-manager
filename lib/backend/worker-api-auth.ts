import crypto from "node:crypto";

type WorkerRequestLike = {
  headers: {
    get(name: string): string | null;
  };
};

type WorkerApiAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

function readConfiguredSecret() {
  return (
    process.env.PORTFOLIO_WORKER_SECRET?.trim() ||
    process.env.WORKER_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

function readRequestSecret(request: WorkerRequestLike) {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization) {
    const [scheme, token] = authorization.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token?.trim()) {
      return token.trim();
    }
  }

  return request.headers.get("x-worker-secret")?.trim() ?? "";
}

function timingSafeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyWorkerApiRequest(
  request: WorkerRequestLike,
): WorkerApiAuthResult {
  const configuredSecret = readConfiguredSecret();
  if (configuredSecret.length < 16) {
    return {
      ok: false,
      status: 503,
      error:
        "Worker API is not configured. Set PORTFOLIO_WORKER_SECRET before enabling cloud scheduling.",
    };
  }

  const requestSecret = readRequestSecret(request);
  if (!requestSecret || !timingSafeEquals(requestSecret, configuredSecret)) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized worker request.",
    };
  }

  return { ok: true };
}

export function readPositiveWorkerLimit(
  value: string | null,
  envName: string,
): number | undefined {
  const candidate = value?.trim() || process.env[envName]?.trim();
  if (!candidate) {
    return undefined;
  }
  const parsed = Number(candidate);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${envName} must be a positive integer.`);
  }
  return parsed;
}
