import "../../shared/data/mobile_models.dart";

class MobileRecommendationsSnapshot {
  const MobileRecommendationsSnapshot({
    required this.contributionAmount,
    required this.engineLine,
    required this.inputs,
    required this.preferenceContext,
    required this.explainer,
    required this.priorities,
    required this.watchlistMarketItems,
    required this.recentObservationItems,
    required this.engineSummary,
    required this.recommendationV4,
    required this.scenarios,
    required this.poolStatus,
    required this.notes,
  });

  final String contributionAmount;
  final String engineLine;
  final List<MobileRecommendationInput> inputs;
  final MobilePreferenceContext preferenceContext;
  final List<String> explainer;
  final List<MobileRecommendationPriority> priorities;
  final List<MobileRecommendationMarketItem> watchlistMarketItems;
  final List<MobileRecommendationMarketItem> recentObservationItems;
  final MobileRecommendationEngineSummary engineSummary;
  final MobileRecommendationV4 recommendationV4;
  final List<MobileRecommendationScenario> scenarios;
  final MobileRecommendationPoolStatus poolStatus;
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
      explainer: (json["explainer"] as List?)?.whereType<String>().toList() ??
          const [],
      priorities: readJsonList(json, "priorities")
          .map(MobileRecommendationPriority.fromJson)
          .toList(),
      watchlistMarketItems: readJsonList(json, "watchlistMarketItems")
          .map(MobileRecommendationMarketItem.fromJson)
          .toList(),
      recentObservationItems: readJsonList(json, "recentObservationItems")
          .map(MobileRecommendationMarketItem.fromJson)
          .toList(),
      engineSummary:
          MobileRecommendationEngineSummary.fromJson(json["engineSummary"]),
      recommendationV4:
          MobileRecommendationV4.fromJson(json["recommendationV4"]),
      scenarios: readJsonList(json, "scenarios")
          .map(MobileRecommendationScenario.fromJson)
          .toList(),
      poolStatus: MobileRecommendationPoolStatus.fromJson(json["poolStatus"]),
      notes: (json["notes"] as List?)?.whereType<String>().toList() ?? const [],
    );
  }
}

class MobileRecommendationPoolStatus {
  const MobileRecommendationPoolStatus({
    required this.status,
    required this.reason,
    required this.blockers,
    required this.suggestedRelaxations,
  });

  final String status;
  final String reason;
  final List<String> blockers;
  final List<MobileRecommendationPoolRelaxation> suggestedRelaxations;

  bool get needsPolicyRelaxation => status == "needs_policy_relaxation";

  factory MobileRecommendationPoolStatus.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileRecommendationPoolStatus(
      status: json["status"] as String? ?? "ok",
      reason: json["reason"] as String? ?? "",
      blockers:
          (json["blockers"] as List?)?.whereType<String>().toList() ?? const [],
      suggestedRelaxations: readJsonList(json, "suggestedRelaxations")
          .map(MobileRecommendationPoolRelaxation.fromJson)
          .toList(),
    );
  }
}

class MobileRecommendationPoolRelaxation {
  const MobileRecommendationPoolRelaxation({
    required this.type,
    required this.value,
    required this.label,
  });

  final String type;
  final String value;
  final String label;

  factory MobileRecommendationPoolRelaxation.fromJson(
    Map<String, dynamic> json,
  ) {
    return MobileRecommendationPoolRelaxation(
      type: json["type"] as String? ?? "",
      value: json["value"] as String? ?? "",
      label: json["label"] as String? ?? "",
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

class MobileRecommendationMarketItem {
  const MobileRecommendationMarketItem({
    required this.key,
    required this.symbol,
    required this.name,
    required this.exchange,
    required this.currency,
    required this.securityId,
    required this.poolStatus,
    required this.poolStatusLabel,
    required this.poolStatusDetail,
    required this.lastPriceLabel,
    required this.dayChangeLabel,
    required this.dayChangePctLabel,
    required this.dayChangeVariant,
    required this.freshnessLabel,
  });

  final String key;
  final String symbol;
  final String name;
  final String exchange;
  final String currency;
  final String securityId;
  final String poolStatus;
  final String poolStatusLabel;
  final String poolStatusDetail;
  final String lastPriceLabel;
  final String dayChangeLabel;
  final String dayChangePctLabel;
  final String dayChangeVariant;
  final String freshnessLabel;

  String get identityLine => [
        if (exchange.isNotEmpty) exchange,
        if (currency.isNotEmpty) currency,
      ].join(" · ");

  bool get hasMarketMove => dayChangeVariant != "unavailable";

  factory MobileRecommendationMarketItem.fromJson(Map<String, dynamic> json) {
    return MobileRecommendationMarketItem(
      key: json["key"] as String? ?? "",
      symbol: json["symbol"] as String? ?? "",
      name: json["name"] as String? ?? "",
      exchange: json["exchange"] as String? ?? "",
      currency: json["currency"] as String? ?? "",
      securityId: json["securityId"] as String? ?? "",
      poolStatus: json["poolStatus"] as String? ?? "watch_only",
      poolStatusLabel: json["poolStatusLabel"] as String? ?? "暂不推荐",
      poolStatusDetail: json["poolStatusDetail"] as String? ?? "",
      lastPriceLabel: json["lastPriceLabel"] as String? ?? "--",
      dayChangeLabel: json["dayChangeLabel"] as String? ?? "待刷新",
      dayChangePctLabel: json["dayChangePctLabel"] as String? ?? "今日涨跌待刷新",
      dayChangeVariant: json["dayChangeVariant"] as String? ?? "unavailable",
      freshnessLabel: json["freshnessLabel"] as String? ?? "暂无行情",
    );
  }
}

class MobileRecommendationEngineSummary {
  const MobileRecommendationEngineSummary({
    required this.title,
    required this.summary,
    required this.chips,
    required this.rankingInputs,
    required this.preferenceFactors,
    required this.guardrails,
  });

  final String title;
  final String summary;
  final List<String> chips;
  final List<MobileRecommendationInput> rankingInputs;
  final List<MobileRecommendationEngineFactor> preferenceFactors;
  final List<MobileRecommendationEngineFactor> guardrails;

  factory MobileRecommendationEngineSummary.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileRecommendationEngineSummary(
      title: json["title"] as String? ?? "推荐引擎",
      summary: json["summary"] as String? ?? "",
      chips: (json["chips"] as List?)?.whereType<String>().toList() ?? const [],
      rankingInputs: readJsonList(json, "rankingInputs")
          .map(MobileRecommendationInput.fromJson)
          .toList(),
      preferenceFactors: readJsonList(json, "preferenceFactors")
          .map(MobileRecommendationEngineFactor.fromJson)
          .toList(),
      guardrails: readJsonList(json, "guardrails")
          .map(MobileRecommendationEngineFactor.fromJson)
          .toList(),
    );
  }
}

class MobileRecommendationEngineFactor {
  const MobileRecommendationEngineFactor({
    required this.label,
    required this.value,
    required this.tone,
  });

  final String label;
  final String value;
  final String tone;

  factory MobileRecommendationEngineFactor.fromJson(
    Map<String, dynamic> json,
  ) {
    return MobileRecommendationEngineFactor(
      label: json["label"] as String? ?? "",
      value: json["value"] as String? ?? "--",
      tone: json["tone"] as String? ?? "neutral",
    );
  }
}

class MobileRecommendationV4 {
  const MobileRecommendationV4({
    required this.version,
    required this.policy,
    required this.poolSnapshot,
    required this.rejectedCandidates,
    required this.emptyState,
  });

  final String version;
  final MobileRecommendationV4Policy policy;
  final MobileRecommendationV4PoolSnapshot poolSnapshot;
  final List<MobileRecommendationV4RejectedCandidate> rejectedCandidates;
  final MobileRecommendationV4EmptyState? emptyState;

  bool get hasVisibility => version.isNotEmpty && poolSnapshot.rawCount > 0;

  factory MobileRecommendationV4.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileRecommendationV4(
      version: json["version"] as String? ?? "",
      policy: MobileRecommendationV4Policy.fromJson(json["policy"]),
      poolSnapshot:
          MobileRecommendationV4PoolSnapshot.fromJson(json["poolSnapshot"]),
      rejectedCandidates: readJsonList(json, "rejectedCandidates")
          .map(MobileRecommendationV4RejectedCandidate.fromJson)
          .toList(),
      emptyState: json["emptyState"] is Map<String, dynamic>
          ? MobileRecommendationV4EmptyState.fromJson(
              json["emptyState"] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

class MobileRecommendationV4Policy {
  const MobileRecommendationV4Policy({
    required this.riskMode,
    required this.includeRoles,
    required this.excludeRoles,
    required this.hardRules,
    required this.contributionAmountLabel,
    required this.noSilentFallback,
  });

  final String riskMode;
  final List<String> includeRoles;
  final List<String> excludeRoles;
  final List<String> hardRules;
  final String contributionAmountLabel;
  final bool noSilentFallback;

  factory MobileRecommendationV4Policy.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileRecommendationV4Policy(
      riskMode: json["riskMode"] as String? ?? "--",
      includeRoles:
          (json["includeRoles"] as List?)?.whereType<String>().toList() ??
              const [],
      excludeRoles:
          (json["excludeRoles"] as List?)?.whereType<String>().toList() ??
              const [],
      hardRules: (json["hardRules"] as List?)?.whereType<String>().toList() ??
          const [],
      contributionAmountLabel:
          json["contributionAmountLabel"] as String? ?? "--",
      noSilentFallback: json["noSilentFallback"] as bool? ?? true,
    );
  }
}

class MobileRecommendationV4PoolSnapshot {
  const MobileRecommendationV4PoolSnapshot({
    required this.rawCount,
    required this.eligibleCount,
    required this.excludedCount,
    required this.watchOnlyCount,
    required this.needsDataCount,
    required this.needsIdentityCount,
    required this.sourceBreakdown,
    required this.statusBreakdown,
    required this.candidateEvidence,
  });

  final int rawCount;
  final int eligibleCount;
  final int excludedCount;
  final int watchOnlyCount;
  final int needsDataCount;
  final int needsIdentityCount;
  final List<MobileRecommendationV4Breakdown> sourceBreakdown;
  final List<MobileRecommendationV4Breakdown> statusBreakdown;
  final List<MobileRecommendationV4CandidateEvidence> candidateEvidence;

  factory MobileRecommendationV4PoolSnapshot.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileRecommendationV4PoolSnapshot(
      rawCount: (json["rawCount"] as num?)?.toInt() ?? 0,
      eligibleCount: (json["eligibleCount"] as num?)?.toInt() ?? 0,
      excludedCount: (json["excludedCount"] as num?)?.toInt() ?? 0,
      watchOnlyCount: (json["watchOnlyCount"] as num?)?.toInt() ?? 0,
      needsDataCount: (json["needsDataCount"] as num?)?.toInt() ?? 0,
      needsIdentityCount: (json["needsIdentityCount"] as num?)?.toInt() ?? 0,
      sourceBreakdown: readJsonList(json, "sourceBreakdown")
          .map(MobileRecommendationV4Breakdown.fromJson)
          .toList(),
      statusBreakdown: readJsonList(json, "statusBreakdown")
          .map(MobileRecommendationV4Breakdown.fromJson)
          .toList(),
      candidateEvidence: readJsonList(json, "candidateEvidence")
          .map(MobileRecommendationV4CandidateEvidence.fromJson)
          .toList(),
    );
  }
}

class MobileRecommendationV4CandidateEvidence {
  const MobileRecommendationV4CandidateEvidence({
    required this.symbol,
    required this.sourceLabel,
    required this.confidenceLabel,
    required this.freshnessLabel,
  });

  final String symbol;
  final String sourceLabel;
  final String confidenceLabel;
  final String freshnessLabel;

  factory MobileRecommendationV4CandidateEvidence.fromJson(
    Map<String, dynamic> json,
  ) {
    return MobileRecommendationV4CandidateEvidence(
      symbol: json["symbol"] as String? ?? "",
      sourceLabel: json["sourceLabel"] as String? ?? "",
      confidenceLabel: json["confidenceLabel"] as String? ?? "",
      freshnessLabel: json["freshnessLabel"] as String? ?? "",
    );
  }
}

class MobileRecommendationV4Breakdown {
  const MobileRecommendationV4Breakdown({
    required this.label,
    required this.count,
  });

  final String label;
  final int count;

  factory MobileRecommendationV4Breakdown.fromJson(Map<String, dynamic> json) {
    return MobileRecommendationV4Breakdown(
      label: (json["label"] as String?) ??
          (json["source"] as String?) ??
          (json["status"] as String?) ??
          "--",
      count: (json["count"] as num?)?.toInt() ?? 0,
    );
  }
}

class MobileRecommendationV4RejectedCandidate {
  const MobileRecommendationV4RejectedCandidate({
    required this.symbol,
    required this.name,
    required this.source,
    required this.status,
    required this.reasons,
    required this.repairLabel,
  });

  final String symbol;
  final String name;
  final String source;
  final String status;
  final List<MobileRecommendationV4Reason> reasons;
  final String repairLabel;

  factory MobileRecommendationV4RejectedCandidate.fromJson(
    Map<String, dynamic> json,
  ) {
    final identity = json["identity"];
    final identityJson =
        identity is Map<String, dynamic> ? identity : const <String, dynamic>{};
    final repair = json["repairAction"];
    final repairJson =
        repair is Map<String, dynamic> ? repair : const <String, dynamic>{};
    return MobileRecommendationV4RejectedCandidate(
      symbol: identityJson["symbol"] as String? ?? "",
      name: identityJson["name"] as String? ?? "",
      source: json["source"] as String? ?? "",
      status: json["status"] as String? ?? "",
      reasons: readJsonList(json, "reasons")
          .map(MobileRecommendationV4Reason.fromJson)
          .toList(),
      repairLabel: repairJson["label"] as String? ?? "",
    );
  }
}

class MobileRecommendationV4Reason {
  const MobileRecommendationV4Reason({
    required this.code,
    required this.label,
    required this.detail,
    required this.severity,
  });

  final String code;
  final String label;
  final String detail;
  final String severity;

  factory MobileRecommendationV4Reason.fromJson(Map<String, dynamic> json) {
    return MobileRecommendationV4Reason(
      code: json["code"] as String? ?? "",
      label: json["label"] as String? ?? "",
      detail: json["detail"] as String? ?? "",
      severity: json["severity"] as String? ?? "info",
    );
  }
}

class MobileRecommendationV4EmptyState {
  const MobileRecommendationV4EmptyState({
    required this.title,
    required this.detail,
    required this.repairActions,
  });

  final String title;
  final String detail;
  final List<String> repairActions;

  factory MobileRecommendationV4EmptyState.fromJson(
    Map<String, dynamic> json,
  ) {
    return MobileRecommendationV4EmptyState(
      title: json["title"] as String? ?? "",
      detail: json["detail"] as String? ?? "",
      repairActions: readJsonList(json, "repairActions")
          .map((item) => item["label"] as String? ?? "")
          .where((item) => item.isNotEmpty)
          .toList(),
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
    required this.securityId,
    required this.securitySymbol,
    required this.securityExchange,
    required this.securityCurrency,
    required this.candidateBrief,
    required this.scoreline,
    required this.gapSummary,
    required this.whyThis,
    required this.whyNot,
    required this.alternatives,
    required this.intelligenceRefs,
    required this.v3Overlay,
    required this.constraints,
    required this.execution,
  });

  final String assetClass;
  final String description;
  final String amount;
  final String account;
  final String security;
  final String securityId;
  final String securitySymbol;
  final String securityExchange;
  final String securityCurrency;
  final MobileCandidateBrief? candidateBrief;
  final String scoreline;
  final String gapSummary;
  final List<String> whyThis;
  final List<String> whyNot;
  final List<String> alternatives;
  final List<MobileRecommendationIntelligenceRef> intelligenceRefs;
  final MobileRecommendationV3Overlay? v3Overlay;
  final List<MobileRecommendationConstraint> constraints;
  final List<MobileRecommendationInput> execution;

  factory MobileRecommendationPriority.fromJson(Map<String, dynamic> json) {
    return MobileRecommendationPriority(
      assetClass: json["assetClass"] as String? ?? "未知资产",
      description: json["description"] as String? ?? "",
      amount: json["amount"] as String? ?? "--",
      account: json["account"] as String? ?? "",
      security: json["security"] as String? ?? "",
      securityId: json["securityId"] as String? ?? "",
      securitySymbol: json["securitySymbol"] as String? ?? "",
      securityExchange: json["securityExchange"] as String? ?? "",
      securityCurrency: json["securityCurrency"] as String? ?? "",
      candidateBrief: json["candidateBrief"] is Map<String, dynamic>
          ? MobileCandidateBrief.fromJson(
              json["candidateBrief"] as Map<String, dynamic>,
            )
          : null,
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
      v3Overlay: json["v3Overlay"] is Map<String, dynamic>
          ? MobileRecommendationV3Overlay.fromJson(
              json["v3Overlay"] as Map<String, dynamic>,
            )
          : null,
      constraints: readJsonList(json, "constraints")
          .map(MobileRecommendationConstraint.fromJson)
          .toList(),
      execution: readJsonList(json, "execution")
          .map(MobileRecommendationInput.fromJson)
          .toList(),
    );
  }
}

class MobileCandidateBrief {
  const MobileCandidateBrief({
    required this.identity,
    required this.source,
    required this.decision,
    required this.portfolioImpact,
    required this.badges,
    required this.primaryBlocker,
    required this.rejectionReason,
    required this.dailyBriefId,
  });

  final MobileCandidateBriefIdentity identity;
  final String source;
  final MobileCandidateBriefDecision decision;
  final MobileCandidatePortfolioImpact portfolioImpact;
  final List<String> badges;
  final String? primaryBlocker;
  final String? rejectionReason;
  final String? dailyBriefId;

  factory MobileCandidateBrief.fromJson(Map<String, dynamic> json) {
    return MobileCandidateBrief(
      identity: MobileCandidateBriefIdentity.fromJson(json["identity"]),
      source: json["source"] as String? ?? "manual",
      decision: MobileCandidateBriefDecision.fromJson(json["decision"]),
      portfolioImpact:
          MobileCandidatePortfolioImpact.fromJson(json["portfolioImpact"]),
      badges:
          (json["badges"] as List?)?.whereType<String>().toList() ?? const [],
      primaryBlocker: json["primaryBlocker"] as String?,
      rejectionReason: json["rejectionReason"] as String?,
      dailyBriefId: json["dailyBriefId"] as String?,
    );
  }
}

class MobileCandidateBriefIdentity {
  const MobileCandidateBriefIdentity({
    required this.securityId,
    required this.symbol,
    required this.name,
    required this.exchange,
    required this.currency,
  });

  final String securityId;
  final String symbol;
  final String name;
  final String exchange;
  final String currency;

  factory MobileCandidateBriefIdentity.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileCandidateBriefIdentity(
      securityId: json["securityId"] as String? ?? "",
      symbol: json["symbol"] as String? ?? "",
      name: json["name"] as String? ?? "",
      exchange: json["exchange"] as String? ?? "",
      currency: json["currency"] as String? ?? "",
    );
  }
}

class MobileCandidateBriefDecision {
  const MobileCandidateBriefDecision({
    required this.action,
    required this.matchScore,
    required this.recommendedAmountCad,
    required this.targetAccount,
  });

  final String action;
  final int matchScore;
  final double recommendedAmountCad;
  final String targetAccount;

  factory MobileCandidateBriefDecision.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileCandidateBriefDecision(
      action: json["action"] as String? ?? "dca",
      matchScore: (json["matchScore"] as num?)?.round() ?? 0,
      recommendedAmountCad:
          (json["recommendedAmountCad"] as num?)?.toDouble() ?? 0,
      targetAccount: json["targetAccount"] as String? ?? "",
    );
  }
}

class MobileCandidatePortfolioImpact {
  const MobileCandidatePortfolioImpact({
    required this.gapBeforePct,
    required this.gapAfterPct,
  });

  final double? gapBeforePct;
  final double? gapAfterPct;

  factory MobileCandidatePortfolioImpact.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    final gap = json["gapResolved"];
    final gapJson =
        gap is Map<String, dynamic> ? gap : const <String, dynamic>{};
    return MobileCandidatePortfolioImpact(
      gapBeforePct: (gapJson["beforePct"] as num?)?.toDouble(),
      gapAfterPct: (gapJson["afterPct"] as num?)?.toDouble(),
    );
  }
}

class MobileRecommendationV3Overlay {
  const MobileRecommendationV3Overlay({
    required this.baselineScore,
    required this.externalInsightScore,
    required this.preferenceFitScore,
    required this.finalScore,
    required this.confidenceLabel,
    required this.sourceMode,
    required this.signals,
    required this.riskFlags,
    required this.explanation,
  });

  final double baselineScore;
  final double? externalInsightScore;
  final double? preferenceFitScore;
  final double finalScore;
  final String confidenceLabel;
  final String sourceMode;
  final List<String> signals;
  final List<String> riskFlags;
  final String explanation;

  factory MobileRecommendationV3Overlay.fromJson(Map<String, dynamic> json) {
    double readScore(String key, double fallback) {
      final value = json[key];
      return value is num ? value.toDouble() : fallback;
    }

    double? readOptionalScore(String key) {
      final value = json[key];
      return value is num ? value.toDouble() : null;
    }

    return MobileRecommendationV3Overlay(
      baselineScore: readScore("baselineScore", 0),
      externalInsightScore: readOptionalScore("externalInsightScore"),
      preferenceFitScore: readOptionalScore("preferenceFitScore"),
      finalScore: readScore("finalScore", 0),
      confidenceLabel: json["confidenceLabel"] as String? ?? "",
      sourceMode: json["sourceMode"] as String? ?? "local",
      signals:
          (json["signals"] as List?)?.whereType<String>().toList() ?? const [],
      riskFlags: (json["riskFlags"] as List?)?.whereType<String>().toList() ??
          const [],
      explanation: json["explanation"] as String? ?? "",
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
      sourceLabel: json["sourceLabel"] as String? ?? "智能快扫",
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
