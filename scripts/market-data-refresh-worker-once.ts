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
  process.env.MARKET_DATA_REFRESH_WORKER_ID ??
  `market-data-worker-${process.pid}`;

async function main() {
  try {
    const { runMarketDataRefreshWorkerOnce } =
      await import("@/lib/backend/market-data-refresh-worker");
    const result = await runMarketDataRefreshWorkerOnce({
      workerId,
      maxUsers: readPositiveIntEnv("MARKET_DATA_REFRESH_MAX_USERS"),
      maxSymbols: readPositiveIntEnv("MARKET_DATA_REFRESH_MAX_SYMBOLS"),
      batchSize: readPositiveIntEnv("MARKET_DATA_REFRESH_BATCH_SIZE"),
      maxBatchesPerRun: readPositiveIntEnv(
        "MARKET_DATA_REFRESH_MAX_BATCHES_PER_RUN",
      ),
      maxRuntimeSeconds: readPositiveIntEnv(
        "MARKET_DATA_REFRESH_MAX_RUNTIME_SECONDS",
      ),
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Market-data refresh worker failed unexpectedly.";
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
