import "package:flutter_test/flutter_test.dart";
import "package:loo_wealth_mobile/features/overview/data/mobile_home_models.dart";
import "package:loo_wealth_mobile/features/portfolio/data/mobile_portfolio_models.dart";
import "package:loo_wealth_mobile/features/portfolio/presentation/account_detail_page.dart";
import "package:loo_wealth_mobile/features/portfolio/presentation/health_score_page.dart";
import "package:loo_wealth_mobile/features/portfolio/presentation/holding_detail_page.dart";
import "package:loo_wealth_mobile/features/portfolio/presentation/security_detail_page.dart";
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

  test("builds detail-page minister contexts with stable subjects", () {
    const account = MobileAccountDetailSnapshot(
      name: "TFSA",
      typeId: "TFSA",
      institution: "WS",
      currency: "CAD",
      value: "CAD 50,000",
      gainLoss: "+CAD 2,000",
      portfolioShare: "50.0%",
      room: "可用额度 CAD 10,000",
      subtitle: "TFSA · WS · 50.0%",
      summaryPoints: ["账户集中在 US Equity。"],
      performance: [],
      accountValueChart: null,
      allocation: [],
      healthScore: MobileAccountHealthScore(
        score: "78 分",
        status: "需巡查",
        highlights: ["集中度偏高。"],
        actions: ["补充固定收益。"],
      ),
      facts: [],
      holdings: [],
    );

    const holding = MobileHoldingDetailSnapshot(
      id: "holding-1",
      symbol: "VFV",
      name: "Vanguard S&P 500 Index ETF",
      accountId: "account-1",
      accountName: "TFSA",
      currency: "CAD",
      identityExchange: "TSX",
      accountType: "TFSA",
      assetClass: "US Equity",
      sector: "ETF",
      exchange: "TSX",
      securityType: "ETF",
      value: "CAD 12,000",
      lastPrice: "CAD 150",
      lastUpdated: "2026-04-30T04:00:00.000Z",
      freshnessVariant: "success",
      quoteProvider: "cache",
      quoteStatusLabel: "报价较新",
      portfolioShare: "12.0%",
      accountShare: "24.0%",
      gainLoss: "+CAD 500",
      subtitle: "TFSA · 12.0% · +CAD 500",
      quantityLine: "80 shares",
      quoteLine: "报价较新 · cache · CAD 150",
      fxLine: "",
      facts: [],
      marketData: MobileMarketData(
        summary: "行情来自本地缓存。",
        notes: ["按 TSX/CAD 身份读取。"],
        facts: [],
      ),
      performance: [],
      holdingValueChart: null,
      portfolioRole: ["提供 US Equity 暴露。"],
      healthSummary: MobileHealthSummary(
        score: "75 分",
        status: "可持有",
        summary: "需要关注集中度。",
        drivers: ["US Equity 已高于目标。"],
        actions: ["新增资金优先补其他资产。"],
      ),
    );

    const security = MobileSecurityDetailSnapshot(
      securityId: "security_vfv_cad",
      symbol: "VFV",
      name: "Vanguard S&P 500 Index ETF",
      assetClass: "US Equity",
      sector: "ETF",
      currency: "CAD",
      exchange: "TSX",
      lastPrice: "CAD 150",
      quoteTimestamp: "2026-04-30T04:00:00.000Z",
      freshnessVariant: "success",
      quoteStatusLabel: "报价较新",
      subtitle: "US Equity · ETF · TSX",
      marketData: MobileSecurityMarketData(
        summary: "报价来自缓存。",
        notes: ["CAD listing。"],
        facts: [],
      ),
      analysis: MobileSecurityAnalysis(
        assetClassLabel: "US Equity",
        targetAllocation: "32.0%",
        currentAllocation: "42.0%",
        driftLabel: "+10.0%",
        portfolioShare: "12.0%",
        targetAllocationPct: 32,
        currentAllocationPct: 42,
        portfolioSharePct: 12,
        summary: "US Equity 高于目标。",
      ),
      performance: [],
      priceHistoryChart: null,
      summaryPoints: ["CAD 版本不得混同 USD 正股。"],
      facts: [],
      relatedHoldings: [],
      heldPosition: null,
    );

    final accountContext =
        account.toMinisterContext(accountId: "account-1", asOf: now);
    final holdingContext = holding.toMinisterContext(asOf: now);
    final securityContext = security.toMinisterContext(asOf: now);

    expect(accountContext.isValidLocalShape, isTrue);
    expect(accountContext.toJson()["subject"]["accountId"], "account-1");
    expect(holdingContext.isValidLocalShape, isTrue);
    expect(holdingContext.toJson()["subject"]["holdingId"], "holding-1");
    expect(
      holdingContext.toJson()["subject"]["security"]["currency"],
      "CAD",
    );
    expect(securityContext.isValidLocalShape, isTrue);
    expect(securityContext.toJson()["subject"]["security"]["exchange"], "TSX");
  });

  test("builds portfolio health minister context", () {
    const snapshot = MobileHealthSnapshot(
      scopeName: "全组合健康",
      scopeLabel: "全组合健康",
      scopeDetail: "按总目标配置和风险平衡判断。",
      isAccountScope: false,
      score: "81 分",
      status: "稳定",
      strongestDimension:
          MobileHealthDimensionPair(label: "账户效率", value: "90 分"),
      weakestDimension: MobileHealthDimensionPair(label: "资产配置", value: "66 分"),
      highlights: ["US Equity 高于目标。"],
      actionQueue: ["补充固定收益。"],
      radar: [MobileHealthRadarPoint(dimension: "配置", value: 66)],
      dimensions: [],
      accountDrilldown: [],
      holdingDrilldown: [],
    );

    final context = snapshot.toMinisterContext(accountId: null, asOf: now);
    final json = context.toJson();

    expect(context.isValidLocalShape, isTrue);
    expect(json["page"], "portfolio-health");
    expect((json["facts"] as List).map((item) => item["id"]),
        contains("health-score"));
    expect((json["warnings"] as List), contains("US Equity 高于目标。"));
  });
}
