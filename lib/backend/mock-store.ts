import { hashSync } from "bcryptjs";
import {
  AuthIdentity,
  CashflowTransaction,
  HoldingPosition,
  ImportJob,
  InvestmentAccount,
  PreferenceProfile,
  RecommendationRun,
  UserProfile
} from "@/lib/backend/models";

export const users: UserProfile[] = [
  {
    id: "user_demo",
    email: "jiekun@example.com",
    displayName: "Jiekun Liu",
    baseCurrency: "CAD"
  },
  {
    id: "user_casey",
    email: "casey@example.com",
    displayName: "Casey Morgan",
    baseCurrency: "CAD"
  }
];

const demoPasswordHash = hashSync("demo1234", 10);

export const authIdentities: AuthIdentity[] = users.map((user) => ({
  userId: user.id,
  email: user.email,
  passwordHash: demoPasswordHash
}));

export const accounts: InvestmentAccount[] = [
  {
    id: "acct_tfsa_demo",
    userId: "user_demo",
    institution: "Questrade",
    type: "TFSA",
    nickname: "Core Growth",
    marketValueCad: 128400,
    contributionRoomCad: 9100
  },
  {
    id: "acct_rrsp_demo",
    userId: "user_demo",
    institution: "Interactive Brokers",
    type: "RRSP",
    nickname: "Retirement Core",
    marketValueCad: 201200,
    contributionRoomCad: 15400
  },
  {
    id: "acct_taxable_demo",
    userId: "user_demo",
    institution: "Wealthsimple",
    type: "Taxable",
    nickname: "Flexible Capital",
    marketValueCad: 82700,
    contributionRoomCad: null
  },
  {
    id: "acct_tfsa_casey",
    userId: "user_casey",
    institution: "Wealthsimple",
    type: "TFSA",
    nickname: "Growth Sleeve",
    marketValueCad: 74200,
    contributionRoomCad: 11200
  },
  {
    id: "acct_rrsp_casey",
    userId: "user_casey",
    institution: "National Bank Direct Brokerage",
    type: "RRSP",
    nickname: "Retirement Growth",
    marketValueCad: 119400,
    contributionRoomCad: 9600
  },
  {
    id: "acct_fhsa_casey",
    userId: "user_casey",
    institution: "Questrade",
    type: "FHSA",
    nickname: "Home Down Payment",
    marketValueCad: 32800,
    contributionRoomCad: 8000
  }
];

export const holdings: HoldingPosition[] = [
  {
    id: "hold_veqt_demo",
    userId: "user_demo",
    accountId: "acct_tfsa_demo",
    symbol: "VEQT",
    name: "Vanguard All-Equity",
    assetClass: "Canadian Equity",
    sector: "Multi-sector",
    marketValueCad: 75200,
    weightPct: 18.2,
    gainLossPct: 11.4
  },
  {
    id: "hold_xaw_demo",
    userId: "user_demo",
    accountId: "acct_rrsp_demo",
    symbol: "XAW",
    name: "iShares Core MSCI ACWI",
    assetClass: "International Equity",
    sector: "Multi-sector",
    marketValueCad: 48600,
    weightPct: 11.8,
    gainLossPct: 8.7
  },
  {
    id: "hold_cash_demo",
    userId: "user_demo",
    accountId: "acct_taxable_demo",
    symbol: "CASH",
    name: "Purpose High Interest",
    assetClass: "Cash",
    sector: "Cash",
    marketValueCad: 40800,
    weightPct: 9.9,
    gainLossPct: 3.4
  },
  {
    id: "hold_xbb_demo",
    userId: "user_demo",
    accountId: "acct_rrsp_demo",
    symbol: "XBB",
    name: "iShares Core Canadian Universe Bond",
    assetClass: "Fixed Income",
    sector: "Fixed Income",
    marketValueCad: 22300,
    weightPct: 5.4,
    gainLossPct: 2.1
  },
  {
    id: "hold_xeqt_casey",
    userId: "user_casey",
    accountId: "acct_tfsa_casey",
    symbol: "XEQT",
    name: "iShares All-Equity",
    assetClass: "US Equity",
    sector: "Multi-sector",
    marketValueCad: 42100,
    weightPct: 18.6,
    gainLossPct: 14.8
  },
  {
    id: "hold_vfv_casey",
    userId: "user_casey",
    accountId: "acct_rrsp_casey",
    symbol: "VFV",
    name: "Vanguard S&P 500",
    assetClass: "US Equity",
    sector: "Technology",
    marketValueCad: 35600,
    weightPct: 15.8,
    gainLossPct: 16.2
  },
  {
    id: "hold_xef_casey",
    userId: "user_casey",
    accountId: "acct_fhsa_casey",
    symbol: "XEF",
    name: "iShares MSCI EAFE",
    assetClass: "International Equity",
    sector: "Multi-sector",
    marketValueCad: 19800,
    weightPct: 8.8,
    gainLossPct: 9.6
  },
  {
    id: "hold_cash_casey",
    userId: "user_casey",
    accountId: "acct_fhsa_casey",
    symbol: "CASH",
    name: "Purpose High Interest",
    assetClass: "Cash",
    sector: "Cash",
    marketValueCad: 9400,
    weightPct: 4.1,
    gainLossPct: 3.2
  }
];

export const transactions: CashflowTransaction[] = [
  {
    id: "txn_demo_001",
    userId: "user_demo",
    bookedAt: "2026-03-14",
    merchant: "Loblaws",
    category: "Food",
    amountCad: 142.35,
    direction: "outflow"
  },
  {
    id: "txn_demo_002",
    userId: "user_demo",
    bookedAt: "2026-03-12",
    merchant: "Toronto Hydro",
    category: "Housing",
    amountCad: 96.2,
    direction: "outflow"
  },
  {
    id: "txn_demo_003",
    userId: "user_demo",
    bookedAt: "2026-03-01",
    merchant: "Paycheque",
    category: "Income",
    amountCad: 9200,
    direction: "inflow"
  },
  {
    id: "txn_casey_001",
    userId: "user_casey",
    bookedAt: "2026-03-15",
    merchant: "Farm Boy",
    category: "Food",
    amountCad: 118.44,
    direction: "outflow"
  },
  {
    id: "txn_casey_002",
    userId: "user_casey",
    bookedAt: "2026-03-11",
    merchant: "Via Rail",
    category: "Travel",
    amountCad: 184.9,
    direction: "outflow"
  },
  {
    id: "txn_casey_003",
    userId: "user_casey",
    bookedAt: "2026-03-01",
    merchant: "Paycheque",
    category: "Income",
    amountCad: 7100,
    direction: "inflow"
  }
];

export const preferenceProfiles: PreferenceProfile[] = [
  {
    id: "pref_demo",
    userId: "user_demo",
    riskProfile: "Balanced",
    targetAllocation: [
      { assetClass: "Canadian Equity", targetPct: 22 },
      { assetClass: "US Equity", targetPct: 32 },
      { assetClass: "International Equity", targetPct: 16 },
      { assetClass: "Fixed Income", targetPct: 20 },
      { assetClass: "Cash", targetPct: 10 }
    ],
    accountFundingPriority: ["TFSA", "RRSP", "Taxable"],
    taxAwarePlacement: true,
    cashBufferTargetCad: 12000,
    transitionPreference: "gradual",
    recommendationStrategy: "balanced",
    rebalancingTolerancePct: 4,
    watchlistSymbols: ["XBB", "VCN", "XEF"]
  },
  {
    id: "pref_casey",
    userId: "user_casey",
    riskProfile: "Growth",
    targetAllocation: [
      { assetClass: "Canadian Equity", targetPct: 16 },
      { assetClass: "US Equity", targetPct: 42 },
      { assetClass: "International Equity", targetPct: 22 },
      { assetClass: "Fixed Income", targetPct: 10 },
      { assetClass: "Cash", targetPct: 10 }
    ],
    accountFundingPriority: ["FHSA", "TFSA", "RRSP"],
    taxAwarePlacement: true,
    cashBufferTargetCad: 9000,
    transitionPreference: "direct",
    recommendationStrategy: "target-first",
    rebalancingTolerancePct: 5,
    watchlistSymbols: ["XEQT", "VFV", "XEF"]
  }
];

export const recommendationRuns: RecommendationRun[] = [
  {
    id: "rec_demo",
    userId: "user_demo",
    contributionAmountCad: 8000,
    createdAt: "2026-03-18T00:00:00.000Z",
    items: [
      {
        assetClass: "Fixed Income",
        amountCad: 4000,
        targetAccountType: "RRSP",
        tickerOptions: ["XBB", "ZAG"],
        explanation: "Largest underweight class and strongest fit for sheltered placement."
      },
      {
        assetClass: "International Equity",
        amountCad: 2500,
        targetAccountType: "TFSA",
        tickerOptions: ["XEF", "VIU"],
        explanation: "Diversification gap remains secondary after fixed income."
      }
    ],
    assumptions: [
      "Recommendation uses configured target allocation and current drift.",
      "Contribution ladder honors TFSA then RRSP before taxable funding."
    ]
  },
  {
    id: "rec_casey",
    userId: "user_casey",
    contributionAmountCad: 5000,
    createdAt: "2026-03-18T00:00:00.000Z",
    items: [
      {
        assetClass: "International Equity",
        amountCad: 2200,
        targetAccountType: "FHSA",
        tickerOptions: ["XEF", "VIU"],
        explanation: "International exposure remains the clearest diversification gap."
      },
      {
        assetClass: "Cash",
        amountCad: 1400,
        targetAccountType: "FHSA",
        tickerOptions: ["CASH"],
        explanation: "Maintains down-payment flexibility while keeping the growth plan intact."
      }
    ],
    assumptions: [
      "Recommendation prioritizes FHSA room before other accounts.",
      "Cash reserve target remains active because of the shorter home-purchase horizon."
    ]
  }
];

export const importJobs: ImportJob[] = [
  {
    id: "import_demo",
    userId: "user_demo",
    status: "validated",
    sourceType: "csv",
    fileName: "questrade-holdings-march.csv",
    createdAt: "2026-03-16T15:00:00.000Z"
  },
  {
    id: "import_casey",
    userId: "user_casey",
    status: "mapped",
    sourceType: "csv",
    fileName: "wealthsimple-fhsa-march.csv",
    createdAt: "2026-03-17T10:15:00.000Z"
  }
];

export function findUserById(userId: string) {
  return users.find((user) => user.id === userId) ?? null;
}

export function findAuthUserByEmail(email: string) {
  const authIdentity = authIdentities.find((identity) => identity.email === email.toLowerCase());
  if (!authIdentity) {
    return null;
  }

  const profile = findUserById(authIdentity.userId);
  if (!profile) {
    return null;
  }

  return {
    profile,
    passwordHash: authIdentity.passwordHash
  };
}
