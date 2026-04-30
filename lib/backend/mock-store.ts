import { hashSync } from "bcryptjs";
import {
  AuthIdentity,
  CashAccount,
  CashAccountBalanceEvent,
  CashflowTransaction,
  HoldingPosition,
  ImportJob,
  InvestmentAccount,
  PortfolioEvent,
  PortfolioSnapshot,
  SecurityPriceHistoryPoint,
  PreferenceProfile,
  RecommendationRun,
  UserProfile
} from "@/lib/backend/models";
import { DEFAULT_PREFERENCE_FACTORS } from "@/lib/backend/preference-factors";

export const users: UserProfile[] = [
  {
    id: "user_demo",
    email: "jiekun@example.com",
    displayName: "Jiekun Liu",
    baseCurrency: "CAD",
    displayLanguage: "zh"
  },
  {
    id: "user_casey",
    email: "casey@example.com",
    displayName: "Casey Morgan",
    baseCurrency: "CAD",
    displayLanguage: "zh"
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

export const cashAccounts: CashAccount[] = [
  {
    id: "cash_demo_main",
    userId: "user_demo",
    institution: "Tangerine",
    nickname: "Daily Cash",
    currency: "CAD",
    currentBalanceAmount: 15420,
    currentBalanceCad: 15420,
    createdAt: "2025-10-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z"
  },
  {
    id: "cash_casey_main",
    userId: "user_casey",
    institution: "Simplii",
    nickname: "Monthly Buffer",
    currency: "CAD",
    currentBalanceAmount: 9820,
    currentBalanceCad: 9820,
    createdAt: "2025-10-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z"
  }
];

export const cashAccountBalanceEvents: CashAccountBalanceEvent[] = [
  { id: "cash_evt_demo_1", userId: "user_demo", cashAccountId: "cash_demo_main", bookedAt: "2025-10-01", balanceAmount: 13200, balanceCad: 13200, source: "seed", createdAt: "2025-10-01T00:00:00.000Z" },
  { id: "cash_evt_demo_2", userId: "user_demo", cashAccountId: "cash_demo_main", bookedAt: "2025-11-01", balanceAmount: 14120, balanceCad: 14120, source: "seed", createdAt: "2025-11-01T00:00:00.000Z" },
  { id: "cash_evt_demo_3", userId: "user_demo", cashAccountId: "cash_demo_main", bookedAt: "2025-12-01", balanceAmount: 13940, balanceCad: 13940, source: "seed", createdAt: "2025-12-01T00:00:00.000Z" },
  { id: "cash_evt_demo_4", userId: "user_demo", cashAccountId: "cash_demo_main", bookedAt: "2026-01-01", balanceAmount: 14780, balanceCad: 14780, source: "seed", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "cash_evt_demo_5", userId: "user_demo", cashAccountId: "cash_demo_main", bookedAt: "2026-02-01", balanceAmount: 15140, balanceCad: 15140, source: "seed", createdAt: "2026-02-01T00:00:00.000Z" },
  { id: "cash_evt_demo_6", userId: "user_demo", cashAccountId: "cash_demo_main", bookedAt: "2026-03-01", balanceAmount: 15420, balanceCad: 15420, source: "seed", createdAt: "2026-03-01T00:00:00.000Z" },
  { id: "cash_evt_casey_1", userId: "user_casey", cashAccountId: "cash_casey_main", bookedAt: "2025-10-01", balanceAmount: 8600, balanceCad: 8600, source: "seed", createdAt: "2025-10-01T00:00:00.000Z" },
  { id: "cash_evt_casey_2", userId: "user_casey", cashAccountId: "cash_casey_main", bookedAt: "2025-11-01", balanceAmount: 9040, balanceCad: 9040, source: "seed", createdAt: "2025-11-01T00:00:00.000Z" },
  { id: "cash_evt_casey_3", userId: "user_casey", cashAccountId: "cash_casey_main", bookedAt: "2025-12-01", balanceAmount: 9280, balanceCad: 9280, source: "seed", createdAt: "2025-12-01T00:00:00.000Z" },
  { id: "cash_evt_casey_4", userId: "user_casey", cashAccountId: "cash_casey_main", bookedAt: "2026-01-01", balanceAmount: 9440, balanceCad: 9440, source: "seed", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "cash_evt_casey_5", userId: "user_casey", cashAccountId: "cash_casey_main", bookedAt: "2026-02-01", balanceAmount: 9630, balanceCad: 9630, source: "seed", createdAt: "2026-02-01T00:00:00.000Z" },
  { id: "cash_evt_casey_6", userId: "user_casey", cashAccountId: "cash_casey_main", bookedAt: "2026-03-01", balanceAmount: 9820, balanceCad: 9820, source: "seed", createdAt: "2026-03-01T00:00:00.000Z" }
];

export const portfolioEvents: PortfolioEvent[] = [
  {
    id: "evt_demo_veqt_buy",
    userId: "user_demo",
    accountId: "acct_tfsa_demo",
    symbol: "VEQT",
    eventType: "buy",
    quantity: 1800,
    priceAmount: 34.2,
    currency: "CAD",
    bookedAt: "2025-10-01",
    effectiveAt: "2025-10-01T00:00:00.000Z",
    source: "seed",
    createdAt: "2025-10-01T00:00:00.000Z"
  },
  {
    id: "evt_casey_xeqt_buy",
    userId: "user_casey",
    accountId: "acct_tfsa_casey",
    symbol: "XEQT",
    eventType: "buy",
    quantity: 1200,
    priceAmount: 31.8,
    currency: "CAD",
    bookedAt: "2025-10-01",
    effectiveAt: "2025-10-01T00:00:00.000Z",
    source: "seed",
    createdAt: "2025-10-01T00:00:00.000Z"
  },
  {
    id: "evt_casey_vfv_buy",
    userId: "user_casey",
    accountId: "acct_rrsp_casey",
    symbol: "VFV",
    eventType: "buy",
    quantity: 280,
    priceAmount: 118.2,
    currency: "CAD",
    bookedAt: "2025-10-01",
    effectiveAt: "2025-10-01T00:00:00.000Z",
    source: "seed",
    createdAt: "2025-10-01T00:00:00.000Z"
  }
];

export const portfolioSnapshots: PortfolioSnapshot[] = [
  {
    id: "snap_demo_2025_10",
    userId: "user_demo",
    snapshotDate: "2025-10-01",
    totalValueCad: 364900,
    accountBreakdown: {
      acct_tfsa_demo: 111200,
      acct_rrsp_demo: 177500,
      acct_taxable_demo: 76200
    },
    holdingBreakdown: {
      hold_veqt_demo: 66200,
      hold_xaw_demo: 42800,
      hold_cash_demo: 35400,
      hold_xbb_demo: 19400
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2025-10-01T00:00:00.000Z"
  },
  {
    id: "snap_demo_2025_11",
    userId: "user_demo",
    snapshotDate: "2025-11-01",
    totalValueCad: 372800,
    accountBreakdown: {
      acct_tfsa_demo: 114600,
      acct_rrsp_demo: 180700,
      acct_taxable_demo: 77500
    },
    holdingBreakdown: {
      hold_veqt_demo: 68400,
      hold_xaw_demo: 44100,
      hold_cash_demo: 35800,
      hold_xbb_demo: 20100
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2025-11-01T00:00:00.000Z"
  },
  {
    id: "snap_demo_2025_12",
    userId: "user_demo",
    snapshotDate: "2025-12-01",
    totalValueCad: 381600,
    accountBreakdown: {
      acct_tfsa_demo: 117400,
      acct_rrsp_demo: 185300,
      acct_taxable_demo: 78900
    },
    holdingBreakdown: {
      hold_veqt_demo: 70100,
      hold_xaw_demo: 45200,
      hold_cash_demo: 37000,
      hold_xbb_demo: 21400
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2025-12-01T00:00:00.000Z"
  },
  {
    id: "snap_demo_2026_01",
    userId: "user_demo",
    snapshotDate: "2026-01-01",
    totalValueCad: 394700,
    accountBreakdown: {
      acct_tfsa_demo: 121500,
      acct_rrsp_demo: 191200,
      acct_taxable_demo: 82000
    },
    holdingBreakdown: {
      hold_veqt_demo: 72400,
      hold_xaw_demo: 46800,
      hold_cash_demo: 38500,
      hold_xbb_demo: 22100
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "snap_demo_2026_02",
    userId: "user_demo",
    snapshotDate: "2026-02-01",
    totalValueCad: 404900,
    accountBreakdown: {
      acct_tfsa_demo: 124800,
      acct_rrsp_demo: 197100,
      acct_taxable_demo: 83000
    },
    holdingBreakdown: {
      hold_veqt_demo: 74100,
      hold_xaw_demo: 47900,
      hold_cash_demo: 39800,
      hold_xbb_demo: 22400
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2026-02-01T00:00:00.000Z"
  },
  {
    id: "snap_demo_2026_03",
    userId: "user_demo",
    snapshotDate: "2026-03-01",
    totalValueCad: 412300,
    accountBreakdown: {
      acct_tfsa_demo: 128400,
      acct_rrsp_demo: 201200,
      acct_taxable_demo: 82700
    },
    holdingBreakdown: {
      hold_veqt_demo: 75200,
      hold_xaw_demo: 48600,
      hold_cash_demo: 40800,
      hold_xbb_demo: 22300
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2026-03-01T00:00:00.000Z"
  },
  {
    id: "snap_casey_2025_10",
    userId: "user_casey",
    snapshotDate: "2025-10-01",
    totalValueCad: 199400,
    accountBreakdown: {
      acct_tfsa_casey: 65100,
      acct_rrsp_casey: 104300,
      acct_fhsa_casey: 30000
    },
    holdingBreakdown: {
      hold_xeqt_casey: 36600,
      hold_vfv_casey: 31400,
      hold_xef_casey: 17800,
      hold_cash_casey: 8600
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2025-10-01T00:00:00.000Z"
  },
  {
    id: "snap_casey_2025_11",
    userId: "user_casey",
    snapshotDate: "2025-11-01",
    totalValueCad: 205600,
    accountBreakdown: {
      acct_tfsa_casey: 66800,
      acct_rrsp_casey: 107100,
      acct_fhsa_casey: 31700
    },
    holdingBreakdown: {
      hold_xeqt_casey: 37800,
      hold_vfv_casey: 32300,
      hold_xef_casey: 18400,
      hold_cash_casey: 9100
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2025-11-01T00:00:00.000Z"
  },
  {
    id: "snap_casey_2025_12",
    userId: "user_casey",
    snapshotDate: "2025-12-01",
    totalValueCad: 211900,
    accountBreakdown: {
      acct_tfsa_casey: 68400,
      acct_rrsp_casey: 111000,
      acct_fhsa_casey: 32500
    },
    holdingBreakdown: {
      hold_xeqt_casey: 39000,
      hold_vfv_casey: 33200,
      hold_xef_casey: 19100,
      hold_cash_casey: 9600
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2025-12-01T00:00:00.000Z"
  },
  {
    id: "snap_casey_2026_01",
    userId: "user_casey",
    snapshotDate: "2026-01-01",
    totalValueCad: 218700,
    accountBreakdown: {
      acct_tfsa_casey: 70100,
      acct_rrsp_casey: 114900,
      acct_fhsa_casey: 33700
    },
    holdingBreakdown: {
      hold_xeqt_casey: 40100,
      hold_vfv_casey: 34100,
      hold_xef_casey: 19500,
      hold_cash_casey: 10000
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "snap_casey_2026_02",
    userId: "user_casey",
    snapshotDate: "2026-02-01",
    totalValueCad: 223800,
    accountBreakdown: {
      acct_tfsa_casey: 72100,
      acct_rrsp_casey: 117600,
      acct_fhsa_casey: 34100
    },
    holdingBreakdown: {
      hold_xeqt_casey: 41400,
      hold_vfv_casey: 34900,
      hold_xef_casey: 19800,
      hold_cash_casey: 9300
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2026-02-01T00:00:00.000Z"
  },
  {
    id: "snap_casey_2026_03",
    userId: "user_casey",
    snapshotDate: "2026-03-01",
    totalValueCad: 226400,
    accountBreakdown: {
      acct_tfsa_casey: 74200,
      acct_rrsp_casey: 119400,
      acct_fhsa_casey: 32800
    },
    holdingBreakdown: {
      hold_xeqt_casey: 42100,
      hold_vfv_casey: 35600,
      hold_xef_casey: 19800,
      hold_cash_casey: 9400
    },
    sourceVersion: "snapshot-v1",
    createdAt: "2026-03-01T00:00:00.000Z"
  }
];

export const securityPriceHistory: SecurityPriceHistoryPoint[] = [
  { id: "price_veqt_1", symbol: "VEQT", priceDate: "2025-10-01", close: 34.2, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2025-10-01T00:00:00.000Z" },
  { id: "price_veqt_2", symbol: "VEQT", priceDate: "2025-11-01", close: 34.9, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2025-11-01T00:00:00.000Z" },
  { id: "price_veqt_3", symbol: "VEQT", priceDate: "2025-12-01", close: 35.6, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2025-12-01T00:00:00.000Z" },
  { id: "price_veqt_4", symbol: "VEQT", priceDate: "2026-01-01", close: 36.4, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "price_veqt_5", symbol: "VEQT", priceDate: "2026-02-01", close: 37.1, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2026-02-01T00:00:00.000Z" },
  { id: "price_veqt_6", symbol: "VEQT", priceDate: "2026-03-01", close: 37.9, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2026-03-01T00:00:00.000Z" },
  { id: "price_xeqt_1", symbol: "XEQT", priceDate: "2025-10-01", close: 31.8, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2025-10-01T00:00:00.000Z" },
  { id: "price_xeqt_2", symbol: "XEQT", priceDate: "2025-11-01", close: 32.6, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2025-11-01T00:00:00.000Z" },
  { id: "price_xeqt_3", symbol: "XEQT", priceDate: "2025-12-01", close: 33.1, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2025-12-01T00:00:00.000Z" },
  { id: "price_xeqt_4", symbol: "XEQT", priceDate: "2026-01-01", close: 33.8, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "price_xeqt_5", symbol: "XEQT", priceDate: "2026-02-01", close: 34.4, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2026-02-01T00:00:00.000Z" },
  { id: "price_xeqt_6", symbol: "XEQT", priceDate: "2026-03-01", close: 35.2, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2026-03-01T00:00:00.000Z" },
  { id: "price_vfv_1", symbol: "VFV", priceDate: "2025-10-01", close: 118.2, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2025-10-01T00:00:00.000Z" },
  { id: "price_vfv_2", symbol: "VFV", priceDate: "2025-11-01", close: 121.4, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2025-11-01T00:00:00.000Z" },
  { id: "price_vfv_3", symbol: "VFV", priceDate: "2025-12-01", close: 123.9, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2025-12-01T00:00:00.000Z" },
  { id: "price_vfv_4", symbol: "VFV", priceDate: "2026-01-01", close: 126.5, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "price_vfv_5", symbol: "VFV", priceDate: "2026-02-01", close: 129.1, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2026-02-01T00:00:00.000Z" },
  { id: "price_vfv_6", symbol: "VFV", priceDate: "2026-03-01", close: 132.8, adjustedClose: null, currency: "CAD", source: "seed", createdAt: "2026-03-01T00:00:00.000Z" }
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
    source: "manual",
    rebalancingTolerancePct: 4,
    watchlistSymbols: ["XBB", "VCN", "XEF"],
    recommendationConstraints: {
      excludedSymbols: [],
      preferredSymbols: ["XBB", "VCN", "XEF"],
      excludedSecurities: [],
      preferredSecurities: [
        { symbol: "XBB", exchange: "TSX", currency: "CAD", name: "iShares Core Canadian Universe Bond Index ETF", provider: "seed" },
        { symbol: "VCN", exchange: "TSX", currency: "CAD", name: "Vanguard FTSE Canada All Cap Index ETF", provider: "seed" },
        { symbol: "XEF", exchange: "TSX", currency: "CAD", name: "iShares Core MSCI EAFE IMI Index ETF", provider: "seed" }
      ],
      assetClassBands: [],
      avoidAccountTypes: [],
      preferredAccountTypes: [],
      allowedSecurityTypes: []
    },
    preferenceFactors: DEFAULT_PREFERENCE_FACTORS
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
    watchlistSymbols: ["XEQT", "VFV", "XEF"],
    recommendationConstraints: {
      excludedSymbols: [],
      preferredSymbols: ["XEQT", "VFV", "XEF"],
      excludedSecurities: [],
      preferredSecurities: [
        { symbol: "XEQT", exchange: "TSX", currency: "CAD", name: "iShares Core Equity ETF Portfolio", provider: "seed" },
        { symbol: "VFV", exchange: "TSX", currency: "CAD", name: "Vanguard S&P 500 Index ETF", provider: "seed" },
        { symbol: "XEF", exchange: "TSX", currency: "CAD", name: "iShares Core MSCI EAFE IMI Index ETF", provider: "seed" }
      ],
      assetClassBands: [],
      avoidAccountTypes: [],
      preferredAccountTypes: [],
      allowedSecurityTypes: []
    },
    preferenceFactors: {
      ...DEFAULT_PREFERENCE_FACTORS,
      behavior: {
        ...DEFAULT_PREFERENCE_FACTORS.behavior,
        riskCapacity: "high",
        volatilityComfort: "high",
        concentrationTolerance: "high"
      },
      sectorTilts: {
        ...DEFAULT_PREFERENCE_FACTORS.sectorTilts,
        preferredSectors: ["Technology", "Energy"],
        styleTilts: ["Growth"]
      }
    }
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
    workflow: "portfolio",
    status: "validated",
    sourceType: "csv",
    fileName: "questrade-holdings-march.csv",
    createdAt: "2026-03-16T15:00:00.000Z"
  },
  {
    id: "import_casey",
    userId: "user_casey",
    workflow: "portfolio",
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
