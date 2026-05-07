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
] as const;

export type ExternalResearchSmokeSource =
  | "market-data"
  | "profile"
  | "institutional";

type ExternalResearchSmokeEnv = Record<string, string | undefined>;

export interface ExternalResearchSmokeArgs {
  userId: string;
  symbol: string;
  currency: "CAD" | "USD";
  exchange?: string;
  name?: string;
  securityId?: string;
  securityType?: string;
  maxCacheAgeSeconds: number;
  source?: ExternalResearchSmokeSource;
}

function getRequiredSourceFlag(source: ExternalResearchSmokeSource) {
  if (source === "profile") {
    return "PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_PROFILE";
  }
  if (source === "institutional") {
    return "PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_INSTITUTIONAL";
  }
  return "PORTFOLIO_ANALYZER_EXTERNAL_SOURCE_MARKET_DATA";
}

function getRequiredSourceSecrets(source: ExternalResearchSmokeSource) {
  return source === "profile" || source === "institutional"
    ? (["ALPHA_VANTAGE_API_KEY"] as const)
    : [];
}

export function getMissingExternalResearchSmokeFlags(
  env: ExternalResearchSmokeEnv = process.env,
  source: ExternalResearchSmokeSource = "market-data",
) {
  return [
    ...EXTERNAL_RESEARCH_SMOKE_REQUIRED_FLAGS,
    getRequiredSourceFlag(source),
  ].filter((flag) => env[flag] !== "enabled");
}

export function getMissingExternalResearchSmokeSecrets(
  env: ExternalResearchSmokeEnv = process.env,
  source: ExternalResearchSmokeSource = "market-data",
) {
  return getRequiredSourceSecrets(source).filter((secret) => !env[secret]);
}

export function assertExternalResearchSmokeEnvironment(
  env: ExternalResearchSmokeEnv = process.env,
  source: ExternalResearchSmokeSource = "market-data",
) {
  const missingFlags = getMissingExternalResearchSmokeFlags(env, source);
  const missingSecrets = getMissingExternalResearchSmokeSecrets(env, source);

  if (missingFlags.length > 0) {
    throw new Error(
      `External research smoke enqueue requires these env flags to be set to "enabled": ${missingFlags.join(", ")}.`,
    );
  }

  if (missingSecrets.length > 0) {
    throw new Error(
      `External research smoke enqueue requires these secrets to be configured: ${missingSecrets.join(", ")}.`,
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
  if (args.securityId?.trim()) {
    security.securityId = args.securityId.trim();
  }
  if (args.securityType?.trim()) {
    security.securityType = args.securityType.trim();
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
  assertExternalResearchSmokeEnvironment(
    process.env,
    args.source ?? "market-data",
  );

  return enqueueExternalResearchJob(
    args.userId,
    buildExternalResearchSmokeRequest(args),
    now,
  );
}
