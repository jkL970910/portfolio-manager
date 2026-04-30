import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/loo_minister_context_models.dart";
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

  LooMinisterPageContext toMinisterContext({required String asOf}) {
    final chart = netWorthChart;
    return LooMinisterPageContext(
      page: "overview",
      title: "Loo国总览",
      asOf: asOf,
      displayCurrency: "CAD",
      dataFreshness: LooMinisterDataFreshness(
        fxAsOf: _toIsoDateTimeOrNull(fxContext.asOf),
        chartFreshness: _toMinisterChartFreshness(chart?.freshness.status),
        sourceMode: _toMinisterSourceMode(chart?.sourceMode),
      ),
      facts: [
        ...metrics.take(6).map(
              (metric) => LooMinisterFact(
                id: "metric-${_slug(metric.label)}",
                label: metric.label,
                value: metric.value,
                detail: metric.detail.isEmpty ? null : metric.detail,
              ),
            ),
        LooMinisterFact(
          id: "health-score",
          label: "健康分",
          value: health.score,
          detail: health.status,
          source: "analysis-cache",
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
            id: "net-worth-chart",
            label: chart.title,
            value: chart.freshness.label,
            detail: chart.freshness.detail,
            source: "portfolio-data",
          ),
        if (recommendationTheme.isNotEmpty)
          LooMinisterFact(
            id: "recommendation-theme",
            label: "推荐主题",
            value: recommendationTheme,
            detail: recommendationReason,
            source: "analysis-cache",
          ),
      ],
      warnings: [
        ...health.highlights.take(4),
        if (chart != null && chart.notes.isNotEmpty) ...chart.notes.take(3),
      ],
      allowedActions: const [
        LooMinisterSuggestedAction(
          id: "open-health-score",
          label: "查看国库健康巡查",
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
