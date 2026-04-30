import "package:flutter_test/flutter_test.dart";
import "package:loo_wealth_mobile/features/overview/data/mobile_home_models.dart";
import "package:loo_wealth_mobile/features/portfolio/data/mobile_portfolio_models.dart";
import "package:loo_wealth_mobile/features/shared/data/mobile_chart_models.dart";
import "package:loo_wealth_mobile/features/shared/data/loo_minister_context_models.dart";
import "package:loo_wealth_mobile/features/shared/data/mobile_models.dart";

void main() {
  const now = "2026-04-30T04:00:00.000Z";

  test("serializes overview minister context for cross-page Q&A", () {
    const context = LooMinisterPageContext(
      page: "overview",
      title: "Loo国总览",
      asOf: now,
      facts: [
        LooMinisterFact(
          id: "net-worth",
          label: "总资产",
          value: "CAD 100,000",
        ),
      ],
    );

    final json = context.toJson();

    expect(context.isValidLocalShape, isTrue);
    expect(json["version"], looMinisterContextVersion);
    expect(json["locale"], "zh");
    expect((json["facts"] as List).single["id"], "net-worth");
  });

  test("keeps security identity as symbol plus exchange plus currency", () {
    const usdCommon = LooMinisterSecurityIdentity(
      symbol: "AMZN",
      exchange: "NASDAQ",
      currency: "USD",
      name: "Amazon.com",
    );
    const cadListed = LooMinisterSecurityIdentity(
      symbol: "AMZN",
      exchange: "NEO",
      currency: "CAD",
      name: "Amazon CDR",
    );

    expect(usdCommon.toJson()["symbol"], cadListed.toJson()["symbol"]);
    expect(usdCommon.toJson(), isNot(cadListed.toJson()));
    expect(usdCommon.hasCompleteListingIdentity, isTrue);
    expect(cadListed.hasCompleteListingIdentity, isTrue);
  });

  test("rejects partial local security identity", () {
    const context = LooMinisterPageContext(
      page: "security-detail",
      title: "VFV",
      asOf: now,
      subject: LooMinisterSubject(
        security: LooMinisterSecurityIdentity(
          symbol: "VFV",
          exchange: "TSX",
        ),
      ),
    );

    expect(context.isValidLocalShape, isFalse);
  });

  test("requires confirmation for mutating minister actions", () {
    const unsafeAction = LooMinisterSuggestedAction(
      id: "apply-preferences",
      label: "应用新的投资偏好",
      actionType: "update-preferences",
    );
    const safeAction = LooMinisterSuggestedAction(
      id: "open-health",
      label: "查看健康分",
      actionType: "navigate",
      target: {"page": "portfolio-health"},
    );

    expect(unsafeAction.isSafeConfirmationState, isFalse);
    expect(safeAction.isSafeConfirmationState, isTrue);
  });

  test("does not let reference curves masquerade as local real data", () {
    const context = LooMinisterPageContext(
      page: "portfolio",
      title: "组合御览",
      asOf: now,
      dataFreshness: LooMinisterDataFreshness(
        chartFreshness: "reference",
        sourceMode: "local",
      ),
    );

    expect(context.isValidLocalShape, isFalse);
  });

  test("builds overview minister context from typed home snapshot", () {
    const snapshot = MobileHomeSnapshot(
      viewerName: "Loo国居民",
      metrics: [
        MobileMetric(label: "总资产", value: "CAD 100,000", detail: "当前净值"),
      ],
      health: MobileHomeHealth(
        score: "82 分",
        status: "稳定",
        highlights: ["US Equity 高于目标。"],
      ),
      accounts: [],
      topHoldings: [],
      netWorthTrend: [],
      netWorthChart: MobileChartSeries(
        title: "总资产走势",
        valueType: "money",
        sourceMode: "local",
        freshness: MobileChartFreshness(
          status: "fresh",
          label: "最新",
          latestDate: "2026-04-30",
          detail: "使用本地快照。",
        ),
        points: [
          MobileChartPoint(
            label: "4/29",
            value: 99000,
            displayValue: "CAD 99,000",
            rawDate: "2026-04-29",
          ),
          MobileChartPoint(
            label: "4/30",
            value: 100000,
            displayValue: "CAD 100,000",
            rawDate: "2026-04-30",
          ),
        ],
        notes: ["走势使用组合快照。"],
      ),
      fxContext: MobileFxContext(
        label: "1 USD = 1.37 CAD",
        note: "仅展示折算。",
        asOf: "2026-04-30T04:00:00.000Z",
        source: "cached",
        freshness: "fresh",
      ),
      recommendationTheme: "补足固定收益",
      recommendationReason: "当前组合波动略高。",
    );

    final context = snapshot.toMinisterContext(asOf: now);
    final json = context.toJson();
    final factIds =
        (json["facts"] as List).map((item) => item["id"] as String).toSet();

    expect(context.isValidLocalShape, isTrue);
    expect(json["page"], "overview");
    expect(factIds, contains("metric-总资产"));
    expect(factIds, contains("fx-context"));
    expect(factIds, contains("net-worth-chart"));
    expect(factIds, contains("recommendation-theme"));
    expect((json["warnings"] as List), contains("US Equity 高于目标。"));
  });

  test("builds portfolio minister context from typed portfolio snapshot", () {
    const snapshot = MobilePortfolioSnapshot(
      accounts: [],
      holdings: [],
      quoteStatus: "报价刚刚刷新",
      healthScore: "78 分",
      summaryPoints: ["US Equity 超过目标。"],
      performance: [],
      portfolioValueChart: MobileChartSeries(
        title: "组合价值走势",
        valueType: "money",
        sourceMode: "local",
        freshness: MobileChartFreshness(
          status: "fresh",
          label: "最新",
          latestDate: "2026-04-30",
          detail: "使用本地组合快照。",
        ),
        points: [
          MobileChartPoint(
            label: "4/29",
            value: 99000,
            displayValue: "CAD 99,000",
            rawDate: "2026-04-29",
          ),
          MobileChartPoint(
            label: "4/30",
            value: 100000,
            displayValue: "CAD 100,000",
            rawDate: "2026-04-30",
          ),
        ],
        notes: ["走势使用组合快照。"],
      ),
      fxContext: MobileFxContext(
        label: "1 USD = 1.37 CAD",
        note: "组合汇总使用 CAD。",
        asOf: "2026-04-30T04:00:00.000Z",
        source: "cached",
        freshness: "fresh",
      ),
      accountTypeAllocation: [
        MobilePortfolioAllocationPoint(
          name: "TFSA",
          value: 45,
          displayValue: "45.0%",
          detail: "免税账户",
        ),
      ],
      accountInstanceAllocation: [],
      assetClassDrilldown: [
        MobileAssetClassDrilldown(
          id: "us-equity",
          name: "US Equity",
          value: "CAD 42,000",
          currentPct: 42,
          targetPct: 32,
          driftPct: 10,
          current: "42.0%",
          target: "32.0%",
          driftLabel: "+10.0%",
          summary: "高于目标",
          actions: ["暂停新增 US Equity。"],
          valueHistoryChart: null,
          holdings: [],
        ),
      ],
    );

    final context = snapshot.toMinisterContext(asOf: now);
    final json = context.toJson();
    final factIds =
        (json["facts"] as List).map((item) => item["id"] as String).toSet();

    expect(context.isValidLocalShape, isTrue);
    expect(json["page"], "portfolio");
    expect(factIds, contains("quote-status"));
    expect(factIds, contains("portfolio-value-chart"));
    expect(factIds, contains("asset-class-us-equity"));
    expect((json["warnings"] as List), contains("US Equity 超过目标。"));
  });
}
