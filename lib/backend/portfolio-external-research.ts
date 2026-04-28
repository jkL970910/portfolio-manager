import { PortfolioAnalyzerRequest } from "@/lib/backend/portfolio-analyzer-contracts";

export interface ExternalResearchPolicy {
  enabled: boolean;
  sourceMode: "cached-external";
  minTtlSeconds: number;
  requiresWorker: boolean;
  allowedScopes: PortfolioAnalyzerRequest["scope"][];
}

export const DEFAULT_EXTERNAL_RESEARCH_POLICY: ExternalResearchPolicy = {
  enabled: false,
  sourceMode: "cached-external",
  minTtlSeconds: 21600,
  requiresWorker: true,
  allowedScopes: ["security", "portfolio", "account", "recommendation-run"]
};

export function getExternalResearchPolicy(): ExternalResearchPolicy {
  return {
    ...DEFAULT_EXTERNAL_RESEARCH_POLICY,
    enabled: process.env.PORTFOLIO_ANALYZER_EXTERNAL_RESEARCH === "enabled"
  };
}

export function assertExternalResearchAllowed(input: PortfolioAnalyzerRequest) {
  if (!input.includeExternalResearch) {
    return;
  }

  const policy = getExternalResearchPolicy();
  if (!policy.enabled) {
    throw new Error(
      "External research is not enabled. Use local quick scan until cache and worker policy are configured."
    );
  }

  if (!policy.allowedScopes.includes(input.scope)) {
    throw new Error(`External research is not enabled for ${input.scope} analysis.`);
  }

  if (input.maxCacheAgeSeconds < policy.minTtlSeconds) {
    throw new Error(`External research requires a cache TTL of at least ${policy.minTtlSeconds} seconds.`);
  }
}
