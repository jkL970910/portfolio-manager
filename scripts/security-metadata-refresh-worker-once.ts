import { config } from "dotenv";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) {
  config({ path: ".env.local", quiet: true });
} else if (existsSync(".env")) {
  config({ path: ".env", quiet: true });
}

function readPositiveIntEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

const workerId =
  process.env.SECURITY_METADATA_WORKER_ID ??
  `security-metadata-worker-${process.pid}`;

function readSymbolListEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

async function main() {
  try {
    const { runSecurityMetadataRefreshWorkerOnce } = await import(
      "@/lib/backend/security-metadata-worker"
    );
    const result = await runSecurityMetadataRefreshWorkerOnce({
      workerId,
      maxSecurities: readPositiveIntEnv(
        "SECURITY_METADATA_REFRESH_MAX_SECURITIES",
      ),
      maxAgeDays: readPositiveIntEnv("SECURITY_METADATA_REFRESH_MAX_AGE_DAYS"),
      symbols: readSymbolListEnv("SECURITY_METADATA_REFRESH_SYMBOLS"),
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Security metadata refresh worker failed unexpectedly.";
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
