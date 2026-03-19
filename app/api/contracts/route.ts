import { NextResponse } from "next/server";

const contracts = {
  version: "0.5.0",
  entities: [
    "UserProfile",
    "InvestmentAccount",
    "HoldingPosition",
    "CashflowTransaction",
    "PreferenceProfile",
    "RecommendationRun",
    "ImportJob"
  ],
  readEndpoints: [
    {
      path: "/api/dashboard",
      method: "GET",
      description: "Dashboard view model with summary cards, overview modules, and recommendation summary."
    },
    {
      path: "/api/portfolio",
      method: "GET",
      description: "Portfolio analytics view with performance, exposures, holdings, and recommendation bridge context."
    },
    {
      path: "/api/recommendations",
      method: "GET",
      description: "Recommendation view with transparent inputs, ranked items, notes, and latest run metadata."
    },
    {
      path: "/api/spending",
      method: "GET",
      description: "Spending view with category summary, transaction context, and investable cash framing."
    },
    {
      path: "/api/import",
      method: "GET",
      description: "Import flow model plus latest import job state."
    },
    {
      path: "/api/settings/preferences",
      method: "GET",
      description: "Preference configuration screen model plus current saved preference profile."
    }
  ],
  plannedMutations: [
    {
      path: "/api/auth/register",
      methods: ["POST"],
      description: "Create a local credentials-backed user and provision default onboarding records."
    },
    {
      path: "/api/import/jobs",
      methods: ["POST"],
      description: "Create a new import job, optionally validate and parse uploaded CSV content with field mapping, then replace or merge user-scoped accounts, holdings, and transactions."
    },
    {
      path: "/api/settings/preferences",
      methods: ["PATCH"],
      description: "Persist changes to the investment preference profile."
    },
    {
      path: "/api/recommendations/runs",
      methods: ["POST"],
      description: "Generate a new recommendation run from current holdings and preferences."
    }
  ]
};

export async function GET() {
  return NextResponse.json(contracts);
}
