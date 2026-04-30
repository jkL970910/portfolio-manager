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
    required this.preferenceFactors,
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
  final MobilePreferenceFactors preferenceFactors;

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
      preferenceFactors:
          MobilePreferenceFactors.fromJson(json["preferenceFactors"]),
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

class MobilePreferenceFactors {
  const MobilePreferenceFactors({
    required this.riskCapacity,
    required this.volatilityComfort,
    required this.concentrationTolerance,
    required this.leverageAllowed,
    required this.optionsAllowed,
    required this.cryptoAllowed,
    required this.preferredSectors,
    required this.avoidedSectors,
    required this.styleTilts,
    required this.thematicInterests,
    required this.homePurchaseEnabled,
    required this.homePurchaseHorizonYears,
    required this.homeDownPaymentTargetCad,
    required this.homePurchasePriority,
    required this.emergencyFundTargetCad,
    required this.retirementHorizonYears,
    required this.province,
    required this.marginalTaxBracket,
    required this.rrspDeductionPriority,
    required this.tfsaGrowthPriority,
    required this.fhsaHomeGoalPriority,
    required this.taxableTaxSensitivity,
    required this.dividendWithholdingSensitivity,
    required this.usdFundingPath,
    required this.monthlyContributionCad,
    required this.minimumTradeSizeCad,
    required this.liquidityNeed,
    required this.cashDuringUncertainty,
    required this.allowNewsSignals,
    required this.allowInstitutionalSignals,
    required this.allowCommunitySignals,
    required this.preferredFreshnessHours,
    required this.maxDailyExternalCalls,
  });

  final String riskCapacity;
  final String volatilityComfort;
  final String concentrationTolerance;
  final bool leverageAllowed;
  final bool optionsAllowed;
  final bool cryptoAllowed;
  final List<String> preferredSectors;
  final List<String> avoidedSectors;
  final List<String> styleTilts;
  final List<String> thematicInterests;
  final bool homePurchaseEnabled;
  final double? homePurchaseHorizonYears;
  final double? homeDownPaymentTargetCad;
  final String homePurchasePriority;
  final double? emergencyFundTargetCad;
  final double? retirementHorizonYears;
  final String? province;
  final String? marginalTaxBracket;
  final String rrspDeductionPriority;
  final String tfsaGrowthPriority;
  final String fhsaHomeGoalPriority;
  final String taxableTaxSensitivity;
  final String dividendWithholdingSensitivity;
  final String usdFundingPath;
  final double? monthlyContributionCad;
  final double? minimumTradeSizeCad;
  final String liquidityNeed;
  final String cashDuringUncertainty;
  final bool allowNewsSignals;
  final bool allowInstitutionalSignals;
  final bool allowCommunitySignals;
  final int preferredFreshnessHours;
  final int maxDailyExternalCalls;

  String get summary {
    final tilts = [
      ...preferredSectors.take(2),
      ...styleTilts.take(2),
    ];
    final tiltText = tilts.isEmpty ? "未设置行业/风格倾向" : tilts.join("、");
    final homeText = homePurchaseEnabled ? "买房目标开启" : "无买房目标";
    return "风险容量 ${_levelLabel(riskCapacity)} · $tiltText · $homeText";
  }

  Map<String, dynamic> toPayload() => {
        "behavior": {
          "riskCapacity": riskCapacity,
          "volatilityComfort": volatilityComfort,
          "concentrationTolerance": concentrationTolerance,
          "leverageAllowed": leverageAllowed,
          "optionsAllowed": optionsAllowed,
          "cryptoAllowed": cryptoAllowed,
        },
        "sectorTilts": {
          "preferredSectors": preferredSectors,
          "avoidedSectors": avoidedSectors,
          "styleTilts": styleTilts,
          "thematicInterests": thematicInterests,
        },
        "lifeGoals": {
          "homePurchase": {
            "enabled": homePurchaseEnabled,
            "horizonYears": homePurchaseHorizonYears,
            "downPaymentTargetCad": homeDownPaymentTargetCad,
            "priority": homePurchasePriority,
          },
          "emergencyFundTargetCad": emergencyFundTargetCad,
          "expectedLargeExpenses": const <String>[],
          "retirementHorizonYears": retirementHorizonYears,
        },
        "taxStrategy": {
          "province": province,
          "marginalTaxBracket": marginalTaxBracket,
          "rrspDeductionPriority": rrspDeductionPriority,
          "tfsaGrowthPriority": tfsaGrowthPriority,
          "fhsaHomeGoalPriority": fhsaHomeGoalPriority,
          "taxableTaxSensitivity": taxableTaxSensitivity,
          "dividendWithholdingSensitivity": dividendWithholdingSensitivity,
          "usdFundingPath": usdFundingPath,
        },
        "liquidity": {
          "monthlyContributionCad": monthlyContributionCad,
          "minimumTradeSizeCad": minimumTradeSizeCad,
          "liquidityNeed": liquidityNeed,
          "cashDuringUncertainty": cashDuringUncertainty,
        },
        "externalInfo": {
          "allowNewsSignals": allowNewsSignals,
          "allowInstitutionalSignals": allowInstitutionalSignals,
          "allowCommunitySignals": allowCommunitySignals,
          "preferredFreshnessHours": preferredFreshnessHours,
          "maxDailyExternalCalls": maxDailyExternalCalls,
        },
      };

  factory MobilePreferenceFactors.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    final behavior = _map(json["behavior"]);
    final sectorTilts = _map(json["sectorTilts"]);
    final lifeGoals = _map(json["lifeGoals"]);
    final homePurchase = _map(lifeGoals["homePurchase"]);
    final taxStrategy = _map(json["taxStrategy"]);
    final liquidity = _map(json["liquidity"]);
    final externalInfo = _map(json["externalInfo"]);
    return MobilePreferenceFactors(
      riskCapacity: _level(behavior["riskCapacity"], fallback: "medium"),
      volatilityComfort:
          _level(behavior["volatilityComfort"], fallback: "medium"),
      concentrationTolerance:
          _level(behavior["concentrationTolerance"], fallback: "medium"),
      leverageAllowed: behavior["leverageAllowed"] as bool? ?? false,
      optionsAllowed: behavior["optionsAllowed"] as bool? ?? false,
      cryptoAllowed: behavior["cryptoAllowed"] as bool? ?? false,
      preferredSectors: _stringList(sectorTilts["preferredSectors"]),
      avoidedSectors: _stringList(sectorTilts["avoidedSectors"]),
      styleTilts: _stringList(sectorTilts["styleTilts"]),
      thematicInterests: _stringList(sectorTilts["thematicInterests"]),
      homePurchaseEnabled: homePurchase["enabled"] as bool? ?? false,
      homePurchaseHorizonYears: _number(homePurchase["horizonYears"]),
      homeDownPaymentTargetCad: _number(homePurchase["downPaymentTargetCad"]),
      homePurchasePriority:
          _level(homePurchase["priority"], fallback: "medium"),
      emergencyFundTargetCad: _number(lifeGoals["emergencyFundTargetCad"]),
      retirementHorizonYears: _number(lifeGoals["retirementHorizonYears"]),
      province: (taxStrategy["province"] as String?)?.trim(),
      marginalTaxBracket: _nullableLevel(taxStrategy["marginalTaxBracket"]),
      rrspDeductionPriority:
          _level(taxStrategy["rrspDeductionPriority"], fallback: "medium"),
      tfsaGrowthPriority:
          _level(taxStrategy["tfsaGrowthPriority"], fallback: "high"),
      fhsaHomeGoalPriority:
          _level(taxStrategy["fhsaHomeGoalPriority"], fallback: "medium"),
      taxableTaxSensitivity:
          _level(taxStrategy["taxableTaxSensitivity"], fallback: "medium"),
      dividendWithholdingSensitivity: _level(
          taxStrategy["dividendWithholdingSensitivity"],
          fallback: "medium"),
      usdFundingPath: _usdFundingPath(taxStrategy["usdFundingPath"]),
      monthlyContributionCad: _number(liquidity["monthlyContributionCad"]),
      minimumTradeSizeCad: _number(liquidity["minimumTradeSizeCad"]),
      liquidityNeed: _level(liquidity["liquidityNeed"], fallback: "medium"),
      cashDuringUncertainty:
          _level(liquidity["cashDuringUncertainty"], fallback: "medium"),
      allowNewsSignals: externalInfo["allowNewsSignals"] as bool? ?? false,
      allowInstitutionalSignals:
          externalInfo["allowInstitutionalSignals"] as bool? ?? false,
      allowCommunitySignals:
          externalInfo["allowCommunitySignals"] as bool? ?? false,
      preferredFreshnessHours:
          (externalInfo["preferredFreshnessHours"] as num?)?.toInt() ?? 24,
      maxDailyExternalCalls:
          (externalInfo["maxDailyExternalCalls"] as num?)?.toInt() ?? 5,
    );
  }

  static Map<String, dynamic> _map(Object? value) =>
      value is Map<String, dynamic> ? value : const <String, dynamic>{};

  static List<String> _stringList(Object? value) =>
      (value as List?)?.whereType<String>().toList() ?? const [];

  static double? _number(Object? value) =>
      value is num ? value.toDouble() : null;

  static String _level(Object? value, {required String fallback}) {
    final text = value as String?;
    return text == "low" || text == "medium" || text == "high"
        ? text!
        : fallback;
  }

  static String? _nullableLevel(Object? value) {
    final text = value as String?;
    return text == "low" || text == "medium" || text == "high" ? text : null;
  }

  static String _usdFundingPath(Object? value) {
    final text = value as String?;
    return text == "available" || text == "avoid" || text == "unknown"
        ? text!
        : "unknown";
  }

  static String _levelLabel(String value) => switch (value) {
        "low" => "低",
        "high" => "高",
        _ => "中",
      };
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
    required this.preferenceFactors,
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
  final MobilePreferenceFactors preferenceFactors;
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
        "preferenceFactors": preferenceFactors.toPayload(),
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
    String sectorTilt = "broad",
    String homePlan = "none",
    String taxFocus = "medium",
    String usdFundingPath = "unknown",
    bool allowExternalSignals = false,
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

    if (goal == "home" || homePlan != "none" || cashNeed == "high") {
      adjust("Fixed Income", 5);
      adjust("Cash", 5);
      adjust("US Equity", -10);
    } else if (volatility == "high" && horizon == "long") {
      adjust("International Equity", 4);
      adjust("Fixed Income", -2);
      adjust("Cash", -2);
    }
    if (sectorTilt == "tech-energy" && volatility == "high") {
      adjust("US Equity", 4);
      adjust("Fixed Income", -2);
      adjust("Cash", -2);
    } else if (sectorTilt == "dividend-quality") {
      adjust("Canadian Equity", 3);
      adjust("US Equity", -3);
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
    final taxAwarePlacement =
        priority == "tax-efficiency" || taxFocus == "high";
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
    final accountFundingPriority = goal == "home" || homePlan == "active"
        ? ["FHSA", "TFSA", "RRSP"]
        : goal == "retirement"
            ? ["RRSP", "TFSA", "Taxable"]
            : priority == "tax-efficiency"
                ? ["TFSA", "RRSP", "Taxable"]
                : ["TFSA", "Taxable", "RRSP"];
    final homePurchaseEnabled = goal == "home" || homePlan != "none";
    final preferredSectors = switch (sectorTilt) {
      "tech-energy" => const ["Technology", "Energy"],
      "dividend-quality" => const ["Financial Services", "Utilities"],
      "canada-home" => const ["Canadian Equity"],
      _ => const <String>[],
    };
    final styleTilts = switch (sectorTilt) {
      "tech-energy" => const ["Growth"],
      "dividend-quality" => const ["Dividend", "Quality"],
      _ => volatility == "high" ? const ["Growth"] : const <String>[],
    };
    final thematicInterests = sectorTilt == "tech-energy"
        ? const ["AI infrastructure", "Energy transition"]
        : const <String>[];
    final preferenceFactors = MobilePreferenceFactors(
      riskCapacity: volatility == "high" && horizon == "long"
          ? "high"
          : volatility == "low" || goal == "capital-preservation"
              ? "low"
              : "medium",
      volatilityComfort: volatility,
      concentrationTolerance: volatility == "high" ? "high" : "medium",
      leverageAllowed: false,
      optionsAllowed: false,
      cryptoAllowed: false,
      preferredSectors: preferredSectors,
      avoidedSectors: const [],
      styleTilts: styleTilts,
      thematicInterests: thematicInterests,
      homePurchaseEnabled: homePurchaseEnabled,
      homePurchaseHorizonYears: homePurchaseEnabled
          ? horizon == "short"
              ? 2
              : horizon == "medium"
                  ? 5
                  : 8
          : null,
      homeDownPaymentTargetCad: homePurchaseEnabled ? 150000 : null,
      homePurchasePriority:
          goal == "home" || homePlan == "active" ? "high" : "medium",
      emergencyFundTargetCad: cashBufferTargetCad * 2,
      retirementHorizonYears: goal == "retirement"
          ? horizon == "short"
              ? 8
              : horizon == "medium"
                  ? 18
                  : 30
          : null,
      province: "ON",
      marginalTaxBracket: null,
      rrspDeductionPriority: taxFocus == "high" ? "high" : "medium",
      tfsaGrowthPriority: "high",
      fhsaHomeGoalPriority: homePurchaseEnabled ? "high" : "medium",
      taxableTaxSensitivity: taxFocus,
      dividendWithholdingSensitivity: "medium",
      usdFundingPath: usdFundingPath,
      monthlyContributionCad: null,
      minimumTradeSizeCad: 500,
      liquidityNeed: cashNeed,
      cashDuringUncertainty: cashNeed == "high" ? "high" : "medium",
      allowNewsSignals: allowExternalSignals,
      allowInstitutionalSignals: allowExternalSignals,
      allowCommunitySignals: allowExternalSignals,
      preferredFreshnessHours: 24,
      maxDailyExternalCalls: 5,
    );

    return MobileGuidedDraft(
      answers: {
        "goal": goal,
        "horizon": horizon,
        "volatility": volatility,
        "priority": priority,
        "cashNeed": cashNeed,
        "sectorTilt": sectorTilt,
        "homePlan": homePlan,
        "taxFocus": taxFocus,
        "usdFundingPath": usdFundingPath,
        "allowExternalSignals": allowExternalSignals.toString(),
      },
      riskProfile: riskProfile,
      targetAllocation: allocation,
      accountFundingPriority: accountFundingPriority,
      taxAwarePlacement: taxAwarePlacement,
      cashBufferTargetCad: cashBufferTargetCad,
      transitionPreference: transitionPreference,
      recommendationStrategy: recommendationStrategy,
      rebalancingTolerancePct: rebalancingTolerancePct,
      preferenceFactors: preferenceFactors,
      assumptions: [
        "目标：$goal",
        "期限：$horizon",
        "波动承受：$volatility",
        "现金需求：$cashNeed",
        "行业/风格：$sectorTilt",
        "税务关注：$taxFocus",
        "进阶偏好：${preferenceFactors.summary}",
      ],
      rationale: [
        "根据期限、目标和波动承受度，将风险档位设为 $riskProfile。",
        taxAwarePlacement ? "启用税务感知放置，优先使用更合适的账户桶。" : "使用较简洁的账户匹配规则。",
        sectorTilt == "broad"
            ? "未设置明显行业倾向，保持更宽的分散度。"
            : "根据行业/风格回答写入 Preference Factors V2。",
        homePurchaseEnabled ? "识别到买房或首付目标，提升流动性和 FHSA 相关参数。" : "未开启买房目标。",
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
