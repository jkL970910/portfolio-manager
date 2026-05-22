import assert from "node:assert/strict";
import test from "node:test";

import type {
  CashAccount,
  InvestmentAccount,
  PreferenceProfile,
  RegisteredAccountRoom,
} from "@/lib/backend/models";
import { DEFAULT_RECOMMENDATION_CONSTRAINTS } from "@/lib/backend/recommendation-constraints";
import { DEFAULT_PREFERENCE_FACTORS } from "@/lib/backend/preference-factors";
import {
  buildDashboardData,
  buildImportData,
} from "@/lib/backend/view-builders";

test("manual cash accounts enter the import view contract", () => {
  const account: CashAccount = {
    id: "cash_test",
    userId: "user_demo",
    institution: "QA Bank",
    nickname: "QA Cash",
    currency: "CAD",
    currentBalanceAmount: 1234,
    currentBalanceCad: 1234,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
  };

  const view = buildImportData({
    latestPortfolioJob: null,
    latestSpendingJob: null,
    accounts: [],
    cashAccounts: [account],
    language: "zh",
  });
  const cashAccount = view.existingCashAccounts.find((item) => item.id === account.id);

  assert.ok(cashAccount);
  assert.equal(cashAccount.nickname, "QA Cash");
  assert.equal(cashAccount.currentBalanceCad, 1234);
});

test("cash accounts feed buying power without changing registered room", () => {
  const cashAccount: CashAccount = {
    id: "cash_buying_power",
    userId: "user_demo",
    institution: "QA Bank",
    nickname: "QA Cash",
    currency: "CAD",
    currentBalanceAmount: 1500,
    currentBalanceCad: 1500,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
  };

  const dashboard = buildDashboardData({
    viewer: {
      id: "user_demo",
      email: "demo@example.com",
      displayName: "Demo",
      baseCurrency: "CAD",
      displayLanguage: "en",
    },
    snapshots: [],
    accounts: [
      {
        id: "acct_tfsa",
        userId: "user_demo",
        institution: "QA Broker",
        type: "TFSA",
        nickname: "TFSA",
        currency: "CAD",
        marketValueCad: 10000,
        contributionRoomCad: 6000,
      },
    ],
    holdings: [],
    transactions: [],
    cashAccounts: [cashAccount],
    cashAccountBalanceEvents: [],
    priceHistory: [],
    portfolioEvents: [],
    profile: {
      id: "pref_demo",
      userId: "user_demo",
      riskProfile: "Balanced",
      targetAllocation: [],
      accountFundingPriority: ["TFSA", "RRSP", "FHSA", "Taxable"],
      taxAwarePlacement: true,
      cashBufferTargetCad: 10000,
      transitionPreference: "gradual",
      recommendationStrategy: "balanced",
      source: "manual",
      rebalancingTolerancePct: 5,
      watchlistSymbols: [],
      recommendationConstraints: DEFAULT_RECOMMENDATION_CONSTRAINTS,
      preferenceFactors: DEFAULT_PREFERENCE_FACTORS,
    } satisfies PreferenceProfile,
    latestRun: null,
    display: {
      currency: "CAD",
      cadToDisplayRate: 1,
      usdToCadRate: 1.38,
      fxRateDate: "2026-05-22",
      fxRateSource: "test",
      fxRateFreshness: "fresh",
    },
  });

  assert.equal(
    dashboard.metrics.find((metric) => metric.label === "Registered Room")?.value,
    "$6,000",
  );
  assert.equal(dashboard.buyingPower.totalCad, 1500);
  assert.equal(dashboard.buyingPower.value, "$1,500");
});

test("shared registered account room prevents duplicate TFSA room counting", () => {
  const accounts: InvestmentAccount[] = [
    {
      id: "acct_tfsa_a",
      userId: "user_demo",
      institution: "Broker A",
      type: "TFSA",
      nickname: "TFSA A",
      currency: "CAD",
      marketValueCad: 10000,
      contributionRoomCad: 7000,
    },
    {
      id: "acct_tfsa_b",
      userId: "user_demo",
      institution: "Broker B",
      type: "TFSA",
      nickname: "TFSA B",
      currency: "CAD",
      marketValueCad: 5000,
      contributionRoomCad: 7000,
    },
  ];
  const registeredRooms: RegisteredAccountRoom[] = [
    {
      id: "room_tfsa_2026",
      userId: "user_demo",
      accountType: "TFSA",
      taxYear: new Date().getFullYear(),
      remainingRoomCad: 7000,
      note: "Shared TFSA room across all TFSA accounts.",
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z",
    },
  ];

  const dashboard = buildDashboardData({
    viewer: {
      id: "user_demo",
      email: "demo@example.com",
      displayName: "Demo",
      baseCurrency: "CAD",
      displayLanguage: "en",
    },
    snapshots: [],
    accounts,
    registeredRooms,
    holdings: [],
    transactions: [],
    cashAccounts: [],
    cashAccountBalanceEvents: [],
    priceHistory: [],
    portfolioEvents: [],
    profile: {
      id: "pref_demo",
      userId: "user_demo",
      riskProfile: "Balanced",
      targetAllocation: [],
      accountFundingPriority: ["TFSA", "RRSP", "FHSA", "Taxable"],
      taxAwarePlacement: true,
      cashBufferTargetCad: 10000,
      transitionPreference: "gradual",
      recommendationStrategy: "balanced",
      source: "manual",
      rebalancingTolerancePct: 5,
      watchlistSymbols: [],
      recommendationConstraints: DEFAULT_RECOMMENDATION_CONSTRAINTS,
      preferenceFactors: DEFAULT_PREFERENCE_FACTORS,
    } satisfies PreferenceProfile,
    latestRun: null,
    display: {
      currency: "CAD",
      cadToDisplayRate: 1,
      usdToCadRate: 1.38,
      fxRateDate: "2026-05-22",
      fxRateSource: "test",
      fxRateFreshness: "fresh",
    },
  });

  assert.equal(dashboard.registeredRoom.source, "shared");
  assert.equal(dashboard.registeredRoom.totalCad, 7000);
  assert.equal(
    dashboard.metrics.find((metric) => metric.label === "Registered Room")?.value,
    "$7,000",
  );
});
