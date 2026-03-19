import {
  DashboardData,
  ImportData,
  PortfolioData,
  RecommendationsData,
  SettingsData,
  SpendingData
} from "@/lib/contracts";

const USER_KEY_BY_ID: Record<string, "demo" | "casey"> = {
  user_demo: "demo",
  user_casey: "casey",
  "11111111-1111-4111-8111-111111111111": "demo",
  "22222222-2222-4222-8222-222222222222": "casey"
};

const dashboardByUser: Record<"demo" | "casey", DashboardData> = {
  demo: {
    metrics: [
      { label: "Total Portfolio", value: "$412,300", detail: "+4.1% vs last quarter" },
      { label: "Available Room", value: "$24,500", detail: "TFSA and RRSP remaining room" },
      { label: "Portfolio Risk", value: "Moderate", detail: "Within configured tolerance band" },
      { label: "Portfolio Health Score", value: "P1", detail: "Preview radar ships after scoring logic" }
    ],
    accounts: [
      { name: "TFSA", caption: "Tax-free growth sleeve", value: "$128,400", room: "$9,100 room left", badge: "Priority", badgeVariant: "primary" },
      { name: "RRSP", caption: "Long-horizon retirement sleeve", value: "$201,200", room: "$15,400 room left", badge: "Tax fit", badgeVariant: "success" },
      { name: "Taxable", caption: "Flexible capital account", value: "$82,700", room: "No tax shelter", badge: "Review", badgeVariant: "warning" }
    ],
    drift: [
      { assetClass: "Fixed Income", current: "12%", target: "20%", delta: "-8%" },
      { assetClass: "US Equity", current: "36%", target: "32%", delta: "+4%" },
      { assetClass: "Canadian Equity", current: "24%", target: "22%", delta: "+2%" }
    ],
    assetMix: [
      { name: "Canadian Equity", value: 24 },
      { name: "US Equity", value: 36 },
      { name: "International Equity", value: 18 },
      { name: "Fixed Income", value: 12 },
      { name: "Cash", value: 10 }
    ],
    topHoldings: [
      { symbol: "VEQT", name: "Vanguard All-Equity", account: "TFSA", weight: "18.2%", value: "$75,200" },
      { symbol: "XAW", name: "iShares Core MSCI ACWI", account: "RRSP", weight: "11.8%", value: "$48,600" },
      { symbol: "CASH", name: "Purpose High Interest", account: "Taxable", weight: "9.9%", value: "$40,800" }
    ],
    netWorthTrend: [
      { label: "Oct", value: 378000 },
      { label: "Nov", value: 382000 },
      { label: "Dec", value: 389000 },
      { label: "Jan", value: 396500 },
      { label: "Feb", value: 404200 },
      { label: "Mar", value: 412300 }
    ],
    spendingMonthLabel: "March 2026",
    savingsPattern: "47.3%",
    investableCash: "$4,350",
    spendingCategories: [
      { name: "Housing", value: "$1,620" },
      { name: "Food", value: "$740" },
      { name: "Transport", value: "$420" }
    ],
    healthPreview: [
      { dimension: "Allocation", value: 72 },
      { dimension: "Diversification", value: 64 },
      { dimension: "Efficiency", value: 78 },
      { dimension: "Concentration", value: 58 },
      { dimension: "Risk Fit", value: 74 }
    ],
    recommendation: {
      theme: "Increase fixed income exposure in RRSP",
      subtitle: "Leading recommendation for the next $8,000 contribution",
      reason: "The portfolio remains underweight fixed income and the RRSP still has efficient tax shelter room.",
      signals: [
        "RRSP room available and aligned with long-horizon fixed-income placement.",
        "Portfolio health preview shows concentration and allocation drift as the main gaps."
      ]
    }
  },
  casey: {
    metrics: [
      { label: "Total Portfolio", value: "$226,400", detail: "+6.9% vs last quarter" },
      { label: "Available Room", value: "$28,800", detail: "FHSA, TFSA, and RRSP remaining room" },
      { label: "Portfolio Risk", value: "Growth", detail: "Higher equity exposure than target comfort band" },
      { label: "Portfolio Health Score", value: "P1", detail: "Preview radar ships after scoring logic" }
    ],
    accounts: [
      { name: "FHSA", caption: "Home down-payment sleeve", value: "$32,800", room: "$8,000 room left", badge: "Priority", badgeVariant: "primary" },
      { name: "TFSA", caption: "Tax-free growth sleeve", value: "$74,200", room: "$11,200 room left", badge: "Growth", badgeVariant: "success" },
      { name: "RRSP", caption: "Retirement growth sleeve", value: "$119,400", room: "$9,600 room left", badge: "Review", badgeVariant: "warning" }
    ],
    drift: [
      { assetClass: "International Equity", current: "12%", target: "22%", delta: "-10%" },
      { assetClass: "US Equity", current: "44%", target: "42%", delta: "+2%" },
      { assetClass: "Cash", current: "8%", target: "10%", delta: "-2%" }
    ],
    assetMix: [
      { name: "Canadian Equity", value: 16 },
      { name: "US Equity", value: 44 },
      { name: "International Equity", value: 12 },
      { name: "Fixed Income", value: 8 },
      { name: "Cash", value: 20 }
    ],
    topHoldings: [
      { symbol: "XEQT", name: "iShares All-Equity", account: "TFSA", weight: "18.6%", value: "$42,100" },
      { symbol: "VFV", name: "Vanguard S&P 500", account: "RRSP", weight: "15.8%", value: "$35,600" },
      { symbol: "XEF", name: "iShares MSCI EAFE", account: "FHSA", weight: "8.8%", value: "$19,800" }
    ],
    netWorthTrend: [
      { label: "Oct", value: 198500 },
      { label: "Nov", value: 204800 },
      { label: "Dec", value: 207900 },
      { label: "Jan", value: 212600 },
      { label: "Feb", value: 219500 },
      { label: "Mar", value: 226400 }
    ],
    spendingMonthLabel: "March 2026",
    savingsPattern: "31%",
    investableCash: "$1,980",
    spendingCategories: [
      { name: "Housing", value: "$1,180" },
      { name: "Food", value: "$620" },
      { name: "Travel", value: "$540" }
    ],
    healthPreview: [
      { dimension: "Allocation", value: 61 },
      { dimension: "Diversification", value: 68 },
      { dimension: "Efficiency", value: 76 },
      { dimension: "Concentration", value: 55 },
      { dimension: "Risk Fit", value: 63 }
    ],
    recommendation: {
      theme: "Prioritize FHSA with international equity and reserve cash",
      subtitle: "Leading recommendation for the next $5,000 contribution",
      reason: "International diversification is still underweight and FHSA room remains the highest-priority sheltered account.",
      signals: [
        "FHSA room is still open and aligned with the near-term home goal.",
        "International equity remains the largest diversification gap in the current mix."
      ]
    }
  }
};

const portfolioByUser: Record<"demo" | "casey", PortfolioData> = {
  demo: {
    performance: [
      { label: "Oct", value: 100 },
      { label: "Nov", value: 101.5 },
      { label: "Dec", value: 103.4 },
      { label: "Jan", value: 104.8 },
      { label: "Feb", value: 106.9 },
      { label: "Mar", value: 108.2 }
    ],
    accountAllocation: [
      { name: "RRSP", value: 49 },
      { name: "TFSA", value: 31 },
      { name: "Taxable", value: 20 }
    ],
    sectorExposure: [
      { name: "Technology", value: 27 },
      { name: "Financials", value: 19 },
      { name: "Industrials", value: 16 },
      { name: "Energy", value: 9 },
      { name: "Other", value: 29 }
    ],
    holdings: [
      { symbol: "VEQT", account: "TFSA", weight: "18.2%", gainLoss: "+11.4%", signal: "Stable anchor position" },
      { symbol: "XAW", account: "RRSP", weight: "11.8%", gainLoss: "+8.7%", signal: "Supports global equity exposure" },
      { symbol: "CASH", account: "Taxable", weight: "9.9%", gainLoss: "+3.4%", signal: "Raises cash drag if kept too high" },
      { symbol: "XBB", account: "RRSP", weight: "5.4%", gainLoss: "+2.1%", signal: "Below target allocation" }
    ],
    summaryPoints: [
      "Fixed income remains the clearest underweight class when compared to target allocation.",
      "Single-position concentration is acceptable but still elevated in the top two ETFs.",
      "Taxable cash balance can be partially redeployed once account room is consumed."
    ]
  },
  casey: {
    performance: [
      { label: "Oct", value: 100 },
      { label: "Nov", value: 102.1 },
      { label: "Dec", value: 103.8 },
      { label: "Jan", value: 105.6 },
      { label: "Feb", value: 108.4 },
      { label: "Mar", value: 110.7 }
    ],
    accountAllocation: [
      { name: "RRSP", value: 53 },
      { name: "TFSA", value: 33 },
      { name: "FHSA", value: 14 }
    ],
    sectorExposure: [
      { name: "Technology", value: 31 },
      { name: "Financials", value: 14 },
      { name: "Industrials", value: 12 },
      { name: "Consumer", value: 11 },
      { name: "Other", value: 32 }
    ],
    holdings: [
      { symbol: "XEQT", account: "TFSA", weight: "18.6%", gainLoss: "+14.8%", signal: "Core growth position remains oversized." },
      { symbol: "VFV", account: "RRSP", weight: "15.8%", gainLoss: "+16.2%", signal: "Large U.S. equity concentration." },
      { symbol: "XEF", account: "FHSA", weight: "8.8%", gainLoss: "+9.6%", signal: "Supports diversification gap closure." },
      { symbol: "CASH", account: "FHSA", weight: "4.1%", gainLoss: "+3.2%", signal: "Helps protect short-horizon home goal." }
    ],
    summaryPoints: [
      "International exposure is still too low relative to the configured target.",
      "U.S. concentration is carrying more risk than the current comfort setting implies.",
      "FHSA should remain the preferred funding account while room is still available."
    ]
  }
};

const recommendationsByUser: Record<"demo" | "casey", RecommendationsData> = {
  demo: {
    inputs: [
      { label: "Target allocation", value: "70 / 20 / 10" },
      { label: "Account priority", value: "TFSA -> RRSP -> Taxable" },
      { label: "Tax-aware placement", value: "Enabled" },
      { label: "Transition preference", value: "Gradual move to target" }
    ],
    explainer: [
      "The engine first looks at configured target allocation and current drift.",
      "Account room and tax-aware placement are then used to rank the best account for new capital.",
      "Ticker options are suggested after asset-class priorities are determined."
    ],
    priorities: [
      { assetClass: "Fixed Income", description: "Largest underweight and easiest to place in RRSP while maintaining the long-horizon sleeve.", amount: "$4,000", account: "RRSP", tickers: "XBB, ZAG", accountFit: "Generally suitable for sheltered fixed-income growth." },
      { assetClass: "International Equity", description: "Secondary gap after fixed income and still aligned with diversification goals.", amount: "$2,500", account: "TFSA", tickers: "XEF, VIU", accountFit: "Fits the contribution priority ladder and target mix." },
      { assetClass: "Canadian Equity", description: "Smaller top-up to keep domestic allocation close to the configured target.", amount: "$1,500", account: "TFSA", tickers: "VCN, XIC", accountFit: "Keeps the contribution plan close to target without over-correcting." }
    ],
    notes: [
      "Recommendation strength drops if upcoming spending needs require a larger cash buffer.",
      "Tax language is intentionally presented as account fit, not guaranteed optimization."
    ]
  },
  casey: {
    inputs: [
      { label: "Target allocation", value: "80 / 10 / 10" },
      { label: "Account priority", value: "FHSA -> TFSA -> RRSP" },
      { label: "Tax-aware placement", value: "Enabled" },
      { label: "Transition preference", value: "Direct move to target" }
    ],
    explainer: [
      "The engine first checks configured goal priority and near-term home savings needs.",
      "FHSA and diversification gaps are ranked before lower-urgency drift corrections.",
      "Ticker options are only surfaced after the account and asset-class recommendation is chosen."
    ],
    priorities: [
      { assetClass: "International Equity", description: "Largest diversification gap and still aligned with the current growth objective.", amount: "$2,200", account: "FHSA", tickers: "XEF, VIU", accountFit: "Keeps shelter room aligned with the current goal stack." },
      { assetClass: "Cash Reserve", description: "Maintains the cash target required for a medium-term down-payment objective.", amount: "$1,400", account: "FHSA", tickers: "CASH", accountFit: "Supports home-goal flexibility before the next funding cycle." },
      { assetClass: "Canadian Equity", description: "Smaller balancing contribution to avoid over-indexing the U.S. sleeve.", amount: "$1,400", account: "TFSA", tickers: "VCN, XIC", accountFit: "Improves domestic mix without disrupting the broader growth posture." }
    ],
    notes: [
      "Home-goal cash needs lower the confidence of fully equity-focused recommendations.",
      "Tax-aware placement is still expressed as account fit rather than definitive tax advice."
    ]
  }
};

const spendingByUser: Record<"demo" | "casey", SpendingData> = {
  demo: {
    metrics: [
      { label: "Monthly spend", value: "$4,180", detail: "Down 6% from last month" },
      { label: "Savings rate", value: "27%", detail: "Based on current inflow assumptions" },
      { label: "Investable cash", value: "$2,350", detail: "Potential monthly capital after fixed expenses" },
      { label: "Cash discipline", value: "Stable", detail: "Spending still supports contribution cadence" }
    ],
    trend: [
      { label: "Oct", value: 4620 },
      { label: "Nov", value: 4510 },
      { label: "Dec", value: 4780 },
      { label: "Jan", value: 4320 },
      { label: "Feb", value: 4440 },
      { label: "Mar", value: 4180 }
    ],
    categories: [
      { name: "Housing", share: "39%", amount: "$1,620" },
      { name: "Food", share: "18%", amount: "$740" },
      { name: "Transport", share: "10%", amount: "$420" },
      { name: "Travel", share: "9%", amount: "$370" }
    ],
    transactions: [
      { date: "2026-03-14", merchant: "Loblaws", category: "Food", amount: "$142.35" },
      { date: "2026-03-12", merchant: "Toronto Hydro", category: "Housing", amount: "$96.20" },
      { date: "2026-03-10", merchant: "TTC", category: "Transport", amount: "$36.00" },
      { date: "2026-03-08", merchant: "Airbnb", category: "Travel", amount: "$214.90" }
    ]
  },
  casey: {
    metrics: [
      { label: "Monthly spend", value: "$3,420", detail: "Flat vs last month" },
      { label: "Savings rate", value: "31%", detail: "Higher due to lower housing costs" },
      { label: "Investable cash", value: "$1,980", detail: "After reserve contribution for FHSA goal" },
      { label: "Cash discipline", value: "Watch", detail: "Travel spend is creeping above target" }
    ],
    trend: [
      { label: "Oct", value: 3360 },
      { label: "Nov", value: 3280 },
      { label: "Dec", value: 3475 },
      { label: "Jan", value: 3350 },
      { label: "Feb", value: 3410 },
      { label: "Mar", value: 3420 }
    ],
    categories: [
      { name: "Housing", share: "34%", amount: "$1,180" },
      { name: "Food", share: "18%", amount: "$620" },
      { name: "Travel", share: "16%", amount: "$540" },
      { name: "Utilities", share: "8%", amount: "$270" }
    ],
    transactions: [
      { date: "2026-03-15", merchant: "Farm Boy", category: "Food", amount: "$118.44" },
      { date: "2026-03-11", merchant: "Via Rail", category: "Travel", amount: "$184.90" },
      { date: "2026-03-09", merchant: "Hydro Ottawa", category: "Utilities", amount: "$84.15" },
      { date: "2026-03-05", merchant: "Spotify", category: "Subscriptions", amount: "$12.99" }
    ]
  }
};

const importByUser: Record<"demo" | "casey", ImportData> = {
  demo: {
    steps: [
      { title: "Choose account type", description: "Start with the account structure, not a long form." },
      { title: "Choose import method", description: "CSV import first, account integrations later." },
      { title: "Upload and map", description: "Preview the CSV, then map fields before saving." },
      { title: "Fix issues", description: "Review the flagged mismatches and correction prompts." },
      { title: "Complete setup", description: "Set target preferences and continue to the dashboard." }
    ],
    setupCards: [
      { label: "Account type", title: "TFSA / RRSP / Taxable / FHSA", description: "Pick the right account bucket before asking for institution detail." },
      { label: "Import method", title: "CSV upload first", description: "Keeps MVP friction low while we define stable broker integrations." },
      { label: "Field mapping", title: "Review transaction and holding columns", description: "Mapping stays explicit so the user trusts the imported data." },
      { label: "Preference handoff", title: "Move into Investment Preferences", description: "The import flow hands off cleanly into target allocation and account priorities." }
    ],
    successStates: [
      "Imported holdings can be grouped by account and asset class.",
      "Invalid or unknown rows are flagged before the portfolio view updates.",
      "On completion the user can move directly to Dashboard or Recommendations."
    ]
  },
  casey: {
    steps: [
      { title: "Choose account type", description: "Start with the account structure, not a long form." },
      { title: "Choose import method", description: "CSV import first, account integrations later." },
      { title: "Upload and map", description: "Preview the FHSA and TFSA files before saving." },
      { title: "Fix issues", description: "Review currency and account-type mismatches before import." },
      { title: "Complete setup", description: "Move into allocation preferences once accounts are clean." }
    ],
    setupCards: [
      { label: "Account type", title: "FHSA / TFSA / RRSP", description: "Goal-linked accounts stay visible early in the setup flow." },
      { label: "Import method", title: "CSV upload first", description: "Still the lowest-friction path for this product stage." },
      { label: "Field mapping", title: "Holdings and contribution records", description: "Mapping remains explicit so the user trusts the imported goal data." },
      { label: "Preference handoff", title: "Move into Investment Preferences", description: "Import ends by setting a target mix that fits the home goal and growth posture." }
    ],
    successStates: [
      "Imported accounts stay grouped by goal and account type.",
      "Unknown rows are flagged before recommendation logic uses them.",
      "On completion the user can move directly into Dashboard or Recommendations."
    ]
  }
};

const settingsByUser: Record<"demo" | "casey", SettingsData> = {
  demo: {
    guidedQuestions: [
      "What is your primary financial goal and time horizon?",
      "How comfortable are you with portfolio volatility and drawdowns?",
      "Do you want to prioritize tax efficiency or staying close to current holdings?",
      "Should the recommendation engine keep a larger cash buffer for upcoming spending?"
    ],
    manualGroups: [
      { title: "Risk profile and target allocation", description: "Editable allocation settings with room for future validation and drift controls." },
      { title: "Account funding priorities", description: "Needs reorderable interaction so the user controls the contribution ladder.", badge: "Sortable" },
      { title: "Recommendation behavior", description: "Includes rebalancing tolerance and current-holdings transition preference." },
      { title: "Tax-aware placement", description: "Visible as a top-level toggle, with advanced inputs hidden until needed.", badge: "Advanced" }
    ]
  },
  casey: {
    guidedQuestions: [
      "How important is the home goal compared with long-term portfolio growth?",
      "How much short-term volatility can you tolerate before changing course?",
      "Should the engine prioritize FHSA room before broader portfolio drift correction?",
      "How much cash should remain available for shorter-term milestones?"
    ],
    manualGroups: [
      { title: "Risk profile and target allocation", description: "Supports a more growth-oriented mix with explicit goal constraints." },
      { title: "Account funding priorities", description: "Keeps FHSA-first ordering configurable and visible.", badge: "Sortable" },
      { title: "Recommendation behavior", description: "Controls direct-vs-gradual transition toward target allocation." },
      { title: "Tax-aware placement", description: "Advanced details remain available without overwhelming the default screen.", badge: "Advanced" }
    ]
  }
};

function resolveUserKey(userId: string): "demo" | "casey" {
  return USER_KEY_BY_ID[userId] ?? "demo";
}

export async function getDashboardData(userId = "user_demo") { return dashboardByUser[resolveUserKey(userId)]; }
export async function getPortfolioData(userId = "user_demo") { return portfolioByUser[resolveUserKey(userId)]; }
export async function getRecommendationsData(userId = "user_demo") { return recommendationsByUser[resolveUserKey(userId)]; }
export async function getSpendingData(userId = "user_demo") { return spendingByUser[resolveUserKey(userId)]; }
export async function getImportData(userId = "user_demo") { return importByUser[resolveUserKey(userId)]; }
export async function getSettingsData(userId = "user_demo") { return settingsByUser[resolveUserKey(userId)]; }
