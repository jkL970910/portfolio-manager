const kPreferenceRiskPresets = {
  "Conservative": {
    "Canadian Equity": 18,
    "US Equity": 22,
    "International Equity": 10,
    "Fixed Income": 35,
    "Cash": 15,
  },
  "Balanced": {
    "Canadian Equity": 22,
    "US Equity": 32,
    "International Equity": 16,
    "Fixed Income": 20,
    "Cash": 10,
  },
  "Growth": {
    "Canadian Equity": 16,
    "US Equity": 42,
    "International Equity": 22,
    "Fixed Income": 10,
    "Cash": 10,
  },
};

class MobilePreferenceProfile {
  const MobilePreferenceProfile({
    required this.riskProfile,
    required this.targetAllocation,
    required this.accountFundingPriority,
    required this.taxAwarePlacement,
    required this.cashBufferTargetCad,
    required this.transitionPreference,
    required this.recommendationStrategy,
    required this.rebalancingTolerancePct,
    required this.watchlistSymbols,
    required this.recommendationConstraints,
  });

  final String riskProfile;
  final List<MobileTargetAllocation> targetAllocation;
  final List<String> accountFundingPriority;
  final bool taxAwarePlacement;
  final double cashBufferTargetCad;
  final String transitionPreference;
  final String recommendationStrategy;
  final int rebalancingTolerancePct;
  final List<String> watchlistSymbols;
  final MobileRecommendationConstraints recommendationConstraints;

  String get riskProfileLabel => switch (riskProfile) {
        "Conservative" => "保守",
        "Growth" => "成长",
        _ => "平衡",
      };

  String get summary {
    final equity = targetAllocation
        .where((target) =>
            target.assetClass != "Fixed Income" && target.assetClass != "Cash")
        .fold<int>(0, (sum, target) => sum + target.targetPct);
    final fixedIncome = allocationPct("Fixed Income");
    final cash = allocationPct("Cash");
    return "$riskProfileLabel · 股/债/现金 $equity/$fixedIncome/$cash";
  }

  int allocationPct(String assetClass) {
    return targetAllocation
        .firstWhere(
          (target) => target.assetClass == assetClass,
          orElse: () =>
              MobileTargetAllocation(assetClass: assetClass, targetPct: 0),
        )
        .targetPct;
  }

  factory MobilePreferenceProfile.fromJson(Map<String, dynamic> json) {
    return MobilePreferenceProfile(
      riskProfile: json["riskProfile"] as String? ?? "Balanced",
      targetAllocation: (json["targetAllocation"] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(MobileTargetAllocation.fromJson)
              .toList() ??
          const [],
      accountFundingPriority: (json["accountFundingPriority"] as List?)
              ?.whereType<String>()
              .toList() ??
          const ["TFSA", "RRSP", "Taxable"],
      taxAwarePlacement: json["taxAwarePlacement"] as bool? ?? true,
      cashBufferTargetCad:
          (json["cashBufferTargetCad"] as num?)?.toDouble() ?? 0,
      transitionPreference:
          json["transitionPreference"] as String? ?? "gradual",
      recommendationStrategy:
          json["recommendationStrategy"] as String? ?? "balanced",
      rebalancingTolerancePct:
          (json["rebalancingTolerancePct"] as num?)?.toInt() ?? 10,
      watchlistSymbols:
          (json["watchlistSymbols"] as List?)?.whereType<String>().toList() ??
              const [],
      recommendationConstraints: MobileRecommendationConstraints.fromJson(
          json["recommendationConstraints"]),
    );
  }
}

class MobileRecommendationConstraints {
  const MobileRecommendationConstraints({
    required this.excludedSymbols,
    required this.preferredSymbols,
    required this.excludedSecurities,
    required this.preferredSecurities,
    required this.assetClassBands,
    required this.avoidAccountTypes,
    required this.preferredAccountTypes,
    required this.allowedSecurityTypes,
  });

  final List<String> excludedSymbols;
  final List<String> preferredSymbols;
  final List<Map<String, dynamic>> excludedSecurities;
  final List<Map<String, dynamic>> preferredSecurities;
  final List<Map<String, dynamic>> assetClassBands;
  final List<String> avoidAccountTypes;
  final List<String> preferredAccountTypes;
  final List<String> allowedSecurityTypes;

  factory MobileRecommendationConstraints.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileRecommendationConstraints(
      excludedSymbols:
          (json["excludedSymbols"] as List?)?.whereType<String>().toList() ??
              const [],
      preferredSymbols:
          (json["preferredSymbols"] as List?)?.whereType<String>().toList() ??
              const [],
      excludedSecurities: (json["excludedSecurities"] as List?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [],
      preferredSecurities: (json["preferredSecurities"] as List?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [],
      assetClassBands: (json["assetClassBands"] as List?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [],
      avoidAccountTypes:
          (json["avoidAccountTypes"] as List?)?.whereType<String>().toList() ??
              const [],
      preferredAccountTypes: (json["preferredAccountTypes"] as List?)
              ?.whereType<String>()
              .toList() ??
          const [],
      allowedSecurityTypes: (json["allowedSecurityTypes"] as List?)
              ?.whereType<String>()
              .toList() ??
          const [],
    );
  }
}

class MobileGuidedDraft {
  const MobileGuidedDraft({
    required this.answers,
    required this.riskProfile,
    required this.targetAllocation,
    required this.accountFundingPriority,
    required this.taxAwarePlacement,
    required this.cashBufferTargetCad,
    required this.transitionPreference,
    required this.recommendationStrategy,
    required this.rebalancingTolerancePct,
    required this.assumptions,
    required this.rationale,
  });

  final Map<String, String> answers;
  final String riskProfile;
  final List<MobileTargetAllocation> targetAllocation;
  final List<String> accountFundingPriority;
  final bool taxAwarePlacement;
  final double cashBufferTargetCad;
  final String transitionPreference;
  final String recommendationStrategy;
  final int rebalancingTolerancePct;
  final List<String> assumptions;
  final List<String> rationale;

  String get riskLabel => switch (riskProfile) {
        "Conservative" => "保守",
        "Growth" => "成长",
        _ => "平衡",
      };

  String get summary {
    final equity = targetAllocation
        .where((target) =>
            target.assetClass != "Fixed Income" && target.assetClass != "Cash")
        .fold<int>(0, (sum, target) => sum + target.targetPct);
    final fixedIncome = targetAllocation
        .firstWhere((target) => target.assetClass == "Fixed Income")
        .targetPct;
    final cash = targetAllocation
        .firstWhere((target) => target.assetClass == "Cash")
        .targetPct;
    return "$riskLabel · 股/债/现金 $equity/$fixedIncome/$cash · ${accountFundingPriority.join(" -> ")}";
  }

  Map<String, dynamic> get suggestedProfilePayload => {
        "riskProfile": riskProfile,
        "targetAllocation": targetAllocation
            .map((target) => {
                  "assetClass": target.assetClass,
                  "targetPct": target.targetPct,
                })
            .toList(),
        "accountFundingPriority": accountFundingPriority,
        "taxAwarePlacement": taxAwarePlacement,
        "cashBufferTargetCad": cashBufferTargetCad,
        "transitionPreference": transitionPreference,
        "recommendationStrategy": recommendationStrategy,
        "rebalancingTolerancePct": rebalancingTolerancePct,
      };

  Map<String, dynamic> toDraftPayload() {
    return {
      "answers": answers,
      "suggestedProfile": suggestedProfilePayload,
      "assumptions": assumptions,
      "rationale": rationale,
    };
  }

  factory MobileGuidedDraft.fromAnswers({
    required String goal,
    required String horizon,
    required String volatility,
    required String priority,
    required String cashNeed,
  }) {
    var score = 0;
    if (horizon == "long") score += 1;
    if (volatility == "high") score += 1;
    if (goal == "wealth" || goal == "retirement") score += 1;
    if (cashNeed == "high") score -= 1;
    if (goal == "capital-preservation") score -= 2;
    if (goal == "home" && horizon == "short") score -= 2;

    final riskProfile = score >= 2
        ? "Growth"
        : score <= 0
            ? "Conservative"
            : "Balanced";
    final allocation = kPreferenceRiskPresets[riskProfile]!
        .entries
        .map((entry) => MobileTargetAllocation(
              assetClass: entry.key,
              targetPct: entry.value,
            ))
        .toList();

    int indexOf(String assetClass) =>
        allocation.indexWhere((target) => target.assetClass == assetClass);
    void adjust(String assetClass, int delta) {
      final index = indexOf(assetClass);
      if (index < 0) return;
      final current = allocation[index];
      allocation[index] = MobileTargetAllocation(
        assetClass: current.assetClass,
        targetPct: current.targetPct + delta,
      );
    }

    if (goal == "home" || cashNeed == "high") {
      adjust("Fixed Income", 5);
      adjust("Cash", 5);
      adjust("US Equity", -10);
    } else if (volatility == "high" && horizon == "long") {
      adjust("International Equity", 4);
      adjust("Fixed Income", -2);
      adjust("Cash", -2);
    }

    final transitionPreference = priority == "stay-close"
        ? "stay-close"
        : horizon == "short"
            ? "gradual"
            : "direct";
    final recommendationStrategy = priority == "tax-efficiency"
        ? "tax-aware"
        : priority == "stay-close"
            ? "balanced"
            : "target-first";
    final taxAwarePlacement = priority == "tax-efficiency";
    final cashBufferTargetCad = cashNeed == "high"
        ? 15000.0
        : cashNeed == "medium"
            ? 8000.0
            : 4000.0;
    final rebalancingTolerancePct = horizon == "short"
        ? 8
        : volatility == "high"
            ? 14
            : 10;
    final accountFundingPriority = goal == "home"
        ? ["FHSA", "TFSA", "RRSP"]
        : goal == "retirement"
            ? ["RRSP", "TFSA", "Taxable"]
            : priority == "tax-efficiency"
                ? ["TFSA", "RRSP", "Taxable"]
                : ["TFSA", "Taxable", "RRSP"];

    return MobileGuidedDraft(
      answers: {
        "goal": goal,
        "horizon": horizon,
        "volatility": volatility,
        "priority": priority,
        "cashNeed": cashNeed,
      },
      riskProfile: riskProfile,
      targetAllocation: allocation,
      accountFundingPriority: accountFundingPriority,
      taxAwarePlacement: taxAwarePlacement,
      cashBufferTargetCad: cashBufferTargetCad,
      transitionPreference: transitionPreference,
      recommendationStrategy: recommendationStrategy,
      rebalancingTolerancePct: rebalancingTolerancePct,
      assumptions: [
        "目标：$goal",
        "期限：$horizon",
        "波动承受：$volatility",
        "现金需求：$cashNeed",
      ],
      rationale: [
        "根据期限、目标和波动承受度，将风险档位设为 $riskProfile。",
        taxAwarePlacement ? "启用税务感知放置，优先使用更合适的账户桶。" : "使用较简洁的账户匹配规则。",
        "调整节奏设为 $transitionPreference，推荐策略设为 $recommendationStrategy。",
      ],
    );
  }
}

class MobileTargetAllocation {
  const MobileTargetAllocation({
    required this.assetClass,
    required this.targetPct,
  });

  final String assetClass;
  final int targetPct;

  factory MobileTargetAllocation.fromJson(Map<String, dynamic> json) {
    return MobileTargetAllocation(
      assetClass: json["assetClass"] as String? ?? "Unknown",
      targetPct: (json["targetPct"] as num?)?.toInt() ?? 0,
    );
  }
}
