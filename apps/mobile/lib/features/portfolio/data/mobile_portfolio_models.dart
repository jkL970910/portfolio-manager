import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/loo_minister_context_models.dart";
import "../../shared/data/mobile_models.dart";

class MobilePortfolioSnapshot {
  const MobilePortfolioSnapshot({
    required this.accounts,
    required this.holdings,
    required this.quoteStatus,
    required this.healthScore,
    required this.summaryPoints,
    required this.performance,
    required this.portfolioValueChart,
    required this.fxContext,
    required this.accountTypeAllocation,
    required this.accountInstanceAllocation,
    required this.assetClassDrilldown,
  });

  final List<MobileAccountCard> accounts;
  final List<MobileHoldingCard> holdings;
  final String quoteStatus;
  final String healthScore;
  final List<String> summaryPoints;
  final List<MobilePortfolioPerformancePoint> performance;
  final MobileChartSeries? portfolioValueChart;
  final MobileFxContext fxContext;
  final List<MobilePortfolioAllocationPoint> accountTypeAllocation;
  final List<MobilePortfolioAllocationPoint> accountInstanceAllocation;
  final List<MobileAssetClassDrilldown> assetClassDrilldown;

  LooMinisterPageContext toMinisterContext({required String asOf}) {
    final chart = portfolioValueChart;
    return LooMinisterPageContext(
      page: "portfolio",
      title: "组合御览",
      asOf: asOf,
      displayCurrency: "CAD",
      dataFreshness: LooMinisterDataFreshness(
        fxAsOf: _toIsoDateTimeOrNull(fxContext.asOf),
        chartFreshness: _toMinisterChartFreshness(chart?.freshness.status),
        sourceMode: _toMinisterSourceMode(chart?.sourceMode),
      ),
      facts: [
        LooMinisterFact(
          id: "health-score",
          label: "组合健康分",
          value: healthScore,
          detail: summaryPoints.take(3).join("；"),
          source: "analysis-cache",
        ),
        LooMinisterFact(
          id: "quote-status",
          label: "报价状态",
          value: quoteStatus,
          source: "quote-cache",
        ),
        if (fxContext.hasContent)
          LooMinisterFact(
            id: "fx-context",
            label: "FX 折算口径",
            value: fxContext.label.isEmpty
                ? fxContext.statusLabel
                : fxContext.label,
            detail: fxContext.note.isEmpty ? null : fxContext.note,
            source: "fx-cache",
          ),
        if (chart != null)
          LooMinisterFact(
            id: "portfolio-value-chart",
            label: chart.title,
            value: chart.freshness.label,
            detail: chart.freshness.detail,
            source: "portfolio-data",
          ),
        LooMinisterFact(
          id: "account-count",
          label: "账户数量",
          value: "${accounts.length} 个",
        ),
        LooMinisterFact(
          id: "holding-count",
          label: "持仓数量",
          value: "${holdings.length} 个",
        ),
        ...accountTypeAllocation.take(5).map(
              (point) => LooMinisterFact(
                id: "account-type-${_slug(point.name)}",
                label: "账户类型 ${point.name}",
                value: point.displayValue,
                detail: point.detail.isEmpty ? null : point.detail,
              ),
            ),
        ...assetClassDrilldown.take(6).map(
              (item) => LooMinisterFact(
                id: "asset-class-${_slug(item.id.isEmpty ? item.name : item.id)}",
                label: "资产类别 ${item.name}",
                value: item.current,
                detail: "目标 ${item.target} · 偏离 ${item.driftLabel}",
                source: "analysis-cache",
              ),
            ),
      ],
      warnings: [
        ...summaryPoints.take(4),
        ...assetClassDrilldown
            .where((item) => item.actions.isNotEmpty)
            .take(4)
            .map((item) => "${item.name}: ${item.actions.first}"),
        if (chart != null && chart.notes.isNotEmpty) ...chart.notes.take(3),
      ],
      allowedActions: const [
        LooMinisterSuggestedAction(
          id: "open-health-score",
          label: "查看组合健康分",
          actionType: "navigate",
          target: {"page": "portfolio-health"},
        ),
        LooMinisterSuggestedAction(
          id: "run-portfolio-analysis",
          label: "运行 AI 组合快扫",
          actionType: "run-analysis",
          target: {"page": "portfolio-health"},
          requiresConfirmation: true,
        ),
      ],
    );
  }

  factory MobilePortfolioSnapshot.fromJson(Map<String, dynamic> json) {
    final quoteStatus = json["quoteStatus"];
    final healthScore = json["healthScore"];

    return MobilePortfolioSnapshot(
      accounts: readJsonList(json, "accountCards")
          .map(MobileAccountCard.fromJson)
          .toList(),
      holdings: readJsonList(json, "holdings")
          .map(MobileHoldingCard.fromJson)
          .toList(),
      quoteStatus: quoteStatus is Map<String, dynamic>
          ? quoteStatus["lastRefreshed"] as String? ?? "报价状态待刷新"
          : "报价状态待刷新",
      healthScore: healthScore is Map<String, dynamic>
          ? "${healthScore["score"] ?? "--"} 分"
          : "-- 分",
      summaryPoints:
          (json["summaryPoints"] as List?)?.whereType<String>().toList() ??
              const [],
      performance: readJsonList(json, "performance")
          .map(MobilePortfolioPerformancePoint.fromJson)
          .toList(),
      portfolioValueChart: MobileChartSeries.fromJson(
        (json["chartSeries"] is Map<String, dynamic>
            ? json["chartSeries"] as Map<String, dynamic>
            : const <String, dynamic>{})["portfolioValue"],
      ),
      fxContext: MobileFxContext.fromJson(json["displayContext"]),
      accountTypeAllocation: readJsonList(json, "accountTypeAllocation")
          .map(MobilePortfolioAllocationPoint.fromJson)
          .toList(),
      accountInstanceAllocation: readJsonList(json, "accountInstanceAllocation")
          .map(MobilePortfolioAllocationPoint.fromJson)
          .toList(),
      assetClassDrilldown: readJsonList(json, "assetClassDrilldown")
          .map(MobileAssetClassDrilldown.fromJson)
          .toList(),
    );
  }

  MobilePortfolioSnapshot filteredByAccountType(String accountType) {
    return MobilePortfolioSnapshot(
      accounts:
          accounts.where((account) => account.typeId == accountType).toList(),
      holdings: holdings
          .where((holding) => holding.accountType == accountType)
          .toList(),
      quoteStatus: "已筛选 $accountType 账户类型 · $quoteStatus",
      healthScore: healthScore,
      summaryPoints: summaryPoints,
      performance: performance,
      portfolioValueChart: portfolioValueChart,
      fxContext: fxContext,
      accountTypeAllocation: accountTypeAllocation,
      accountInstanceAllocation: accountInstanceAllocation,
      assetClassDrilldown: assetClassDrilldown,
    );
  }
}

String _toMinisterChartFreshness(String? value) {
  return switch (value) {
    "fresh" => "fresh",
    "stale" => "stale",
    "fallback" => "fallback",
    "reference" => "reference",
    _ => "unknown",
  };
}

String _toMinisterSourceMode(String? value) {
  return switch (value) {
    "local" => "local",
    "cached-external" => "cached-external",
    "live-external" => "live-external",
    "reference" => "reference",
    _ => "local",
  };
}

String? _toIsoDateTimeOrNull(String? value) {
  if (value == null || value.isEmpty) return null;
  return DateTime.tryParse(value)?.toUtc().toIso8601String();
}

String _slug(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r"[^a-z0-9\u4e00-\u9fa5]+"), "-")
      .replaceAll(RegExp(r"^-+|-+$"), "");
}

class MobilePortfolioPerformancePoint {
  const MobilePortfolioPerformancePoint({
    required this.label,
    required this.displayValue,
    required this.chartValue,
  });

  final String label;
  final String displayValue;
  final double chartValue;

  factory MobilePortfolioPerformancePoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];
    return MobilePortfolioPerformancePoint(
      label: json["label"] as String? ?? "未知日期",
      displayValue: rawValue is num
          ? rawValue.toStringAsFixed(2)
          : rawValue?.toString() ?? "--",
      chartValue: rawValue is num ? rawValue.toDouble() : 0,
    );
  }
}

class MobilePortfolioAllocationPoint {
  const MobilePortfolioAllocationPoint({
    required this.name,
    required this.value,
    required this.displayValue,
    required this.detail,
  });

  final String name;
  final double value;
  final String displayValue;
  final String detail;

  factory MobilePortfolioAllocationPoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];
    final value = rawValue is num ? rawValue.toDouble() : 0.0;
    return MobilePortfolioAllocationPoint(
      name: json["name"] as String? ?? "未知配置",
      value: value,
      displayValue: "${value.toStringAsFixed(1)}%",
      detail: json["detail"] as String? ?? "",
    );
  }
}

class MobileAssetClassDrilldown {
  const MobileAssetClassDrilldown({
    required this.id,
    required this.name,
    required this.value,
    required this.currentPct,
    required this.targetPct,
    required this.driftPct,
    required this.current,
    required this.target,
    required this.driftLabel,
    required this.summary,
    required this.actions,
    required this.valueHistoryChart,
    required this.holdings,
  });

  final String id;
  final String name;
  final String value;
  final double currentPct;
  final double targetPct;
  final double driftPct;
  final String current;
  final String target;
  final String driftLabel;
  final String summary;
  final List<String> actions;
  final MobileChartSeries? valueHistoryChart;
  final List<MobileHoldingCard> holdings;

  factory MobileAssetClassDrilldown.fromJson(Map<String, dynamic> json) {
    return MobileAssetClassDrilldown(
      id: json["id"] as String? ?? "",
      name: json["name"] as String? ?? "未知资产类别",
      value: json["value"] as String? ?? "--",
      currentPct: _readDouble(json["currentPct"]),
      targetPct: _readDouble(json["targetPct"]),
      driftPct: _readDouble(json["driftPct"]),
      current: json["current"] as String? ?? "--",
      target: json["target"] as String? ?? "--",
      driftLabel: json["driftLabel"] as String? ?? "--",
      summary: json["summary"] as String? ?? "",
      actions:
          (json["actions"] as List?)?.whereType<String>().toList() ?? const [],
      valueHistoryChart: MobileChartSeries.fromJson(
        (json["chartSeries"] is Map<String, dynamic>
            ? json["chartSeries"] as Map<String, dynamic>
            : const <String, dynamic>{})["valueHistory"],
      ),
      holdings: readJsonList(json, "holdings")
          .map(MobileHoldingCard.fromJson)
          .toList(),
    );
  }
}

double _readDouble(Object? value) {
  return value is num ? value.toDouble() : 0.0;
}
