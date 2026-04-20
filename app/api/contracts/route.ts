import { NextResponse } from "next/server";

const contracts = {
  version: "1.0.0",
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
      description: "Dashboard view model with summary cards, recommendation summary, and portfolio health score preview."
    },
    {
      path: "/api/portfolio",
      method: "GET",
      description: "Portfolio analytics view with performance, exposures, holdings, recommendation bridge context, and detailed health score diagnostics."
    },
    {
      path: "/api/recommendations",
      method: "GET",
      description: "Recommendation view with transparent inputs, structured ranked items, V2 confidence metadata, and latest run rationale."
    },
    {
      path: "/api/spending",
      method: "GET",
      description: "Spending view with category summary, transaction context, and investable cash framing."
    },
    {
      path: "/api/import",
      method: "GET",
      description: "Import flow model with separate portfolio and spending workflow state."
    },
    {
      path: "/api/import/presets",
      method: "GET",
      description: "List user-scoped CSV field mapping presets saved in the database."
    },
    {
      path: "/api/settings/preferences",
      method: "GET",
      description: "Preference configuration screen model plus current saved preference profile."
    },
    {
      path: "/api/settings/guided-draft",
      method: "GET",
      description: "Read the saved guided allocation questionnaire draft for the signed-in user."
    },
    {
      path: "/api/market-data/search",
      method: "GET",
      description: "Search securities by symbol or company name through the configured market-data provider layer."
    },
    {
      path: "/api/market-data/resolve",
      method: "GET",
      description: "Normalize a symbol into a canonical security identity, preferring OpenFIGI when configured."
    },
    {
      path: "/api/market-data/quote",
      method: "GET",
      description: "Fetch the latest available quote through the configured market-data provider layer."
    },
    {
      path: "/api/market-data/quotes",
      method: "GET",
      description: "Fetch latest available quotes for multiple symbols through the configured market-data provider layer."
    },
    {
      path: "/api/settings/watchlist",
      method: "POST / DELETE",
      description: "Add or remove a single symbol from the signed-in user's watchlist without resubmitting the full preference profile."
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
      description: "Legacy generic import endpoint kept for compatibility."
    },
    {
      path: "/api/import/portfolio/jobs",
      methods: ["POST"],
      description: "Validate and confirm portfolio CSV imports for accounts and holdings only. Supports account_currency, holding_currency, and native amount fields. For holding rows, market_value is treated as the explicit total value and overrides quantity x last_price when both are present."
    },
    {
      path: "/api/import/spending/jobs",
      methods: ["POST"],
      description: "Validate and confirm spending CSV imports for transaction rows only."
    },
    {
      path: "/api/import/presets",
      methods: ["POST"],
      description: "Create or update a database-backed CSV field mapping preset for the signed-in user."
    },
    {
      path: "/api/import/guided",
      methods: ["POST"],
      description: "Create an account-level guided onboarding record, optionally seed a starter holding, or use the guided single-account CSV path to validate and confirm a real import."
    },
    {
      path: "/api/import/presets/[presetId]",
      methods: ["PATCH", "DELETE"],
      description: "Rename, update, or delete a user-scoped CSV mapping preset stored in the database."
    },
    {
      path: "/api/settings/preferences",
      methods: ["PATCH"],
      description: "Persist changes to the investment preference profile."
    },
    {
      path: "/api/settings/guided-draft",
      methods: ["PATCH"],
      description: "Persist a guided allocation questionnaire draft separately from the live preference profile."
    },
    {
      path: "/api/settings/display-currency",
      methods: ["PATCH"],
      description: "Update the signed-in user's global display currency between CAD and USD for dashboard, portfolio, recommendations, and spending views."
    },
    {
      path: "/api/settings/display-language",
      methods: ["PATCH"],
      description: "Update the global display language between Chinese and English, persisting the preference for signed-in users and also writing a cookie for unauthenticated entry surfaces."
    },
    {
      path: "/api/recommendations/runs",
      methods: ["POST"],
      description: "Generate a new V2 recommendation run from current holdings and preferences, including structured rationale and placement metadata."
    },
    {
      path: "/api/recommendations/candidate-score",
      methods: ["POST"],
      description: "Score a manually selected security candidate against the current portfolio, watchlist, account-fit, tax-fit, and FX-friction rules."
    },
    {
      path: "/api/recommendations/candidate-compare",
      methods: ["POST"],
      description: "Compare multiple candidate securities side by side using the same recommendation-style score model."
    },
    {
      path: "/api/portfolio/refresh-prices",
      methods: ["POST"],
      description: "Refresh user-scoped holding prices in bulk, persist updated market value and gain/loss, and recompute account weights."
    }
  ]
};

export async function GET() {
  return NextResponse.json(contracts);
}
