import { config } from "dotenv";
import { existsSync } from "node:fs";

function loadEnv() {
  if (existsSync(".env.local")) {
    config({ path: ".env.local", quiet: true });
  } else if (existsSync(".env")) {
    config({ path: ".env", quiet: true });
  }
}

interface ParsedArgs {
  help: boolean;
  userId?: string;
  symbol: string;
  currency: "CAD" | "USD";
  exchange?: string;
  name?: string;
  securityId?: string;
  securityType?: string;
  source: "market-data" | "profile";
  maxCacheAgeSeconds: number;
}

function printUsage() {
  console.log(`Usage:
  npm run worker:external-research:enqueue-smoke -- --user-id <uuid> [options]

Options:
  --user-id <uuid>                 Required unless EXTERNAL_RESEARCH_SMOKE_USER_ID is set.
  --symbol <symbol>                Security symbol. Default: VFV
  --currency <CAD|USD>             Trading currency. Default: CAD
  --exchange <exchange>            Listing exchange, for identity separation. Example: TSX
  --name <name>                    Optional display name.
  --security-id <uuid>             Optional canonical security_id for strict identity matching.
  --security-type <type>           Optional security type. Example: Common Stock, ETF
  --source <market-data|profile>   External research source. Default: market-data
  --max-cache-age-seconds <int>    Cache TTL. Default: 21600
  --help                           Show this help.

Required env flags:
  PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH=enabled
  PORTFOLIO_ANALYZER_EXTERNAL_WORKER=enabled
  PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS=enabled
  PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS=enabled
  PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA=enabled for --source market-data
  PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE=enabled and ALPHA_VANTAGE_API_KEY for --source profile

This only enqueues a job. External provider calls happen later when you run npm run worker:external-research:once.`);
}

function readOption(argv: string[], flag: string) {
  const index = argv.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function parseCurrency(value: string | undefined): "CAD" | "USD" {
  const normalized = (value ?? "CAD").trim().toUpperCase();
  if (normalized !== "CAD" && normalized !== "USD") {
    throw new Error("--currency must be CAD or USD.");
  }

  return normalized;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${value} is not a positive integer.`);
  }

  return parsed;
}

function parseSource(value: string | undefined): "market-data" | "profile" {
  const normalized = (value ?? "market-data").trim().toLowerCase();
  if (normalized !== "market-data" && normalized !== "profile") {
    throw new Error("--source must be market-data or profile.");
  }
  return normalized;
}

function parseArgs(argv: string[]): ParsedArgs {
  const help = argv.includes("--help") || argv.includes("-h");
  return {
    help,
    userId:
      readOption(argv, "--user-id") ??
      process.env.EXTERNAL_RESEARCH_SMOKE_USER_ID,
    symbol: readOption(argv, "--symbol") ?? "VFV",
    currency: parseCurrency(readOption(argv, "--currency")),
    exchange: readOption(argv, "--exchange"),
    name: readOption(argv, "--name"),
    securityId: readOption(argv, "--security-id"),
    securityType: readOption(argv, "--security-type"),
    source: parseSource(readOption(argv, "--source")),
    maxCacheAgeSeconds: parsePositiveInteger(
      readOption(argv, "--max-cache-age-seconds"),
      21600,
    ),
  };
}

async function main() {
  loadEnv();

  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printUsage();
    return;
  }

  if (!parsed.userId) {
    throw new Error(
      "Missing --user-id or EXTERNAL_RESEARCH_SMOKE_USER_ID. Use a real local user id so the queued job satisfies database foreign keys.",
    );
  }

  const { enqueueExternalResearchSmokeJob } = await import(
    "@/lib/backend/external-research-smoke"
  );
  const result = await enqueueExternalResearchSmokeJob({
    userId: parsed.userId,
    symbol: parsed.symbol,
    currency: parsed.currency,
    exchange: parsed.exchange,
    name: parsed.name,
    securityId: parsed.securityId,
    securityType: parsed.securityType,
    source: parsed.source,
    maxCacheAgeSeconds: parsed.maxCacheAgeSeconds,
  });

  console.log(
    JSON.stringify(
      {
        status: "queued",
        source: parsed.source,
        job: result.data.job,
        nextCommand: "npm run worker:external-research:once",
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  const message =
    error instanceof Error
      ? error.message
      : "External research smoke enqueue failed unexpectedly.";
  console.error(message);
  process.exitCode = 1;
});
