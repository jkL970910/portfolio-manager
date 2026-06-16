import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/loo_minister_context_models.dart";
import "../../shared/data/mobile_models.dart";
import "../../onboarding/data/mobile_onboarding_models.dart";

class MobileHomeSnapshot {
  const MobileHomeSnapshot({
    required this.viewerName,
    required this.citizenProfile,
    required this.metrics,
    required this.health,
    required this.accounts,
    required this.topHoldings,
    required this.buyingPower,
    required this.registeredRoom,
    this.holdingCount = 0,
    required this.netWorthTrend,
    required this.netWorthChart,
    required this.investedAssetChart,
    required this.fxContext,
    required this.recommendationTheme,
    required this.recommendationReason,
    required this.marketSentiment,
    required this.onboarding,
  });

  final String viewerName;
  final MobileHomeCitizenProfile citizenProfile;
  final List<MobileMetric> metrics;
  final MobileHomeHealth health;
  final List<MobileAccountCard> accounts;
  final List<MobileHoldingCard> topHoldings;
  final MobileBuyingPower buyingPower;
  final MobileRegisteredRoomSummary registeredRoom;
  final int holdingCount;
  final List<MobileHomeTrendPoint> netWorthTrend;
  final MobileChartSeries? netWorthChart;
  final MobileChartSeries? investedAssetChart;
  final MobileFxContext fxContext;
  final String recommendationTheme;
  final String recommendationReason;
  final MobileMarketSentiment? marketSentiment;
  final MobileOnboardingState onboarding;

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
        LooMinisterFact(
          id: "security-count",
          label: "标的数量",
          value: "$holdingCount 个",
          source: "portfolio-data",
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
          label: "开始国库巡阅",
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
    final context = json["context"];

    return MobileHomeSnapshot(
      viewerName: viewer is Map<String, dynamic>
          ? viewer["displayName"] as String? ?? "Loo国居民"
          : "Loo国居民",
      citizenProfile: MobileHomeCitizenProfile.fromJson(
        json["citizenProfile"],
      ),
      metrics:
          readJsonList(json, "metrics").map(MobileMetric.fromJson).toList(),
      health: MobileHomeHealth.fromJson(json["healthScore"]),
      accounts: readJsonList(json, "accounts")
          .map(MobileAccountCard.fromJson)
          .toList(),
      topHoldings: readJsonList(json, "topHoldings")
          .map(MobileHoldingCard.fromJson)
          .toList(),
      buyingPower: MobileBuyingPower.fromJson(json["buyingPower"]),
      registeredRoom:
          MobileRegisteredRoomSummary.fromJson(json["registeredRoom"]),
      holdingCount: context is Map<String, dynamic>
          ? context["holdingCount"] as int? ?? 0
          : 0,
      netWorthTrend: readJsonList(json, "netWorthTrend")
          .map(MobileHomeTrendPoint.fromJson)
          .toList(),
      netWorthChart: MobileChartSeries.fromJson(
        (json["chartSeries"] is Map<String, dynamic>
            ? json["chartSeries"] as Map<String, dynamic>
            : const <String, dynamic>{})["netWorth"],
      ),
      investedAssetChart: MobileChartSeries.fromJson(
        (json["chartSeries"] is Map<String, dynamic>
            ? json["chartSeries"] as Map<String, dynamic>
            : const <String, dynamic>{})["investedAsset"],
      ),
      fxContext: MobileFxContext.fromJson(json["displayContext"]),
      recommendationTheme: recommendation is Map<String, dynamic>
          ? recommendation["theme"] as String? ?? "暂无推荐主题"
          : "暂无推荐主题",
      recommendationReason: recommendation is Map<String, dynamic>
          ? recommendation["reason"] as String? ?? "完成数据导入后，Loo国会生成组合建议。"
          : "完成数据导入后，Loo国会生成组合建议。",
      marketSentiment: MobileMarketSentiment.tryParse(json["marketSentiment"]),
      onboarding: MobileOnboardingState.fromJson(json["onboarding"]),
    );
  }
}

class MobileBuyingPower {
  const MobileBuyingPower({
    required this.label,
    required this.value,
    required this.detail,
    required this.confidence,
  });

  final String label;
  final String value;
  final String detail;
  final String confidence;

  factory MobileBuyingPower.fromJson(dynamic json) {
    if (json is! Map<String, dynamic>) {
      return const MobileBuyingPower(
        label: "Buying Power",
        value: "--",
        detail: "尚未添加现金账户。",
        confidence: "low",
      );
    }
    return MobileBuyingPower(
      label: json["label"] as String? ?? "Buying Power",
      value: json["value"] as String? ?? "--",
      detail: json["detail"] as String? ?? "",
      confidence: json["confidence"] as String? ?? "low",
    );
  }
}

class MobileHomeCitizenProfile {
  const MobileHomeCitizenProfile({
    required this.name,
    required this.rankLabel,
    required this.addressLabel,
    required this.idCode,
    required this.wealthSnapshotLabel,
    required this.avatarAsset,
  });

  final String name;
  final String rankLabel;
  final String addressLabel;
  final String idCode;
  final String wealthSnapshotLabel;
  final String avatarAsset;

  factory MobileHomeCitizenProfile.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    final rank = json["effectiveRank"] as String? ?? "citizen";
    final address = json["effectiveAddressTier"] as String? ?? "city";
    final avatar = json["avatarType"] as String? ?? "default";
    final wealth = (json["wealthScoreSnapshotCad"] as num?)?.toDouble() ?? 0;
    final wealthLabel = wealth
        .toStringAsFixed(0)
        .replaceAllMapped(RegExp(r"\B(?=(\d{3})+(?!\d))"), (match) => ",");
    return MobileHomeCitizenProfile(
      name: json["citizenName"] as String? ?? "Loo国居民",
      rankLabel: _rankLabel(rank),
      addressLabel: _addressLabel(address),
      idCode: json["effectiveIdCode"] as String? ?? "LOO-未颁发",
      wealthSnapshotLabel: "CAD $wealthLabel",
      avatarAsset: _avatarAsset(avatar, rank),
    );
  }

  static String _rankLabel(String value) {
    return switch (value) {
      "lowly-ox" => "低等牛",
      "base-loo" => "原皮Loo",
      "general" => "Loo皇大将军",
      "emperor" => "Loo皇",
      _ => "Loo国子民",
    };
  }

  static String _addressLabel(String value) {
    return switch (value) {
      "cowshed" => "牛棚",
      "suburbs" => "Loo国郊区",
      "palace-gate" => "Loo皇殿前",
      "bedchamber" => "Loo皇寝宫",
      _ => "Loo国城内",
    };
  }

  static String _avatarAsset(String avatar, String rank) {
    if (avatar == "male") return "assets/images/mascot/loo_male.jpg";
    if (avatar == "female") return "assets/images/mascot/loo_female.jpg";
    if (rank == "emperor") return "assets/images/mascot/loo_king.jpg";
    return switch (rank) {
      "lowly-ox" => "assets/images/mascot/rank_lowly_ox.jpg",
      "base-loo" => "assets/images/mascot/rank_base_loo.jpg",
      "general" => "assets/images/mascot/rank_general.jpg",
      _ => "assets/images/mascot/citizen_default.jpg",
    };
  }
}

class MobileMarketSentiment {
  const MobileMarketSentiment({
    required this.title,
    required this.score,
    required this.ratingLabel,
    required this.fgiLabel,
    required this.fgiSourceMode,
    required this.fgiScore,
    required this.fgiChange,
    required this.fgiLevelLabel,
    required this.vixValue,
    required this.vixChange,
    required this.vixLevelLabel,
    required this.scoreChange,
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
    required this.indexPerformances,
    required this.macroIndicators,
  });

  final String title;
  final int score;
  final String ratingLabel;
  final String fgiLabel;
  final String fgiSourceMode;
  final int fgiScore;
  final double fgiChange;
  final String fgiLevelLabel;
  final double? vixValue;
  final double? vixChange;
  final String vixLevelLabel;
  final double scoreChange;
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
  final List<MobileMarketIndexPerformance> indexPerformances;
  final List<MobileMarketPulseIndicator> macroIndicators;

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
      fgiLabel: value["fgiLabel"] as String? ?? "Loo 情绪分",
      fgiSourceMode: value["fgiSourceMode"] as String? ?? "derived",
      fgiScore: (value["fgiScore"] as num?)?.round() ??
          (value["score"] as num?)?.round() ??
          50,
      fgiChange: (value["fgiChange"] as num?)?.toDouble() ?? 0,
      fgiLevelLabel: value["fgiLevelLabel"] as String? ?? "中性",
      vixValue: (value["vixValue"] as num?)?.toDouble(),
      vixChange: (value["vixChange"] as num?)?.toDouble(),
      vixLevelLabel: value["vixLevelLabel"] as String? ?? "波动待确认",
      scoreChange: (value["scoreChange"] as num?)?.toDouble() ?? 0,
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
      indexPerformances: readJsonList(value, "indexPerformances")
          .map(MobileMarketIndexPerformance.fromJson)
          .toList(),
      macroIndicators: readJsonList(value, "macroIndicators")
          .map(MobileMarketPulseIndicator.fromJson)
          .toList(),
    );
  }
}

class MobileMarketPulseIndicator {
  const MobileMarketPulseIndicator({
    required this.id,
    required this.label,
    required this.value,
    required this.changeLabel,
    required this.levelLabel,
    required this.detail,
    required this.sourceLabel,
    required this.asOf,
    required this.score,
  });

  final String id;
  final String label;
  final String value;
  final String changeLabel;
  final String levelLabel;
  final String detail;
  final String sourceLabel;
  final String asOf;
  final double? score;

  factory MobileMarketPulseIndicator.fromJson(Map<String, dynamic> json) {
    return MobileMarketPulseIndicator(
      id: json["id"] as String? ?? "",
      label: json["label"] as String? ?? "指标",
      value: json["value"] as String? ?? "--",
      changeLabel: json["changeLabel"] as String? ?? "--",
      levelLabel: json["levelLabel"] as String? ?? "待确认",
      detail: json["detail"] as String? ?? "",
      sourceLabel: json["sourceLabel"] as String? ?? "",
      asOf: json["asOf"] as String? ?? "",
      score: (json["score"] as num?)?.toDouble(),
    );
  }
}

class MobileMarketIndexPerformance {
  const MobileMarketIndexPerformance({
    required this.id,
    required this.label,
    required this.value,
    required this.changePct,
    required this.changeLabel,
    required this.points,
    required this.sourceLabel,
  });

  final String id;
  final String label;
  final String value;
  final double? changePct;
  final String changeLabel;
  final List<double> points;
  final String sourceLabel;

  factory MobileMarketIndexPerformance.fromJson(Map<String, dynamic> json) {
    return MobileMarketIndexPerformance(
      id: json["id"] as String? ?? "",
      label: json["label"] as String? ?? "指数",
      value: json["value"] as String? ?? "--",
      changePct: (json["changePct"] as num?)?.toDouble(),
      changeLabel: json["changeLabel"] as String? ?? "--",
      points: (json["points"] as List? ?? const [])
          .map((point) => point is num ? point.toDouble() : null)
          .whereType<double>()
          .toList(),
      sourceLabel: json["sourceLabel"] as String? ?? "",
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

class MobileRegisteredRoomSummary {
  const MobileRegisteredRoomSummary({
    required this.totalCad,
    required this.source,
    required this.taxYear,
    required this.rooms,
  });

  final double totalCad;
  final String source;
  final int taxYear;
  final List<MobileRegisteredRoomLine> rooms;

  String get value {
    final rounded = totalCad.round().toString();
    final buffer = StringBuffer();
    for (var index = 0; index < rounded.length; index += 1) {
      final reverseIndex = rounded.length - index;
      buffer.write(rounded[index]);
      if (reverseIndex > 1 && reverseIndex % 3 == 1) {
        buffer.write(",");
      }
    }
    return "CAD $buffer";
  }

  String get detail => source == "shared" ? "$taxYear 剩余 room · 点开看明细" : "$taxYear 旧账户额度 · 建议在设置维护";

  factory MobileRegisteredRoomSummary.fromJson(dynamic json) {
    if (json is! Map<String, dynamic>) {
      return MobileRegisteredRoomSummary(
        totalCad: 0,
        source: "legacy_accounts",
        taxYear: DateTime.now().year,
        rooms: const [],
      );
    }
    return MobileRegisteredRoomSummary(
      totalCad: (json["totalCad"] as num?)?.toDouble() ?? 0,
      source: json["source"] as String? ?? "legacy_accounts",
      taxYear: (json["taxYear"] as num?)?.toInt() ?? DateTime.now().year,
      rooms: readJsonList(json, "rooms")
          .map(MobileRegisteredRoomLine.fromJson)
          .toList(),
    );
  }
}

class MobileRegisteredRoomLine {
  const MobileRegisteredRoomLine({
    required this.accountType,
    required this.remainingRoomCad,
    required this.contributedYtdCad,
    required this.startingRoomCad,
    required this.usedPct,
    required this.label,
    required this.value,
    required this.contributedValue,
    required this.startingValue,
    required this.sourceLabel,
    required this.usageLabel,
    this.note,
  });

  final String accountType;
  final double remainingRoomCad;
  final double contributedYtdCad;
  final double? startingRoomCad;
  final double? usedPct;
  final String label;
  final String value;
  final String contributedValue;
  final String? startingValue;
  final String sourceLabel;
  final String usageLabel;
  final String? note;

  factory MobileRegisteredRoomLine.fromJson(Map<String, dynamic> json) {
    return MobileRegisteredRoomLine(
      accountType: json["accountType"] as String? ?? "",
      remainingRoomCad: (json["remainingRoomCad"] as num?)?.toDouble() ?? 0,
      contributedYtdCad:
          (json["contributedYtdCad"] as num?)?.toDouble() ?? 0,
      startingRoomCad: (json["startingRoomCad"] as num?)?.toDouble(),
      usedPct: (json["usedPct"] as num?)?.toDouble(),
      label: json["label"] as String? ?? json["accountType"] as String? ?? "",
      value: json["value"] as String? ?? "",
      contributedValue: json["contributedValue"] as String? ?? "CAD 0",
      startingValue: json["startingValue"] as String?,
      sourceLabel: json["sourceLabel"] as String? ?? "尚无本年度供款快照",
      usageLabel: json["usageLabel"] as String? ?? "暂无进度",
      note: json["note"] as String?,
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
