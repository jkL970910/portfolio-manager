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
    required this.marketSentiment,
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
  final MobileMarketSentiment? marketSentiment;

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
        if (marketSentiment != null)
          LooMinisterFact(
            id: "market-sentiment",
            label: "今日市场脉搏",
            value:
                "VIX ${marketSentiment!.vixDisplay} · FGI ${marketSentiment!.fgiScore}/100 · 象限 ${marketSentiment!.quadrantLabel}",
            detail:
                "${marketSentiment!.strategyLabel}：${marketSentiment!.strategyDetail}",
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
      marketSentiment: MobileMarketSentiment.tryParse(json["marketSentiment"]),
    );
  }
}

class MobileMarketSentiment {
  const MobileMarketSentiment({
    required this.title,
    required this.score,
    required this.ratingLabel,
    required this.fgiScore,
    required this.fgiLevelLabel,
    required this.vixValue,
    required this.vixLevelLabel,
    required this.quadrant,
    required this.quadrantLabel,
    required this.strategyLabel,
    required this.strategyDetail,
    required this.buySignalLabel,
    required this.summary,
    required this.riskNote,
    required this.freshnessLabel,
    required this.sourceLabel,
    required this.components,
  });

  final String title;
  final int score;
  final String ratingLabel;
  final int fgiScore;
  final String fgiLevelLabel;
  final double? vixValue;
  final String vixLevelLabel;
  final String quadrant;
  final String quadrantLabel;
  final String strategyLabel;
  final String strategyDetail;
  final String buySignalLabel;
  final String summary;
  final String riskNote;
  final String freshnessLabel;
  final String sourceLabel;
  final List<MobileMarketSentimentComponent> components;

  bool get hasContent => title.isNotEmpty;
  String get vixDisplay =>
      vixValue == null ? "--" : vixValue!.toStringAsFixed(2);

  static MobileMarketSentiment? tryParse(Object? value) {
    if (value is! Map<String, dynamic>) {
      return null;
    }
    return MobileMarketSentiment(
      title: value["title"] as String? ?? "美股恐惧贪婪",
      score: (value["score"] as num?)?.round() ?? 50,
      ratingLabel: value["ratingLabel"] as String? ?? "中性",
      fgiScore: (value["fgiScore"] as num?)?.round() ??
          (value["score"] as num?)?.round() ??
          50,
      fgiLevelLabel: value["fgiLevelLabel"] as String? ?? "中性",
      vixValue: (value["vixValue"] as num?)?.toDouble(),
      vixLevelLabel: value["vixLevelLabel"] as String? ?? "波动待确认",
      quadrant: value["quadrant"] as String? ?? "",
      quadrantLabel: value["quadrantLabel"] as String? ?? "矩阵待确认",
      strategyLabel: value["strategyLabel"] as String? ?? "中性定投",
      strategyDetail:
          value["strategyDetail"] as String? ?? "按计划执行，市场脉搏只作为节奏参考。",
      buySignalLabel: value["buySignalLabel"] as String? ?? "按计划执行",
      summary: value["summary"] as String? ?? "",
      riskNote: value["riskNote"] as String? ?? "",
      freshnessLabel: value["freshnessLabel"] as String? ?? "",
      sourceLabel: value["sourceLabel"] as String? ?? "",
      components: readJsonList(value, "components")
          .map(MobileMarketSentimentComponent.fromJson)
          .toList(),
    );
  }
}

class MobileMarketSentimentComponent {
  const MobileMarketSentimentComponent({
    required this.label,
    required this.score,
    required this.detail,
  });

  final String label;
  final int score;
  final String detail;

  factory MobileMarketSentimentComponent.fromJson(Map<String, dynamic> json) {
    return MobileMarketSentimentComponent(
      label: json["label"] as String? ?? "情绪因子",
      score: (json["score"] as num?)?.round() ?? 50,
      detail: json["detail"] as String? ?? "",
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
