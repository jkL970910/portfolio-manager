import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:loo_wealth_mobile/features/intelligence/data/daily_intelligence_models.dart";
import "package:loo_wealth_mobile/features/intelligence/presentation/daily_intelligence_card.dart";

void main() {
  testWidgets("renders daily intelligence and opens security callback",
      (tester) async {
    MobileDailyIntelligenceItem? openedItem;
    const item = MobileDailyIntelligenceItem(
      id: "doc-1",
      title: "XBB 行情复核",
      summary: "XBB 报价较新，但仍需要保留 listing 身份。",
      sourceLabel: "行情资料",
      sourceType: "market-data",
      sourceMode: "cached-external",
      confidenceLabel: "可信度高",
      freshnessLabel: "来源 2026-04-30 · 过期 2026-05-01",
      relevanceLabel: "高相关",
      generatedAt: "2026-04-30T12:00:00.000Z",
      expiresAt: "2026-05-01T12:00:00.000Z",
      identity: MobileDailyIntelligenceIdentity(
        securityId: "sec-xbb",
        symbol: "XBB",
        exchange: "TSX",
        currency: "CAD",
        underlyingId: "",
      ),
      reason: "关联 XBB · TSX · CAD。",
      keyPoints: ["新闻情绪：Somewhat Bullish", "主题：Real Estate / Finance"],
      riskFlags: ["若 provider 限流，沿用旧报价。"],
      actions: [],
      sources: [
        MobileDailyIntelligenceSource(
          title: "cached-market-data",
          sourceType: "market-data",
          date: "2026-04-30",
          url: "",
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DailyIntelligenceCard(
            snapshot: const MobileDailyIntelligenceSnapshot(
              generatedAt: "2026-04-30T12:00:00.000Z",
              disclaimer: "只展示已整理资料，不实时抓取外部 API。",
              manualTriggerOnly: true,
              scheduledOverviewEnabled: false,
              securityManualRefreshEnabled: true,
              items: [item],
              emptyTitle: "暂时没有可用秘闻",
              emptyDetail: "先运行智能快扫。",
            ),
            isLoading: false,
            onViewSecurity: (item) => openedItem = item,
          ),
        ),
      ),
    );

    expect(find.text("Loo国今日秘闻"), findsOneWidget);
    expect(find.text("XBB 行情复核"), findsOneWidget);
    expect(find.textContaining("XBB 报价较新"), findsOneWidget);
    expect(find.text("生成 Loo皇总结"), findsOneWidget);
    expect(find.textContaining("新闻情绪"), findsNothing);
    expect(find.textContaining("主题"), findsNothing);

    await tester.tap(find.text("标的"));
    expect(openedItem?.identity.securityId, "sec-xbb");
  });

  test("parses source summary and impact fields", () {
    final summary = MobileDailyIntelligenceAiSummary.fromJson({
      "itemId": "doc-1",
      "generatedAt": "2026-06-16T02:00:00.000Z",
      "headline": "REIT 收购新闻",
      "coreSummary": "这条新闻影响地产资产观察。",
      "sourceSummary": "原文称大型机构正在收购加拿大公寓 REITs。",
      "affectedSectors": [
        {
          "label": "房地产 / REITs",
          "reason": "租赁需求和利率变化会影响估值。",
        },
      ],
      "affectedSecurities": [
        {
          "label": "Apartment REITs",
          "reason": "公寓 REITs 是新闻直接讨论的资产。",
        },
      ],
      "relatedFields": ["REITs"],
      "affectedHoldings": [],
      "portfolioImpact": "当前无直接持仓匹配，但可作为地产和利率敏感资产观察。",
      "watchPoints": ["确认是否影响基本面。"],
      "cached": false,
      "expiresAt": "2026-06-17T02:00:00.000Z",
    });

    expect(summary.sourceSummary, contains("大型机构"));
    expect(summary.affectedSectors.single.label, "房地产 / REITs");
    expect(summary.affectedSecurities.single.label, "Apartment REITs");
  });
}
