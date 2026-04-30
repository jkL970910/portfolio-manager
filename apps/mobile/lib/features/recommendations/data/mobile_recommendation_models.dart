import "../../shared/data/mobile_models.dart";

class MobileRecommendationsSnapshot {
  const MobileRecommendationsSnapshot({
    required this.contributionAmount,
    required this.engineLine,
    required this.inputs,
    required this.preferenceContext,
    required this.intelligenceBriefs,
    required this.explainer,
    required this.priorities,
    required this.scenarios,
    required this.notes,
  });

  final String contributionAmount;
  final String engineLine;
  final List<MobileRecommendationInput> inputs;
  final MobilePreferenceContext preferenceContext;
  final List<MobileIntelligenceBrief> intelligenceBriefs;
  final List<String> explainer;
  final List<MobileRecommendationPriority> priorities;
  final List<MobileRecommendationScenario> scenarios;
  final List<String> notes;

  factory MobileRecommendationsSnapshot.fromJson(Map<String, dynamic> json) {
    final engine = json["engine"];
    final engineData =
        engine is Map<String, dynamic> ? engine : const <String, dynamic>{};

    return MobileRecommendationsSnapshot(
      contributionAmount: json["contributionAmount"] as String? ?? "--",
      engineLine: [
        engineData["version"] as String? ?? "",
        engineData["confidence"] as String? ?? "",
        engineData["objective"] as String? ?? "",
      ].where((item) => item.isNotEmpty).join(" · "),
      inputs: readJsonList(json, "inputs")
          .map(MobileRecommendationInput.fromJson)
          .toList(),
      preferenceContext:
          MobilePreferenceContext.fromJson(json["preferenceContext"]),
      intelligenceBriefs: readJsonList(json, "intelligenceBriefs")
          .map(MobileIntelligenceBrief.fromJson)
          .toList(),
      explainer: (json["explainer"] as List?)?.whereType<String>().toList() ??
          const [],
      priorities: readJsonList(json, "priorities")
          .map(MobileRecommendationPriority.fromJson)
          .toList(),
      scenarios: readJsonList(json, "scenarios")
          .map(MobileRecommendationScenario.fromJson)
          .toList(),
      notes: (json["notes"] as List?)?.whereType<String>().toList() ?? const [],
    );
  }
}

class MobileIntelligenceBrief {
  const MobileIntelligenceBrief({
    required this.id,
    required this.title,
    required this.detail,
    required this.sourceLabel,
    required this.freshnessLabel,
    required this.generatedAt,
    required this.symbols,
    required this.sources,
  });

  final String id;
  final String title;
  final String detail;
  final String sourceLabel;
  final String freshnessLabel;
  final String generatedAt;
  final List<String> symbols;
  final List<MobileRecommendationInput> sources;

  factory MobileIntelligenceBrief.fromJson(Map<String, dynamic> json) {
    return MobileIntelligenceBrief(
      id: json["id"] as String? ?? "",
      title: json["title"] as String? ?? "Loo国秘闻",
      detail: json["detail"] as String? ?? "",
      sourceLabel: json["sourceLabel"] as String? ?? "本地快扫",
      freshnessLabel: json["freshnessLabel"] as String? ?? "暂无行情新鲜度",
      generatedAt: json["generatedAt"] as String? ?? "",
      symbols:
          (json["symbols"] as List?)?.whereType<String>().toList() ?? const [],
      sources: readJsonList(json, "sources").map((source) {
        return MobileRecommendationInput(
          label: source["sourceType"] as String? ?? "source",
          value: [
            source["title"] as String? ?? "来源",
            source["date"] as String?,
          ].whereType<String>().where((item) => item.isNotEmpty).join(" · "),
        );
      }).toList(),
    );
  }
}

class MobilePreferenceContext {
  const MobilePreferenceContext({
    required this.riskProfile,
    required this.targetAllocation,
    required this.accountFundingPriority,
    required this.taxAwarePlacement,
    required this.recommendationStrategy,
    required this.rebalancingTolerancePct,
    required this.watchlistSymbols,
  });

  final String riskProfile;
  final List<MobileRecommendationInput> targetAllocation;
  final List<String> accountFundingPriority;
  final bool taxAwarePlacement;
  final String recommendationStrategy;
  final int rebalancingTolerancePct;
  final List<String> watchlistSymbols;

  String get riskLabel => switch (riskProfile) {
        "Conservative" => "保守",
        "Growth" => "成长",
        _ => "平衡",
      };

  String get allocationLine => targetAllocation
      .map((target) => "${target.label} ${target.value}%")
      .join(" · ");

  factory MobilePreferenceContext.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    final allocations = json["targetAllocation"];
    return MobilePreferenceContext(
      riskProfile: json["riskProfile"] as String? ?? "Balanced",
      targetAllocation: allocations is List
          ? allocations.whereType<Map<String, dynamic>>().map((target) {
              return MobileRecommendationInput(
                label: target["assetClass"] as String? ?? "Unknown",
                value: ((target["targetPct"] as num?)?.toInt() ?? 0).toString(),
              );
            }).toList()
          : const [],
      accountFundingPriority: (json["accountFundingPriority"] as List?)
              ?.whereType<String>()
              .toList() ??
          const [],
      taxAwarePlacement: json["taxAwarePlacement"] as bool? ?? false,
      recommendationStrategy:
          json["recommendationStrategy"] as String? ?? "balanced",
      rebalancingTolerancePct:
          (json["rebalancingTolerancePct"] as num?)?.toInt() ?? 10,
      watchlistSymbols:
          (json["watchlistSymbols"] as List?)?.whereType<String>().toList() ??
              const [],
    );
  }
}

class MobileRecommendationInput {
  const MobileRecommendationInput({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  factory MobileRecommendationInput.fromJson(Map<String, dynamic> json) {
    return MobileRecommendationInput(
      label: json["label"] as String? ?? "未知输入",
      value: json["value"] as String? ?? "--",
    );
  }
}

class MobileRecommendationPriority {
  const MobileRecommendationPriority({
    required this.assetClass,
    required this.description,
    required this.amount,
    required this.account,
    required this.security,
    required this.scoreline,
    required this.gapSummary,
    required this.whyThis,
    required this.whyNot,
    required this.alternatives,
    required this.intelligenceRefs,
    required this.constraints,
    required this.execution,
  });

  final String assetClass;
  final String description;
  final String amount;
  final String account;
  final String security;
  final String scoreline;
  final String gapSummary;
  final List<String> whyThis;
  final List<String> whyNot;
  final List<String> alternatives;
  final List<MobileRecommendationIntelligenceRef> intelligenceRefs;
  final List<MobileRecommendationConstraint> constraints;
  final List<MobileRecommendationInput> execution;

  factory MobileRecommendationPriority.fromJson(Map<String, dynamic> json) {
    return MobileRecommendationPriority(
      assetClass: json["assetClass"] as String? ?? "未知资产",
      description: json["description"] as String? ?? "",
      amount: json["amount"] as String? ?? "--",
      account: json["account"] as String? ?? "",
      security: json["security"] as String? ?? "",
      scoreline: json["scoreline"] as String? ?? "",
      gapSummary: json["gapSummary"] as String? ?? "",
      whyThis:
          (json["whyThis"] as List?)?.whereType<String>().toList() ?? const [],
      whyNot:
          (json["whyNot"] as List?)?.whereType<String>().toList() ?? const [],
      alternatives:
          (json["alternatives"] as List?)?.whereType<String>().toList() ??
              const [],
      intelligenceRefs: readJsonList(json, "intelligenceRefs")
          .map(MobileRecommendationIntelligenceRef.fromJson)
          .toList(),
      constraints: readJsonList(json, "constraints")
          .map(MobileRecommendationConstraint.fromJson)
          .toList(),
      execution: readJsonList(json, "execution")
          .map(MobileRecommendationInput.fromJson)
          .toList(),
    );
  }
}

class MobileRecommendationIntelligenceRef {
  const MobileRecommendationIntelligenceRef({
    required this.title,
    required this.detail,
    required this.sourceLabel,
    required this.freshnessLabel,
    required this.scopeLabel,
    required this.listingLabel,
  });

  final String title;
  final String detail;
  final String sourceLabel;
  final String freshnessLabel;
  final String scopeLabel;
  final String listingLabel;

  factory MobileRecommendationIntelligenceRef.fromJson(
    Map<String, dynamic> json,
  ) {
    return MobileRecommendationIntelligenceRef(
      title: json["title"] as String? ?? "Loo国秘闻",
      detail: json["detail"] as String? ?? "",
      sourceLabel: json["sourceLabel"] as String? ?? "本地快扫",
      freshnessLabel: json["freshnessLabel"] as String? ?? "暂无行情新鲜度",
      scopeLabel: json["scopeLabel"] as String? ?? "底层资产情报",
      listingLabel: json["listingLabel"] as String? ?? "",
    );
  }
}

class MobileRecommendationConstraint {
  const MobileRecommendationConstraint({
    required this.label,
    required this.detail,
    required this.variant,
  });

  final String label;
  final String detail;
  final String variant;

  factory MobileRecommendationConstraint.fromJson(Map<String, dynamic> json) {
    return MobileRecommendationConstraint(
      label: json["label"] as String? ?? "约束",
      detail: json["detail"] as String? ?? "",
      variant: json["variant"] as String? ?? "neutral",
    );
  }
}

class MobileRecommendationScenario {
  const MobileRecommendationScenario({
    required this.label,
    required this.amount,
    required this.summary,
    required this.diffs,
  });

  final String label;
  final String amount;
  final String summary;
  final List<String> diffs;

  factory MobileRecommendationScenario.fromJson(Map<String, dynamic> json) {
    return MobileRecommendationScenario(
      label: json["label"] as String? ?? "情景",
      amount: json["amount"] as String? ?? "--",
      summary: json["summary"] as String? ?? "",
      diffs: (json["diffs"] as List?)?.whereType<String>().toList() ?? const [],
    );
  }
}
