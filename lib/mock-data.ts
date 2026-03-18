import {
  DashboardData,
  ImportData,
  PortfolioData,
  RecommendationsData,
  SettingsData,
  SpendingData
} from "@/lib/contracts";

const dashboardData: DashboardData = {
  metrics: [
    { label: "Total Portfolio", value: "$412,300", detail: "+4.1% vs last quarter" },
    { label: "Available Room", value: "$24,500", detail: "TFSA and RRSP remaining room" },
    { label: "Portfolio Risk", value: "Moderate", detail: "Within configured tolerance band" },
    { label: "Review Items", value: "5", detail: "3 high-priority signals need attention" }
  ],
  accounts: [
    {
      name: "TFSA",
      caption: "Tax-free growth sleeve",
      value: "$128,400",
      room: "$9,100 room left",
      badge: "Priority",
      badgeVariant: "primary"
    },
    {
      name: "RRSP",
      caption: "Long-horizon retirement sleeve",
      value: "$201,200",
      room: "$15,400 room left",
      badge: "Tax fit",
      badgeVariant: "success"
    },
    {
      name: "Taxable",
      caption: "Flexible capital account",
      value: "$82,700",
      room: "No tax shelter",
      badge: "Review",
      badgeVariant: "warning"
    }
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
      "RRSP room available and aligned with long-horizon fixed income placement.",
      "Portfolio health preview shows concentration and allocation drift as the main gaps."
    ]
  }
};

const portfolioData: PortfolioData = {
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
};

const recommendationsData: RecommendationsData = {
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
    {
      assetClass: "Fixed Income",
      description: "Largest underweight and easiest to place in RRSP while maintaining the long-horizon sleeve.",
      amount: "$4,000",
      account: "RRSP",
      tickers: "XBB, ZAG",
      accountFit: "Generally suitable for sheltered fixed-income growth."
    },
    {
      assetClass: "International Equity",
      description: "Secondary gap after fixed income and still aligned with diversification goals.",
      amount: "$2,500",
      account: "TFSA",
      tickers: "XEF, VIU",
      accountFit: "Fits the contribution priority ladder and target mix."
    },
    {
      assetClass: "Canadian Equity",
      description: "Smaller top-up to keep domestic allocation close to the configured target.",
      amount: "$1,500",
      account: "TFSA",
      tickers: "VCN, XIC",
      accountFit: "Keeps the contribution plan close to target without over-correcting."
    }
  ],
  notes: [
    "Recommendation strength drops if upcoming spending needs require a larger cash buffer.",
    "Tax language is intentionally presented as account fit, not guaranteed optimization."
  ]
};

const spendingData: SpendingData = {
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
};

const importData: ImportData = {
  steps: [
    { title: "Choose account type", description: "Start with the account structure, not a long form." },
    { title: "Choose import method", description: "CSV import first, account integrations later." },
    { title: "Upload and map", description: "Preview the CSV, then map fields before saving." },
    { title: "Fix issues", description: "Review the flagged mismatches and correction prompts." },
    { title: "Complete setup", description: "Set target preferences and continue to the dashboard." }
  ],
  setupCards: [
    {
      label: "Account type",
      title: "TFSA / RRSP / Taxable / FHSA",
      description: "Pick the right account bucket before asking for institution detail."
    },
    {
      label: "Import method",
      title: "CSV upload first",
      description: "Keeps MVP friction low while we define stable broker integrations."
    },
    {
      label: "Field mapping",
      title: "Review transaction and holding columns",
      description: "Mapping stays explicit so the user trusts the imported data."
    },
    {
      label: "Preference handoff",
      title: "Move into Investment Preferences",
      description: "The import flow hands off cleanly into target allocation and account priorities."
    }
  ],
  successStates: [
    "Imported holdings can be grouped by account and asset class.",
    "Invalid or unknown rows are flagged before the portfolio view updates.",
    "On completion the user can move directly to Dashboard or Recommendations."
  ]
};

const settingsData: SettingsData = {
  guidedQuestions: [
    "What is your primary financial goal and time horizon?",
    "How comfortable are you with portfolio volatility and drawdowns?",
    "Do you want to prioritize tax efficiency or staying close to current holdings?",
    "Should the recommendation engine keep a larger cash buffer for upcoming spending?"
  ],
  manualGroups: [
    {
      title: "Risk profile and target allocation",
      description: "Editable allocation settings with room for future validation and drift controls."
    },
    {
      title: "Account funding priorities",
      description: "Needs reorderable interaction so the user controls the contribution ladder.",
      badge: "Sortable"
    },
    {
      title: "Recommendation behavior",
      description: "Includes rebalancing tolerance and current-holdings transition preference."
    },
    {
      title: "Tax-aware placement",
      description: "Visible as a top-level toggle, with advanced inputs hidden until needed.",
      badge: "Advanced"
    }
  ]
};

export async function getDashboardData() { return dashboardData; }
export async function getPortfolioData() { return portfolioData; }
export async function getRecommendationsData() { return recommendationsData; }
export async function getSpendingData() { return spendingData; }
export async function getImportData() { return importData; }
export async function getSettingsData() { return settingsData; }
