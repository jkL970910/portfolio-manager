import {
  AnalyzerSecurityIdentity,
  PortfolioAnalyzerRequest,
} from "@/lib/backend/portfolio-analyzer-contracts";
import { enqueueExternalResearchJob } from "@/lib/backend/external-research-jobs";

export const EXTERNAL_RESEARCH_SMOKE_REQUIRED_FLAGS = [
  "PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH",
  "PORTFOLIO_ANALYZER_EXTERNAL_WORKER",
  "PORTFOLIO_ANALYZER_EXTERNAL_PROVIDERS",
  "PORTFOLIO_ANALYZER_EXTERNAL_ADAPTERS",
  "PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA",
] as const;

type ExternalResearchSmokeEnv = Record<string, string | undefined>;

export interface ExternalResearchSmokeArgs {
  userId: string;
  symbol: string;
  currency: "CAD" | "USD";
  exchange?: string;
  name?: string;
  maxCacheAgeSeconds: number;
}

export function getMissingExternalResearchSmokeFlags(
  env: ExternalResearchSmokeEnv = process.env,
) {
  return EXTERNAL_RESEARCH_SMOKE_REQUIRED_FLAGS.filter(
    (flag) => env[flag] !== "enabled",
  );
}

export function assertExternalResearchSmokeEnvironment(
  env: ExternalResearchSmokeEnv = process.env,
) {
  const missingFlags = getMissingExternalResearchSmokeFlags(env);

  if (missingFlags.length > 0) {
    throw new Error(
      `External research smoke enqueue requires these env flags to be set to "enabled": ${missingFlags.join(", ")}.`,
    );
  }
}

export function buildExternalResearchSmokeRequest(
  args: ExternalResearchSmokeArgs,
): PortfolioAnalyzerRequest {
  const security: AnalyzerSecurityIdentity = {
    symbol: args.symbol.trim().toUpperCase(),
    currency: args.currency,
  };
  const exchange = args.exchange?.trim().toUpperCase();
  const name = args.name?.trim();

  if (exchange) {
    security.exchange = exchange;
  }

  if (name) {
    security.name = name;
  }

  return {
    scope: "security",
    mode: "quick",
    security,
    cacheStrategy: "prefer-cache",
    maxCacheAgeSeconds: args.maxCacheAgeSeconds,
    includeExternalResearch: true,
  };
}

export async function enqueueExternalResearchSmokeJob(
  args: ExternalResearchSmokeArgs,
  now = new Date(),
) {
  assertExternalResearchSmokeEnvironment();

  return enqueueExternalResearchJob(
    args.userId,
    buildExternalResearchSmokeRequest(args),
    now,
  );
}
