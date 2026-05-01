import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:loo_wealth_mobile/features/intelligence/data/daily_intelligence_models.dart";
import "package:loo_wealth_mobile/features/intelligence/presentation/daily_intelligence_card.dart";

void main() {
  testWidgets("renders cached daily intelligence and opens security callback",
      (tester) async {
    MobileDailyIntelligenceItem? openedItem;
    const item = MobileDailyIntelligenceItem(
      id: "doc-1",
      title: "XBB 缓存行情复核",
      summary: "缓存行情显示 XBB 报价较新，但仍需要保留 listing 身份。",
      sourceLabel: "缓存行情情报",
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
      keyPoints: ["价格历史按 listing 身份读取。"],
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
              disclaimer: "只展示缓存资料，不实时抓取外部 API。",
              manualTriggerOnly: true,
              items: [item],
              emptyTitle: "暂时没有可用秘闻",
              emptyDetail: "先运行 AI 快扫。",
            ),
            isLoading: false,
            onViewSecurity: (item) => openedItem = item,
          ),
        ),
      ),
    );

    expect(find.text("Loo国今日秘闻"), findsOneWidget);
    expect(find.text("XBB 缓存行情复核"), findsOneWidget);
    expect(find.text("缓存"), findsOneWidget);
    expect(find.text("XBB · TSX · CAD"), findsOneWidget);

    await tester.tap(find.text("查看标的"));
    expect(openedItem?.identity.securityId, "sec-xbb");
  });
}
