import type { SecurityDecisionAnalysis } from "@/lib/backend/security-decision/types";
import { buildSecurityDecisionContext } from "@/lib/backend/security-decision/context";
import { buildSecurityDecisionNarrative } from "@/lib/backend/security-decision/context";

export function evaluateSecurityDecision(args: Parameters<typeof buildSecurityDecisionContext>[0]): SecurityDecisionAnalysis {
  const context = buildSecurityDecisionContext(args);
  const narrative = buildSecurityDecisionNarrative(context);
  return {
    context,
    ...narrative,
  };
}

