import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/mobile_models.dart";

class MobileHomeSnapshot {
  const MobileHomeSnapshot({
    required this.viewerName,
    required this.metrics,
    required this.health,
    required this.accounts,
    required this.topHoldings,
    required this.netWorthTrend,
    required this.netWorthChart,
    required this.fxContext,
    required this.recommendationTheme,
    required this.recommendationReason,
  });

  final String viewerName;
  final List<MobileMetric> metrics;
  final MobileHomeHealth health;
  final List<MobileAccountCard> accounts;
  final List<MobileHoldingCard> topHoldings;
  final List<MobileHomeTrendPoint> netWorthTrend;
  final MobileChartSeries? netWorthChart;
  final MobileFxContext fxContext;
  final String recommendationTheme;
  final String recommendationReason;

  factory MobileHomeSnapshot.fromJson(Map<String, dynamic> json) {
    final viewer = json["viewer"];
    final recommendation = json["recommendation"];

    return MobileHomeSnapshot(
      viewerName: viewer is Map<String, dynamic>
          ? viewer["displayName"] as String? ?? "Loo国居民"
          : "Loo国居民",
      metrics:
          readJsonList(json, "metrics").map(MobileMetric.fromJson).toList(),
      health: MobileHomeHealth.fromJson(json["healthScore"]),
      accounts: readJsonList(json, "accounts")
          .map(MobileAccountCard.fromJson)
          .toList(),
      topHoldings: readJsonList(json, "topHoldings")
          .map(MobileHoldingCard.fromJson)
          .toList(),
      netWorthTrend: readJsonList(json, "netWorthTrend")
          .map(MobileHomeTrendPoint.fromJson)
          .toList(),
      netWorthChart: MobileChartSeries.fromJson(
        (json["chartSeries"] is Map<String, dynamic>
            ? json["chartSeries"] as Map<String, dynamic>
            : const <String, dynamic>{})["netWorth"],
      ),
      fxContext: MobileFxContext.fromJson(json["displayContext"]),
      recommendationTheme: recommendation is Map<String, dynamic>
          ? recommendation["theme"] as String? ?? "暂无推荐主题"
          : "暂无推荐主题",
      recommendationReason: recommendation is Map<String, dynamic>
          ? recommendation["reason"] as String? ?? "完成数据导入后，Loo国会生成组合建议。"
          : "完成数据导入后，Loo国会生成组合建议。",
    );
  }
}

class MobileHomeHealth {
  const MobileHomeHealth({
    required this.score,
    required this.status,
    required this.highlights,
  });

  final String score;
  final String status;
  final List<String> highlights;

  factory MobileHomeHealth.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileHomeHealth(
      score: "${json["score"] ?? "--"} 分",
      status: json["status"] as String? ?? "待评估",
      highlights: (json["highlights"] as List?)?.whereType<String>().toList() ??
          const [],
    );
  }
}

class MobileHomeTrendPoint {
  const MobileHomeTrendPoint({
    required this.label,
    required this.displayValue,
    required this.chartValue,
  });

  final String label;
  final String displayValue;
  final double chartValue;

  factory MobileHomeTrendPoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];
    return MobileHomeTrendPoint(
      label: json["label"] as String? ?? "未知日期",
      displayValue: rawValue is num
          ? rawValue.toStringAsFixed(2)
          : rawValue?.toString() ?? "--",
      chartValue: rawValue is num ? rawValue.toDouble() : 0,
    );
  }
}
