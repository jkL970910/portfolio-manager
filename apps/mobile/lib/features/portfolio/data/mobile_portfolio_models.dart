import "../../shared/data/mobile_chart_models.dart";
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
