import "dart:convert";

import "package:flutter/material.dart";
import "package:flutter/foundation.dart";

import "../../../core/api/loo_api_client.dart";
import "../../shared/data/loo_minister_context_models.dart";
import "../../shared/presentation/loo_minister_scope.dart";

class AiAnalysisCard extends StatefulWidget {
  const AiAnalysisCard({
    required this.apiClient,
    required this.payload,
    this.title = "智能快扫",
    this.description = "先用你的组合、偏好和已保存资料生成确定性判断；外部 GPT 只在你点击增强时调用。",
    this.autoRun = false,
    this.refreshKey,
    this.onCompleted,
    super.key,
  });

  final LooApiClient apiClient;
  final Map<String, dynamic> payload;
  final String title;
  final String description;
  final bool autoRun;
  final String? refreshKey;
  final VoidCallback? onCompleted;

  @override
  State<AiAnalysisCard> createState() => _AiAnalysisCardState();
}

class _AiAnalysisCardState extends State<AiAnalysisCard> {
  Future<MobileAiAnalysisResult>? _analysis;
  Future<MobileAiGptEnhancement?>? _gptEnhancement;
  ValueListenable<LooMinisterSuggestedAction?>? _ministerActionListenable;
  bool _hasResult = false;
  bool _hasGptEnhancementResult = false;
  bool _isLoading = false;
  bool _isEnhancing = false;
  late String _payloadSignature;

  @override
  void initState() {
    super.initState();
    _payloadSignature = _stableJsonSignature(widget.payload);
    if (widget.autoRun) {
      _isLoading = true;
      _analysis = _loadAnalysis(refresh: false);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final listenable =
        LooMinisterScope.maybeOf(context)?.analysisActionListenable;
    if (listenable == _ministerActionListenable) {
      return;
    }
    _ministerActionListenable?.removeListener(_handleMinisterAction);
    _ministerActionListenable = listenable;
    _ministerActionListenable?.addListener(_handleMinisterAction);
  }

  @override
  void dispose() {
    _ministerActionListenable?.removeListener(_handleMinisterAction);
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant AiAnalysisCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextPayloadSignature = _stableJsonSignature(widget.payload);
    if (widget.autoRun &&
        nextPayloadSignature != _payloadSignature &&
        !_isLoading) {
      _payloadSignature = nextPayloadSignature;
      _runAnalysis(refresh: false);
      return;
    }
    if (widget.refreshKey != null &&
        oldWidget.refreshKey != widget.refreshKey &&
        _hasResult &&
        !_isLoading) {
      _runAnalysis(refresh: true);
    }
  }

  void _runAnalysis({bool refresh = false}) {
    setState(() {
      _isLoading = true;
      _gptEnhancement = null;
      _hasGptEnhancementResult = false;
      _analysis = _loadAnalysis(refresh: refresh);
    });
  }

  void _runGptEnhancement() {
    if (_isEnhancing || !_hasResult) return;
    setState(() {
      _isEnhancing = true;
      _gptEnhancement = _loadGptEnhancement(forceFresh: true);
    });
  }

  void _handleMinisterAction() {
    final action = _ministerActionListenable?.value;
    if (action == null || _isLoading || !_matchesMinisterAction(action)) {
      return;
    }
    _runAnalysis(refresh: _hasResult);
  }

  bool _matchesMinisterAction(LooMinisterSuggestedAction action) {
    if (action.actionType != "run-analysis") {
      return false;
    }
    final payloadScope = widget.payload["scope"];
    final targetScope = action.target["scope"];
    if (targetScope is String) {
      if (payloadScope != targetScope) {
        return false;
      }
    } else if (action.id.contains("security")) {
      if (payloadScope != "security") return false;
    } else if (action.id.contains("account")) {
      if (payloadScope != "account") return false;
    } else if (action.id.contains("portfolio")) {
      if (payloadScope != "portfolio") return false;
    }

    final targetAccountId = action.target["accountId"];
    if (targetAccountId is String &&
        targetAccountId.isNotEmpty &&
        widget.payload["accountId"] != targetAccountId) {
      return false;
    }

    final targetSecurity = action.target["security"];
    final payloadSecurity = widget.payload["security"];
    if (targetSecurity is Map<String, dynamic> &&
        payloadSecurity is Map<String, dynamic>) {
      final targetSecurityId = targetSecurity["securityId"];
      if (targetSecurityId is String &&
          targetSecurityId.isNotEmpty &&
          payloadSecurity["securityId"] != targetSecurityId) {
        return false;
      }
    }

    return true;
  }

  Future<MobileAiAnalysisResult> _loadAnalysis({required bool refresh}) async {
    try {
      final payload = {
        ...widget.payload,
        if (refresh) "cacheStrategy": "refresh",
      };
      final response = await widget.apiClient.createAnalyzerQuickScan(payload);
      final data = response["data"];
      if (data is! Map<String, dynamic>) {
        throw const LooApiException("智能快扫格式不正确。");
      }
      final result = MobileAiAnalysisResult.fromJson(data);
      if (mounted) {
        setState(() {
          _hasResult = true;
          _isLoading = false;
          _gptEnhancement ??= _loadGptEnhancement(
            forceFresh: false,
            readCacheOnly: true,
          );
        });
        widget.onCompleted?.call();
      }
      return result;
    } on Object {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
      rethrow;
    }
  }

  Future<MobileAiGptEnhancement?> _loadGptEnhancement({
    bool forceFresh = true,
    bool readCacheOnly = false,
  }) async {
    try {
      final response = await widget.apiClient.createAnalyzerGptEnhancement({
        ...widget.payload,
        "forceFreshBaseAnalysis": false,
        "forceFreshEnhancement": forceFresh,
        "readCacheOnly": readCacheOnly,
      });
      final data = response["data"];
      if (data is! Map<String, dynamic>) {
        throw const LooApiException("GPT 增强解读格式不正确。");
      }
      final enhancement = data["enhancement"];
      if (enhancement == null && readCacheOnly) {
        if (mounted) {
          setState(() {
            _isEnhancing = false;
            _hasGptEnhancementResult = false;
          });
        }
        return null;
      }
      if (enhancement is! Map<String, dynamic>) {
        throw const LooApiException("GPT 增强解读为空。");
      }
      final result = MobileAiGptEnhancement.fromJson(enhancement);
      if (mounted) {
        setState(() {
          _isEnhancing = false;
          _hasGptEnhancementResult = true;
        });
      }
      return result;
    } on Object {
      if (mounted) {
        setState(() {
          _isEnhancing = false;
          if (readCacheOnly) {
            _hasGptEnhancementResult = false;
          }
        });
      }
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    final future = _analysis;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.title,
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 6),
                      Text(widget.description),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    FilledButton.icon(
                      onPressed: _isLoading
                          ? null
                          : future == null
                              ? () => _runAnalysis()
                              : _hasResult
                                  ? () => _runAnalysis(refresh: true)
                                  : null,
                      icon: const Icon(Icons.auto_awesome),
                      label: Text(_hasResult ? "重新生成" : "生成"),
                    ),
                  ],
                ),
              ],
            ),
            if (future != null) ...[
              const SizedBox(height: 14),
              FutureBuilder<MobileAiAnalysisResult>(
                future: future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: LinearProgressIndicator(),
                    );
                  }

                  if (snapshot.hasError) {
                    return _AnalysisError(
                      message: _friendlyAnalysisErrorMessage(snapshot.error),
                      onRetry: () => _runAnalysis(refresh: true),
                    );
                  }

                  final data = snapshot.data;
                  if (data == null) {
                    return _AnalysisError(
                      message: "没有拿到智能快扫结果。",
                      onRetry: () => _runAnalysis(refresh: true),
                    );
                  }

                  return _AnalysisResultView(data);
                },
              ),
              if (_hasResult) ...[
                const SizedBox(height: 12),
                _GptEnhancementPanel(
                  future: _gptEnhancement,
                  isLoading: _isEnhancing,
                  hasResult: _hasGptEnhancementResult,
                  onRun: _runGptEnhancement,
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

String _stableJsonSignature(Object? value) {
  return jsonEncode(_normalizeJsonValue(value));
}

Object? _normalizeJsonValue(Object? value) {
  if (value is Map) {
    final entries = value.entries
        .map((entry) => MapEntry(entry.key.toString(), entry.value))
        .toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return {
      for (final entry in entries) entry.key: _normalizeJsonValue(entry.value),
    };
  }
  if (value is Iterable) {
    return value.map(_normalizeJsonValue).toList();
  }
  return value;
}

class MobileAiAnalysisResult {
  const MobileAiAnalysisResult({
    required this.scope,
    required this.title,
    required this.thesis,
    required this.confidence,
    required this.securityDecision,
    required this.securityResearchDecision,
    required this.scorecards,
    required this.risks,
    required this.taxNotes,
    required this.portfolioFit,
    required this.actionItems,
    required this.sources,
    required this.disclaimerZh,
    required this.sourceMode,
    required this.quotesAsOf,
    required this.quoteSourceSummary,
    required this.quoteFreshnessSummary,
    required this.freshnessLabel,
    required this.reliabilityScore,
    required this.limitationSummary,
    required this.evidenceTrail,
  });

  final String scope;
  final String title;
  final String thesis;
  final String confidence;
  final MobileAiSecurityDecision? securityDecision;
  final MobileSecurityResearchDecision? securityResearchDecision;
  final List<MobileAiScorecard> scorecards;
  final List<MobileAiRisk> risks;
  final List<String> taxNotes;
  final List<String> portfolioFit;
  final List<MobileAiActionItem> actionItems;
  final List<String> sources;
  final String disclaimerZh;
  final String sourceMode;
  final String? quotesAsOf;
  final String? quoteSourceSummary;
  final String? quoteFreshnessSummary;
  final String? freshnessLabel;
  final double? reliabilityScore;
  final String? limitationSummary;
  final List<MobileAiEvidenceItem> evidenceTrail;

  factory MobileAiAnalysisResult.fromJson(Map<String, dynamic> json) {
    final summary = _readMap(json["summary"]);
    final dataFreshness = _readMap(json["dataFreshness"]);
    final disclaimer = _readMap(json["disclaimer"]);
    return MobileAiAnalysisResult(
      scope: json["scope"] as String? ?? "security",
      title: summary["title"] as String? ?? "智能快扫",
      thesis: _friendlyAnalysisText(summary["thesis"] as String? ?? ""),
      confidence: summary["confidence"] as String? ?? "medium",
      securityDecision: json["securityDecision"] is Map<String, dynamic>
          ? MobileAiSecurityDecision.fromJson(
              json["securityDecision"] as Map<String, dynamic>)
          : null,
      securityResearchDecision:
          json["securityResearchDecision"] is Map<String, dynamic>
              ? MobileSecurityResearchDecision.fromJson(
                  json["securityResearchDecision"] as Map<String, dynamic>)
              : null,
      scorecards: _readMapList(json["scorecards"])
          .map(MobileAiScorecard.fromJson)
          .toList(),
      risks: _readMapList(json["risks"]).map(MobileAiRisk.fromJson).toList(),
      taxNotes:
          _readStringList(json["taxNotes"]).map(_friendlyAnalysisText).toList(),
      portfolioFit: _readStringList(json["portfolioFit"])
          .map(_friendlyAnalysisText)
          .toList(),
      actionItems: _readMapList(json["actionItems"])
          .map(MobileAiActionItem.fromJson)
          .toList(),
      sources: _readMapList(json["sources"])
          .map((item) => _friendlyAnalysisText(item["title"] as String? ?? ""))
          .where((item) => item.isNotEmpty)
          .toList(),
      disclaimerZh: disclaimer["zh"] as String? ?? "仅用于研究学习，不构成投资建议。",
      sourceMode: dataFreshness["sourceMode"] as String? ?? "local",
      quotesAsOf: dataFreshness["quotesAsOf"] as String?,
      quoteSourceSummary:
          _friendlyNullableText(dataFreshness["quoteSourceSummary"] as String?),
      quoteFreshnessSummary: _friendlyNullableText(
          dataFreshness["quoteFreshnessSummary"] as String?),
      freshnessLabel:
          _friendlyNullableText(dataFreshness["freshnessLabel"] as String?),
      reliabilityScore: dataFreshness["reliabilityScore"] is num
          ? (dataFreshness["reliabilityScore"] as num).toDouble().clamp(0, 100)
          : null,
      limitationSummary:
          _friendlyNullableText(dataFreshness["limitationSummary"] as String?),
      evidenceTrail: _readMapList(json["evidenceTrail"])
          .map(MobileAiEvidenceItem.fromJson)
          .toList(),
    );
  }
}

class MobileAiEvidenceItem {
  const MobileAiEvidenceItem({
    required this.label,
    required this.sourceMode,
    required this.confidence,
    required this.freshness,
    required this.asOf,
    required this.detail,
  });

  final String label;
  final String sourceMode;
  final String confidence;
  final String freshness;
  final String? asOf;
  final String detail;

  factory MobileAiEvidenceItem.fromJson(Map<String, dynamic> json) {
    return MobileAiEvidenceItem(
      label: _friendlyAnalysisText(json["label"] as String? ?? "数据来源"),
      sourceMode: json["sourceMode"] as String? ?? "local",
      confidence: json["confidence"] as String? ?? "medium",
      freshness: json["freshness"] as String? ?? "partial",
      asOf: json["asOf"] as String?,
      detail: _friendlyAnalysisText(json["detail"] as String? ?? ""),
    );
  }
}

class MobileAiSecurityDecision {
  const MobileAiSecurityDecision({
    required this.verdict,
    required this.decisionLabel,
    required this.confidenceScore,
    required this.directAnswer,
    required this.primaryAction,
    required this.whyNow,
    required this.portfolioFit,
    required this.keyBlockers,
    required this.decisionGates,
    required this.nextSteps,
    required this.boundary,
    required this.positionSizingIdea,
    required this.watchlistTriggers,
    required this.evidence,
  });

  final String verdict;
  final String? decisionLabel;
  final double? confidenceScore;
  final String directAnswer;
  final MobileAiPrimaryAction? primaryAction;
  final List<String> whyNow;
  final List<String> portfolioFit;
  final List<String> keyBlockers;
  final List<String> decisionGates;
  final List<String> nextSteps;
  final String? boundary;
  final String? positionSizingIdea;
  final List<String> watchlistTriggers;
  final List<String> evidence;

  factory MobileAiSecurityDecision.fromJson(Map<String, dynamic> json) {
    final confidenceScore = json["confidenceScore"];
    return MobileAiSecurityDecision(
      verdict: json["verdict"] as String? ?? "watch-only",
      decisionLabel: _friendlyNullableText(json["decisionLabel"] as String?),
      confidenceScore: confidenceScore is num
          ? confidenceScore.toDouble().clamp(0, 100)
          : null,
      directAnswer:
          _friendlyAnalysisText(json["directAnswer"] as String? ?? ""),
      primaryAction: json["primaryAction"] is Map<String, dynamic>
          ? MobileAiPrimaryAction.fromJson(
              json["primaryAction"] as Map<String, dynamic>)
          : null,
      whyNow:
          _readStringList(json["whyNow"]).map(_friendlyAnalysisText).toList(),
      portfolioFit: _readStringList(json["portfolioFit"])
          .map(_friendlyAnalysisText)
          .toList(),
      keyBlockers: _readStringList(json["keyBlockers"])
          .map(_friendlyAnalysisText)
          .toList(),
      decisionGates: _readStringList(json["decisionGates"])
          .map(_friendlyAnalysisText)
          .toList(),
      nextSteps: _readStringList(json["nextSteps"])
          .map(_friendlyAnalysisText)
          .toList(),
      boundary: _friendlyNullableText(json["boundary"] as String?),
      positionSizingIdea:
          _friendlyNullableText(json["positionSizingIdea"] as String?),
      watchlistTriggers: _readStringList(json["watchlistTriggers"])
          .map(_friendlyAnalysisText)
          .toList(),
      evidence:
          _readStringList(json["evidence"]).map(_friendlyAnalysisText).toList(),
    );
  }
}

class MobileAiPrimaryAction {
  const MobileAiPrimaryAction({
    required this.priority,
    required this.label,
    required this.detail,
  });

  final String priority;
  final String label;
  final String detail;

  factory MobileAiPrimaryAction.fromJson(Map<String, dynamic> json) {
    return MobileAiPrimaryAction(
      priority: json["priority"] as String? ?? "P1",
      label: _friendlyAnalysisText(json["label"] as String? ?? "保持观察"),
      detail: _friendlyAnalysisText(json["detail"] as String? ?? ""),
    );
  }
}

class MobileSecurityResearchDecision {
  const MobileSecurityResearchDecision({
    required this.decisionLabel,
    required this.confidenceScore,
    required this.primaryReason,
    required this.assetType,
    required this.vetoedBy,
    required this.guardrails,
    required this.portfolioFit,
    required this.valuationEvidence,
    required this.entryTiming,
    required this.actionPlans,
    required this.evidence,
  });

  final String decisionLabel;
  final double? confidenceScore;
  final String primaryReason;
  final String assetType;
  final List<String> vetoedBy;
  final List<MobileResearchGuardrail> guardrails;
  final MobileResearchPortfolioFit portfolioFit;
  final MobileResearchValuationEvidence valuationEvidence;
  final MobileResearchEntryTiming entryTiming;
  final List<MobileResearchActionPlan> actionPlans;
  final List<MobileResearchEvidence> evidence;

  factory MobileSecurityResearchDecision.fromJson(Map<String, dynamic> json) {
    final decision = _readMap(json["decision"]);
    final security = _readMap(json["security"]);
    return MobileSecurityResearchDecision(
      decisionLabel:
          _friendlyAnalysisText(decision["label"] as String? ?? "保持观察"),
      confidenceScore: decision["confidenceScore"] is num
          ? (decision["confidenceScore"] as num).toDouble().clamp(0, 100)
          : null,
      primaryReason:
          _friendlyAnalysisText(decision["primaryReason"] as String? ?? ""),
      assetType: security["assetType"] as String? ?? "other",
      vetoedBy: _readStringList(decision["vetoedBy"]),
      guardrails: _readMapList(json["guardrails"])
          .map(MobileResearchGuardrail.fromJson)
          .toList(),
      portfolioFit:
          MobileResearchPortfolioFit.fromJson(_readMap(json["portfolioFit"])),
      valuationEvidence: MobileResearchValuationEvidence.fromJson(
          _readMap(json["valuationEvidence"])),
      entryTiming:
          MobileResearchEntryTiming.fromJson(_readMap(json["entryTiming"])),
      actionPlans: _readMapList(json["actionPlans"])
          .map(MobileResearchActionPlan.fromJson)
          .toList(),
      evidence: _readMapList(json["evidence"])
          .map(MobileResearchEvidence.fromJson)
          .toList(),
    );
  }
}

class MobileResearchGuardrail {
  const MobileResearchGuardrail({
    required this.severity,
    required this.title,
    required this.detail,
  });

  final String severity;
  final String title;
  final String detail;

  factory MobileResearchGuardrail.fromJson(Map<String, dynamic> json) {
    return MobileResearchGuardrail(
      severity: json["severity"] as String? ?? "info",
      title: _friendlyAnalysisText(json["title"] as String? ?? "护栏"),
      detail: _friendlyAnalysisText(json["detail"] as String? ?? ""),
    );
  }
}

class MobileResearchPortfolioFit {
  const MobileResearchPortfolioFit({
    required this.score,
    required this.sleeve,
    required this.targetGapLabel,
    required this.currentExposureLabel,
    required this.duplicateExposureLabel,
    required this.accountTaxFitLabel,
    required this.liquidityFitLabel,
  });

  final double? score;
  final String sleeve;
  final String targetGapLabel;
  final String currentExposureLabel;
  final String? duplicateExposureLabel;
  final String? accountTaxFitLabel;
  final String? liquidityFitLabel;

  factory MobileResearchPortfolioFit.fromJson(Map<String, dynamic> json) {
    return MobileResearchPortfolioFit(
      score: json["score"] is num
          ? (json["score"] as num).toDouble().clamp(0, 100)
          : null,
      sleeve: _friendlyAnalysisText(json["sleeve"] as String? ?? "组合"),
      targetGapLabel:
          _friendlyAnalysisText(json["targetGapLabel"] as String? ?? ""),
      currentExposureLabel:
          _friendlyAnalysisText(json["currentExposureLabel"] as String? ?? ""),
      duplicateExposureLabel:
          _friendlyNullableText(json["duplicateExposureLabel"] as String?),
      accountTaxFitLabel:
          _friendlyNullableText(json["accountTaxFitLabel"] as String?),
      liquidityFitLabel:
          _friendlyNullableText(json["liquidityFitLabel"] as String?),
    );
  }
}

class MobileResearchValuationEvidence {
  const MobileResearchValuationEvidence({
    required this.method,
    required this.confidence,
    required this.summary,
    required this.anchors,
    required this.sanityChecks,
  });

  final String method;
  final String confidence;
  final String summary;
  final List<MobileResearchAnchor> anchors;
  final List<MobileResearchSanityCheck> sanityChecks;

  factory MobileResearchValuationEvidence.fromJson(Map<String, dynamic> json) {
    return MobileResearchValuationEvidence(
      method: json["method"] as String? ?? "unavailable",
      confidence: json["confidence"] as String? ?? "low",
      summary: _friendlyAnalysisText(json["summary"] as String? ?? ""),
      anchors: _readMapList(json["anchors"])
          .map(MobileResearchAnchor.fromJson)
          .toList(),
      sanityChecks: _readMapList(json["sanityChecks"])
          .map(MobileResearchSanityCheck.fromJson)
          .toList(),
    );
  }
}

class MobileResearchAnchor {
  const MobileResearchAnchor({
    required this.label,
    required this.value,
    required this.source,
  });

  final String label;
  final String value;
  final String source;

  factory MobileResearchAnchor.fromJson(Map<String, dynamic> json) {
    return MobileResearchAnchor(
      label: _friendlyAnalysisText(json["label"] as String? ?? "证据"),
      value: _friendlyAnalysisText(json["value"] as String? ?? ""),
      source: _friendlyAnalysisText(json["source"] as String? ?? ""),
    );
  }
}

class MobileResearchSanityCheck {
  const MobileResearchSanityCheck({
    required this.label,
    required this.status,
    required this.detail,
  });

  final String label;
  final String status;
  final String detail;

  factory MobileResearchSanityCheck.fromJson(Map<String, dynamic> json) {
    return MobileResearchSanityCheck(
      label: _friendlyAnalysisText(json["label"] as String? ?? "校验"),
      status: json["status"] as String? ?? "unavailable",
      detail: _friendlyAnalysisText(json["detail"] as String? ?? ""),
    );
  }
}

class MobileResearchEntryTiming {
  const MobileResearchEntryTiming({
    required this.posture,
    required this.keyLevels,
    required this.marketPulseLabel,
  });

  final String posture;
  final List<MobileResearchKeyLevel> keyLevels;
  final String? marketPulseLabel;

  factory MobileResearchEntryTiming.fromJson(Map<String, dynamic> json) {
    return MobileResearchEntryTiming(
      posture: json["posture"] as String? ?? "not_applicable",
      keyLevels: _readMapList(json["keyLevels"])
          .map(MobileResearchKeyLevel.fromJson)
          .toList(),
      marketPulseLabel:
          _friendlyNullableText(json["marketPulseLabel"] as String?),
    );
  }
}

class MobileResearchKeyLevel {
  const MobileResearchKeyLevel({
    required this.label,
    required this.value,
    required this.type,
    required this.source,
  });

  final String label;
  final String value;
  final String type;
  final String source;

  factory MobileResearchKeyLevel.fromJson(Map<String, dynamic> json) {
    return MobileResearchKeyLevel(
      label: _friendlyAnalysisText(json["label"] as String? ?? "关键位"),
      value: _friendlyAnalysisText(json["value"] as String? ?? ""),
      type: json["type"] as String? ?? "VALUATION_ANCHOR",
      source: _friendlyAnalysisText(json["source"] as String? ?? ""),
    );
  }
}

class MobileResearchActionPlan {
  const MobileResearchActionPlan({
    required this.type,
    required this.title,
    required this.detail,
    required this.isBlockedByPortfolioFit,
    required this.priority,
    required this.status,
    required this.triggerLabel,
    required this.evidenceLabels,
    required this.requiredConfirmations,
  });

  final String type;
  final String title;
  final String detail;
  final bool isBlockedByPortfolioFit;
  final String priority;
  final String status;
  final String? triggerLabel;
  final List<String> evidenceLabels;
  final List<String> requiredConfirmations;

  factory MobileResearchActionPlan.fromJson(Map<String, dynamic> json) {
    return MobileResearchActionPlan(
      type: json["type"] as String? ?? "watch_only",
      title: _friendlyAnalysisText(json["title"] as String? ?? "行动计划"),
      detail: _friendlyAnalysisText(json["detail"] as String? ?? ""),
      isBlockedByPortfolioFit: json["isBlockedByPortfolioFit"] == true,
      priority: json["priority"] as String? ?? "P1",
      status: json["status"] as String? ?? "wait",
      triggerLabel: _friendlyNullableText(json["triggerLabel"] as String?),
      evidenceLabels: _readStringList(json["evidenceLabels"])
          .map(_friendlyAnalysisText)
          .toList(),
      requiredConfirmations: _readStringList(json["requiredConfirmations"])
          .map(_friendlyAnalysisText)
          .toList(),
    );
  }
}

class MobileResearchEvidence {
  const MobileResearchEvidence({
    required this.source,
    required this.sourceType,
    required this.freshnessLabel,
    required this.reliabilityLabel,
  });

  final String source;
  final String sourceType;
  final String freshnessLabel;
  final String reliabilityLabel;

  factory MobileResearchEvidence.fromJson(Map<String, dynamic> json) {
    return MobileResearchEvidence(
      source: _friendlyAnalysisText(json["source"] as String? ?? "证据"),
      sourceType: json["sourceType"] as String? ?? "portfolio",
      freshnessLabel:
          _friendlyAnalysisText(json["freshnessLabel"] as String? ?? "部分可用"),
      reliabilityLabel: _friendlyAnalysisText(
          json["reliabilityLabel"] as String? ?? "medium"),
    );
  }
}

class MobileAiGptEnhancement {
  const MobileAiGptEnhancement({
    required this.title,
    required this.directAnswer,
    required this.reasoning,
    required this.decisionGates,
    required this.boundary,
    required this.nextStep,
    required this.sourceLabel,
    required this.authorityBoundary,
    required this.disclaimerZh,
  });

  final String title;
  final String directAnswer;
  final List<String> reasoning;
  final List<String> decisionGates;
  final String? boundary;
  final String? nextStep;
  final String sourceLabel;
  final String authorityBoundary;
  final String disclaimerZh;

  factory MobileAiGptEnhancement.fromJson(Map<String, dynamic> json) {
    final disclaimer = _readMap(json["disclaimer"]);
    return MobileAiGptEnhancement(
      title: json["title"] as String? ?? "GPT 增强解读",
      directAnswer:
          _friendlyAnalysisText(json["directAnswer"] as String? ?? ""),
      reasoning: _readStringList(json["reasoning"])
          .map(_friendlyAnalysisText)
          .toList(),
      decisionGates: _readStringList(json["decisionGates"])
          .map(_friendlyAnalysisText)
          .toList(),
      boundary: _friendlyNullableText(json["boundary"] as String?),
      nextStep: _friendlyNullableText(json["nextStep"] as String?),
      sourceLabel: json["sourceLabel"] as String? ?? "GPT 增强解读",
      authorityBoundary: _friendlyAnalysisText(
        json["authorityBoundary"] as String? ?? "GPT 只增强解释，不改变智能快扫结论、护栏或行动优先级。",
      ),
      disclaimerZh: disclaimer["zh"] as String? ?? "仅用于研究学习，不构成投资建议。",
    );
  }
}

String? _friendlyNullableText(String? value) {
  if (value == null || value.trim().isEmpty) return null;
  return _friendlyAnalysisText(value);
}

String _friendlyAnalysisText(String value) {
  var text = value;
  text = text.replaceAllMapped(
    RegExp(r"quotes=([a-zA-Z0-9_-]+)"),
    (match) => "报价来自 ${_providerLabel(match.group(1) ?? "")}",
  );
  text = text.replaceAllMapped(
    RegExp(r"history=([a-zA-Z0-9_-]+)"),
    (match) => "历史价格来自 ${_providerLabel(match.group(1) ?? "")}",
  );
  text = text.replaceAllMapped(
    RegExp(r"quoteStatus=([a-zA-Z0-9_-]+)"),
    (match) => _quoteStatusLabel(match.group(1) ?? ""),
  );
  text = text.replaceAllMapped(
    RegExp(r"historyAsOf=([0-9]{4}-[0-9]{2}-[0-9]{2})"),
    (match) => "历史价格截至 ${match.group(1)}",
  );
  text = text.replaceAllMapped(
    RegExp(r"historyPoints=([0-9]+)"),
    (match) => "历史样本 ${match.group(1)} 个交易日",
  );
  text = text
      .replaceAll("Cached holding quotes", "缓存持仓报价")
      .replaceAll("Cached price history", "缓存价格历史")
      .replaceAll("Local holdings and account data", "本地持仓与账户数据")
      .replaceAll("Cached holding quote fields", "缓存持仓报价字段")
      .replaceAll("Local portfolio health summary", "本地组合健康摘要")
      .replaceAll("Local account health summary", "本地账户健康摘要")
      .replaceAll("Local account holdings", "本地账户持仓")
      .replaceAll("Local recommendation run", "本地推荐记录")
      .replaceAll("provider", "数据来源")
      .replaceAll("Provider", "数据来源")
      .replaceAll("sourceMode", "来源状态")
      .replaceAll("fallback", "保守参考")
      .replaceAll("Fallback", "保守参考")
      .replaceAll("run-analysis", "智能快扫")
      .replaceAll("DTO", "数据结构");
  text = text.replaceAll(RegExp(r"\bP[0-3]\b\s*[:：]?\s*"), "");
  return text.replaceAll(RegExp(r"\s*;\s*"), "；").trim();
}

String _providerLabel(String value) {
  return value
      .split(RegExp(r"[-_\s]+"))
      .where((part) => part.isNotEmpty)
      .map((part) => part.length <= 3
          ? part.toUpperCase()
          : "${part.substring(0, 1).toUpperCase()}${part.substring(1)}")
      .join(" ");
}

String _quoteStatusLabel(String value) {
  final normalized = value.toLowerCase();
  if (normalized == "fresh" || normalized == "success") {
    return "报价较新";
  }
  if (normalized == "stale") return "报价可能过期";
  if (normalized == "failed" || normalized == "error") return "报价刷新失败";
  return "报价状态待确认";
}

class MobileAiScorecard {
  const MobileAiScorecard({
    required this.label,
    required this.score,
    required this.rationale,
  });

  final String label;
  final double score;
  final String rationale;

  factory MobileAiScorecard.fromJson(Map<String, dynamic> json) {
    final score = json["score"];
    return MobileAiScorecard(
      label: json["label"] as String? ?? "评分",
      score: score is num ? score.toDouble().clamp(0, 100) : 0,
      rationale: _friendlyAnalysisText(json["rationale"] as String? ?? ""),
    );
  }
}

class MobileAiRisk {
  const MobileAiRisk({
    required this.severity,
    required this.title,
    required this.detail,
  });

  final String severity;
  final String title;
  final String detail;

  factory MobileAiRisk.fromJson(Map<String, dynamic> json) {
    return MobileAiRisk(
      severity: json["severity"] as String? ?? "info",
      title: json["title"] as String? ?? "风险提示",
      detail: _friendlyAnalysisText(json["detail"] as String? ?? ""),
    );
  }
}

class MobileAiActionItem {
  const MobileAiActionItem({
    required this.priority,
    required this.title,
    required this.detail,
  });

  final String priority;
  final String title;
  final String detail;

  factory MobileAiActionItem.fromJson(Map<String, dynamic> json) {
    return MobileAiActionItem(
      priority: json["priority"] as String? ?? "P1",
      title: json["title"] as String? ?? "当前分析结论",
      detail: _friendlyAnalysisText(json["detail"] as String? ?? ""),
    );
  }
}

class _AnalysisResultView extends StatelessWidget {
  const _AnalysisResultView(this.data);

  final MobileAiAnalysisResult data;

  @override
  Widget build(BuildContext context) {
    final labels = _AnalysisScopeLabels.forScope(data.scope);
    final securityDecision = data.securityDecision;
    final researchDecision = data.securityResearchDecision;
    final showLegacySecuritySections = researchDecision == null;
    final visibleActionItems = _dedupeActionItems(data.actionItems);
    final visibleFit = _dedupeStrings(
      securityDecision?.portfolioFit.isNotEmpty == true
          ? securityDecision!.portfolioFit
          : data.portfolioFit,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _AnalysisSection(
          title: labels.summary,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(data.title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(securityDecision?.directAnswer.isNotEmpty == true
                  ? securityDecision!.directAnswer
                  : data.thesis),
              const SizedBox(height: 8),
              _MetaPill([
                if (securityDecision?.decisionLabel != null)
                  securityDecision!.decisionLabel!,
                if (securityDecision?.confidenceScore != null)
                  "可信度 ${securityDecision!.confidenceScore!.round()}",
                if (securityDecision?.confidenceScore == null)
                  "可信度 ${_confidenceLabel(data.confidence)}",
                _sourceModeLabel(data.sourceMode),
              ].join(" · ")),
            ],
          ),
        ),
        if (securityDecision?.primaryAction != null)
          _AnalysisSection(
            title: "当前结论",
            child: _PrimaryActionCard(securityDecision!.primaryAction!),
          ),
        if (researchDecision != null)
          _SecurityResearchDecisionView(researchDecision),
        if (showLegacySecuritySections &&
            securityDecision != null &&
            securityDecision.whyNow.isNotEmpty)
          _AnalysisSection(
            title: "为什么现在看",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: securityDecision.whyNow.take(4).map(_bullet).toList(),
            ),
          ),
        if (showLegacySecuritySections &&
            securityDecision != null &&
            securityDecision.keyBlockers.isNotEmpty)
          _AnalysisSection(
            title: "主要护栏",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children:
                  securityDecision.keyBlockers.take(4).map(_bullet).toList(),
            ),
          ),
        if (showLegacySecuritySections &&
            securityDecision != null &&
            securityDecision.decisionGates.isNotEmpty)
          _AnalysisSection(
            title: "判断前提",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children:
                  securityDecision.decisionGates.take(4).map(_bullet).toList(),
            ),
          ),
        if (showLegacySecuritySections &&
            securityDecision?.positionSizingIdea != null)
          _AnalysisSection(
            title: "仓位思路",
            child: Text(securityDecision!.positionSizingIdea!),
          ),
        if (showLegacySecuritySections && visibleActionItems.isNotEmpty)
          _AnalysisSection(
            title: labels.actions,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: visibleActionItems.take(4).map(_ActionRow.new).toList(),
            ),
          ),
        if (showLegacySecuritySections && data.risks.isNotEmpty)
          _AnalysisSection(
            title: "风险护栏",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: data.risks.take(4).map(_RiskRow.new).toList(),
            ),
          ),
        if (data.taxNotes.isNotEmpty) ...[
          _AnalysisSection(
            title: "税务/账户提醒",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: data.taxNotes.take(3).map(_bullet).toList(),
            ),
          ),
        ],
        if (showLegacySecuritySections && visibleFit.isNotEmpty)
          _AnalysisSection(
            title: labels.fit,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: visibleFit.take(4).map(_bullet).toList(),
            ),
          ),
        if (showLegacySecuritySections &&
            securityDecision != null &&
            securityDecision.watchlistTriggers.isNotEmpty)
          _AnalysisSection(
            title: "观察触发点",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: securityDecision.watchlistTriggers
                  .take(4)
                  .map(_bullet)
                  .toList(),
            ),
          ),
        if (showLegacySecuritySections &&
            securityDecision != null &&
            securityDecision.nextSteps.isNotEmpty)
          _AnalysisSection(
            title: "确认事项",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children:
                  securityDecision.nextSteps.take(4).map(_bullet).toList(),
            ),
          ),
        if (showLegacySecuritySections && securityDecision?.boundary != null)
          _AnalysisSection(
            title: "边界说明",
            child: Text(
              securityDecision!.boundary!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        if (data.scorecards.isNotEmpty ||
            data.evidenceTrail.isNotEmpty ||
            data.quoteSourceSummary != null ||
            data.quoteFreshnessSummary != null ||
            data.freshnessLabel != null ||
            data.reliabilityScore != null ||
            data.limitationSummary != null ||
            data.quotesAsOf != null)
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            initiallyExpanded: false,
            title:
                Text("可信度与依据", style: Theme.of(context).textTheme.titleSmall),
            childrenPadding: const EdgeInsets.only(bottom: 12),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: _DataEvidenceView(data),
              ),
            ],
          ),
        if (data.sources.isNotEmpty)
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: Text("来源详情", style: Theme.of(context).textTheme.titleSmall),
            childrenPadding: EdgeInsets.zero,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  data.sources.take(6).join("、"),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ],
          ),
        const SizedBox(height: 8),
        Text(data.disclaimerZh, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _SecurityResearchDecisionView extends StatelessWidget {
  const _SecurityResearchDecisionView(this.data);

  final MobileSecurityResearchDecision data;

  @override
  Widget build(BuildContext context) {
    final guardrails = data.guardrails.take(4).toList();
    final actionPlans = data.actionPlans.take(3).toList();
    final fitLines = [
      data.portfolioFit.targetGapLabel,
      data.portfolioFit.currentExposureLabel,
      if (data.portfolioFit.duplicateExposureLabel != null)
        data.portfolioFit.duplicateExposureLabel!,
      if (data.portfolioFit.accountTaxFitLabel != null)
        data.portfolioFit.accountTaxFitLabel!,
      if (data.portfolioFit.liquidityFitLabel != null)
        data.portfolioFit.liquidityFitLabel!,
    ].where((item) => item.trim().isNotEmpty).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _AnalysisSection(
          title: "研究结论",
          child: _ResearchDecisionHeader(data),
        ),
        if (actionPlans.isNotEmpty)
          _AnalysisSection(
            title: "行动计划",
            child: Column(
              children: actionPlans
                  .map((plan) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _ResearchActionPlanCard(plan),
                      ))
                  .toList(),
            ),
          ),
        _AnalysisSection(
          title: "估值证据",
          child: _ValuationEvidenceView(data.valuationEvidence),
        ),
        if (data.entryTiming.keyLevels.isNotEmpty ||
            data.entryTiming.marketPulseLabel != null)
          _AnalysisSection(
            title: "关键价位",
            child: _EntryTimingView(data.entryTiming),
          ),
        if (fitLines.isNotEmpty)
          _AnalysisSection(
            title: "组合适配",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: fitLines.take(5).map(_bullet).toList(),
            ),
          ),
        if (guardrails.isNotEmpty)
          _AnalysisSection(
            title: "主要护栏",
            child: Column(
              children: guardrails
                  .map((guardrail) => _ResearchGuardrailRow(guardrail))
                  .toList(),
            ),
          ),
        if (data.evidence.isNotEmpty)
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            initiallyExpanded: false,
            title: Text("研究证据", style: Theme.of(context).textTheme.titleSmall),
            childrenPadding: const EdgeInsets.only(bottom: 12),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: data.evidence
                      .take(5)
                      .map(_ResearchEvidenceRow.new)
                      .toList(),
                ),
              ),
            ],
          ),
      ],
    );
  }
}

class _ResearchDecisionHeader extends StatelessWidget {
  const _ResearchDecisionHeader(this.data);

  final MobileSecurityResearchDecision data;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _MetaPill(data.decisionLabel),
                _MetaPill(_assetTypeLabel(data.assetType)),
                if (data.confidenceScore != null)
                  _MetaPill("可信度 ${data.confidenceScore!.round()}"),
                if (data.vetoedBy.isNotEmpty)
                  _MetaPill("护栏 ${data.vetoedBy.length}"),
              ],
            ),
            if (data.primaryReason.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                data.primaryReason,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ValuationEvidenceView extends StatelessWidget {
  const _ValuationEvidenceView(this.data);

  final MobileResearchValuationEvidence data;

  @override
  Widget build(BuildContext context) {
    final anchors = data.anchors.take(6).toList();
    final checks = data.sanityChecks.take(3).toList();
    final needsCachedProfile = data.method == "unavailable";
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _MetaPill(_valuationMethodLabel(data.method)),
            _MetaPill("置信 ${_confidenceLabel(data.confidence)}"),
          ],
        ),
        if (data.summary.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text(data.summary),
        ],
        if (needsCachedProfile) ...[
          const SizedBox(height: 10),
          const _InlineInfoCallout(
            icon: Icons.badge_outlined,
            title: "需要先缓存基本资料",
            detail: "到本页下方的「刷新该标的资料」点击「基本资料」。后台任务完成后，再点「重新生成」即可看到估值锚点。",
          ),
        ],
        if (anchors.isNotEmpty) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: anchors
                .map((anchor) => _ResearchValuePill(
                      label: anchor.label,
                      value: anchor.value,
                    ))
                .toList(),
          ),
        ],
        if (checks.isNotEmpty) ...[
          const SizedBox(height: 10),
          ...checks.map(_ResearchSanityCheckRow.new),
        ],
      ],
    );
  }
}

class _EntryTimingView extends StatelessWidget {
  const _EntryTimingView(this.data);

  final MobileResearchEntryTiming data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _MetaPill(_entryPostureLabel(data.posture)),
            if (data.marketPulseLabel != null)
              _MetaPill(data.marketPulseLabel!),
          ],
        ),
        if (data.keyLevels.isNotEmpty) ...[
          const SizedBox(height: 10),
          ...data.keyLevels.take(6).map(_ResearchKeyLevelRow.new),
        ],
      ],
    );
  }
}

class _ResearchActionPlanCard extends StatelessWidget {
  const _ResearchActionPlanCard(this.plan);

  final MobileResearchActionPlan plan;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final statusColor = switch (plan.status) {
      "ready" => colorScheme.primary,
      "blocked" => colorScheme.error,
      "needs_data" => colorScheme.tertiary,
      _ => colorScheme.secondary,
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.route, size: 18, color: statusColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(plan.title,
                      style: Theme.of(context).textTheme.titleSmall),
                ),
                _SmallStatusPill(_actionStatusLabel(plan.status)),
              ],
            ),
            if (plan.detail.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(plan.detail),
            ],
            if (plan.triggerLabel != null) ...[
              const SizedBox(height: 8),
              Text("触发：${plan.triggerLabel!}",
                  style: Theme.of(context).textTheme.bodySmall),
            ],
            if (plan.evidenceLabels.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: plan.evidenceLabels
                    .take(4)
                    .map((label) => _SmallStatusPill(label))
                    .toList(),
              ),
            ],
            if (plan.requiredConfirmations.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...plan.requiredConfirmations.take(3).map(_bullet),
            ],
          ],
        ),
      ),
    );
  }
}

class _ResearchGuardrailRow extends StatelessWidget {
  const _ResearchGuardrailRow(this.guardrail);

  final MobileResearchGuardrail guardrail;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SeverityDot(_guardrailSeverityToRisk(guardrail.severity)),
          const SizedBox(width: 8),
          Expanded(
            child: Text([
              guardrail.title,
              if (guardrail.detail.isNotEmpty) guardrail.detail,
            ].join("：")),
          ),
        ],
      ),
    );
  }
}

class _ResearchSanityCheckRow extends StatelessWidget {
  const _ResearchSanityCheckRow(this.check);

  final MobileResearchSanityCheck check;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SmallStatusPill(_sanityStatusLabel(check.status)),
          const SizedBox(width: 8),
          Expanded(
            child: Text([
              check.label,
              if (check.detail.isNotEmpty) check.detail,
            ].join("：")),
          ),
        ],
      ),
    );
  }
}

class _ResearchKeyLevelRow extends StatelessWidget {
  const _ResearchKeyLevelRow(this.level);

  final MobileResearchKeyLevel level;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(child: Text(level.label)),
          const SizedBox(width: 10),
          Text(level.value, style: Theme.of(context).textTheme.titleSmall),
        ],
      ),
    );
  }
}

class _ResearchEvidenceRow extends StatelessWidget {
  const _ResearchEvidenceRow(this.item);

  final MobileResearchEvidence item;

  @override
  Widget build(BuildContext context) {
    final meta = [
      _researchSourceTypeLabel(item.sourceType),
      _freshnessStatusLabel(item.freshnessLabel),
      _confidenceLabel(item.reliabilityLabel),
    ].join(" · ");
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.source, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 3),
          Text(meta, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _ResearchValuePill extends StatelessWidget {
  const _ResearchValuePill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 2),
            Text(value, style: Theme.of(context).textTheme.titleSmall),
          ],
        ),
      ),
    );
  }
}

class _InlineInfoCallout extends StatelessWidget {
  const _InlineInfoCallout({
    required this.icon,
    required this.title,
    required this.detail,
  });

  final IconData icon;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: colorScheme.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 4),
                  Text(detail, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SmallStatusPill extends StatelessWidget {
  const _SmallStatusPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Text(label, style: Theme.of(context).textTheme.labelSmall),
      ),
    );
  }
}

class _GptEnhancementPanel extends StatelessWidget {
  const _GptEnhancementPanel({
    required this.future,
    required this.isLoading,
    required this.hasResult,
    required this.onRun,
  });

  final Future<MobileAiGptEnhancement?>? future;
  final bool isLoading;
  final bool hasResult;
  final VoidCallback onRun;

  @override
  Widget build(BuildContext context) {
    final future = this.future;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.auto_awesome, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("GPT 增强解读",
                          style: Theme.of(context).textTheme.titleSmall),
                      const SizedBox(height: 4),
                      Text(
                        "可选调用外部 GPT，把上方智能快扫改写成更自然的解释。GPT 只负责解释，不改变快扫结论、护栏或行动优先级。",
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: isLoading ? null : onRun,
                  child: Text(hasResult ? "重新增强" : "增强"),
                ),
              ],
            ),
            if (isLoading) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(),
            ] else if (future != null) ...[
              const SizedBox(height: 12),
              FutureBuilder<MobileAiGptEnhancement?>(
                future: future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const LinearProgressIndicator();
                  }
                  if (snapshot.hasError) {
                    return Text(
                      "${_friendlyGptEnhancementErrorMessage(snapshot.error)}\n上方智能快扫结果仍可继续参考。",
                      style:
                          TextStyle(color: Theme.of(context).colorScheme.error),
                    );
                  }
                  final data = snapshot.data;
                  if (data == null) {
                    return const Text("暂时没有 GPT 增强解读。");
                  }
                  return _GptEnhancementView(data);
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

String _friendlyGptEnhancementErrorMessage(Object? error) {
  final raw = error?.toString().trim() ?? "";
  final normalized = raw.toLowerCase();
  if (raw.isEmpty) {
    return "GPT 增强暂时不可用，请稍后重试。";
  }
  if (normalized.contains("api key") ||
      normalized.contains("unauthorized") ||
      normalized.contains("401")) {
    return "GPT 增强暂时不可用：请检查设置里的外部 GPT 开关和 API Key。";
  }
  if (normalized.contains("timeout") ||
      normalized.contains("timed out") ||
      normalized.contains("502") ||
      normalized.contains("503") ||
      normalized.contains("504")) {
    return "GPT 增强暂时不可用：外部模型响应较慢或服务不稳定，请稍后重试。";
  }
  if (normalized.contains("schema") ||
      normalized.contains("zod") ||
      normalized.contains("too_big") ||
      normalized.contains("expected") ||
      normalized.contains("json") ||
      normalized.contains("格式")) {
    return "GPT 增强暂时不可用：外部模型返回内容需要重新整理，请稍后重试。";
  }
  return "GPT 增强暂时不可用，请稍后重试。";
}

String _friendlyAnalysisErrorMessage(Object? error) {
  final raw = error?.toString().trim() ?? "";
  final normalized = raw.toLowerCase();
  if (raw.isEmpty) {
    return "智能快扫暂时没有生成成功，请重试。";
  }
  if (normalized.contains("401") || normalized.contains("unauthorized")) {
    return "登录状态已过期，请重新登录后再试。";
  }
  if (normalized.contains("timeout") ||
      normalized.contains("timed out") ||
      normalized.contains("502") ||
      normalized.contains("503") ||
      normalized.contains("504")) {
    return "智能快扫暂时繁忙，请稍后重试。";
  }
  if (normalized.contains("格式") ||
      normalized.contains("schema") ||
      normalized.contains("zod") ||
      normalized.contains("json") ||
      normalized.contains("exception")) {
    return "智能快扫暂时没有整理出可展示结果，请重试。";
  }
  return raw
      .replaceFirst(RegExp(r"^LooApiException:\s*"), "")
      .replaceFirst(RegExp(r"^Exception:\s*"), "")
      .replaceAll(RegExp(r"sk-[A-Za-z0-9_-]+"), "sk-****");
}

class _GptEnhancementView extends StatelessWidget {
  const _GptEnhancementView(this.data);

  final MobileAiGptEnhancement data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _MetaPill(data.sourceLabel),
        const SizedBox(height: 8),
        Text(data.title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        Text(data.directAnswer),
        if (data.reasoning.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text("判断依据", style: Theme.of(context).textTheme.titleSmall),
          ...data.reasoning.take(4).map(_bullet),
        ],
        if (data.decisionGates.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text("需要确认", style: Theme.of(context).textTheme.titleSmall),
          ...data.decisionGates.take(4).map(_bullet),
        ],
        if (data.boundary != null) ...[
          const SizedBox(height: 10),
          Text("边界：${data.boundary}",
              style: Theme.of(context).textTheme.bodySmall),
        ],
        if (data.nextStep != null) ...[
          const SizedBox(height: 8),
          Text("建议：${data.nextStep}"),
        ],
        const SizedBox(height: 8),
        Text(
          data.authorityBoundary,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 10),
        Text(data.disclaimerZh, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _AnalysisScopeLabels {
  const _AnalysisScopeLabels({
    required this.summary,
    required this.actions,
    required this.fit,
  });

  final String summary;
  final String actions;
  final String fit;

  static _AnalysisScopeLabels forScope(String scope) {
    return switch (scope) {
      "security" => const _AnalysisScopeLabels(
          summary: "投资判断",
          actions: "确认事项",
          fit: "组合适配",
        ),
      "portfolio" => const _AnalysisScopeLabels(
          summary: "组合诊断",
          actions: "优先处理",
          fit: "配置解读",
        ),
      "account" => const _AnalysisScopeLabels(
          summary: "账户诊断",
          actions: "账户动作",
          fit: "账户角色",
        ),
      "recommendation-run" => const _AnalysisScopeLabels(
          summary: "推荐诊断",
          actions: "推荐确认",
          fit: "推荐依据",
        ),
      _ => const _AnalysisScopeLabels(
          summary: "分析结论",
          actions: "确认事项",
          fit: "适配说明",
        ),
    };
  }
}

class _AnalysisSection extends StatelessWidget {
  const _AnalysisSection({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _DataEvidenceView extends StatelessWidget {
  const _DataEvidenceView(this.data);

  final MobileAiAnalysisResult data;

  @override
  Widget build(BuildContext context) {
    final freshnessLines = [
      if (data.freshnessLabel != null) data.freshnessLabel!,
      if (data.reliabilityScore != null)
        "可信度 ${data.reliabilityScore!.round()}",
      if (data.quotesAsOf != null) "行情截至 ${data.quotesAsOf!.substring(0, 10)}",
      if (data.quoteSourceSummary != null) data.quoteSourceSummary!,
      if (data.quoteFreshnessSummary != null) data.quoteFreshnessSummary!,
      if (data.limitationSummary != null) data.limitationSummary!,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (freshnessLines.isNotEmpty)
          Text(
            freshnessLines.join(" · "),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        if (data.evidenceTrail.isNotEmpty) ...[
          const SizedBox(height: 10),
          ...data.evidenceTrail.take(4).map(_EvidenceRow.new),
        ],
        if (data.scorecards.isNotEmpty) ...[
          const SizedBox(height: 10),
          ...data.scorecards.take(4).map(_ScorecardRow.new),
        ],
      ],
    );
  }
}

class _EvidenceRow extends StatelessWidget {
  const _EvidenceRow(this.item);

  final MobileAiEvidenceItem item;

  @override
  Widget build(BuildContext context) {
    final meta = [
      _sourceModeLabel(item.sourceMode),
      _confidenceLabel(item.confidence),
      _freshnessStatusLabel(item.freshness),
      if (item.asOf != null && item.asOf!.length >= 10)
        item.asOf!.substring(0, 10),
    ].join(" · ");
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.label, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 3),
          Text(meta, style: Theme.of(context).textTheme.bodySmall),
          if (item.detail.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(item.detail),
          ],
        ],
      ),
    );
  }
}

class _ScorecardRow extends StatelessWidget {
  const _ScorecardRow(this.item);

  final MobileAiScorecard item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(item.label)),
              Text("${item.score.round()} 分",
                  style: Theme.of(context).textTheme.titleSmall),
            ],
          ),
          const SizedBox(height: 6),
          LinearProgressIndicator(value: item.score / 100),
          if (item.rationale.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(item.rationale, style: Theme.of(context).textTheme.bodySmall),
          ],
        ],
      ),
    );
  }
}

class _PrimaryActionCard extends StatelessWidget {
  const _PrimaryActionCard(this.action);

  final MobileAiPrimaryAction action;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.flag_circle,
                color: Theme.of(context).colorScheme.onPrimaryContainer),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    action.label,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color:
                              Theme.of(context).colorScheme.onPrimaryContainer,
                        ),
                  ),
                  if (action.detail.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      action.detail,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onPrimaryContainer,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RiskRow extends StatelessWidget {
  const _RiskRow(this.risk);

  final MobileAiRisk risk;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SeverityDot(risk.severity),
          const SizedBox(width: 8),
          Expanded(
            child: Text([
              risk.title,
              if (risk.detail.isNotEmpty) risk.detail,
            ].join("：")),
          ),
        ],
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow(this.action);

  final MobileAiActionItem action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Text(
        "• ${action.title}${action.detail.isEmpty ? "" : "：${action.detail}"}",
      ),
    );
  }
}

class _SeverityDot extends StatelessWidget {
  const _SeverityDot(this.severity);

  final String severity;

  @override
  Widget build(BuildContext context) {
    final color = switch (severity) {
      "high" => Theme.of(context).colorScheme.error,
      "medium" => Theme.of(context).colorScheme.tertiary,
      _ => Theme.of(context).colorScheme.primary,
    };
    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Icon(Icons.circle, size: 10, color: color),
    );
  }
}

List<String> _dedupeStrings(List<String> values) {
  final result = <String>[];
  for (final value in values) {
    final normalized = _normalizeForDedupe(value);
    if (normalized.isEmpty) continue;
    final isRepeated = result.any((existing) {
      final existingNormalized = _normalizeForDedupe(existing);
      return existingNormalized == normalized ||
          existingNormalized.contains(normalized) ||
          normalized.contains(existingNormalized);
    });
    if (!isRepeated) result.add(value);
  }
  return result;
}

List<MobileAiActionItem> _dedupeActionItems(List<MobileAiActionItem> values) {
  final result = <MobileAiActionItem>[];
  for (final value in values) {
    final normalized = _normalizeForDedupe("${value.title} ${value.detail}");
    if (normalized.isEmpty) continue;
    final isRepeated = result.any((existing) {
      final existingNormalized =
          _normalizeForDedupe("${existing.title} ${existing.detail}");
      return existingNormalized == normalized ||
          existingNormalized.contains(normalized) ||
          normalized.contains(existingNormalized);
    });
    if (!isRepeated) result.add(value);
  }
  return result;
}

String _normalizeForDedupe(String value) {
  return value
      .replaceAll(RegExp(r"\s+"), "")
      .replaceAll("。", "")
      .replaceAll("；", "")
      .replaceAll("，", "")
      .trim();
}

class _MetaPill extends StatelessWidget {
  const _MetaPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: Text(label, style: Theme.of(context).textTheme.bodySmall),
      ),
    );
  }
}

class _AnalysisError extends StatelessWidget {
  const _AnalysisError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(message,
            style: TextStyle(color: Theme.of(context).colorScheme.error)),
        const SizedBox(height: 8),
        OutlinedButton(onPressed: onRetry, child: const Text("重试")),
      ],
    );
  }
}

Widget _bullet(String item) {
  return Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Text("• $item"),
  );
}

Map<String, dynamic> _readMap(Object? value) {
  return value is Map<String, dynamic> ? value : const <String, dynamic>{};
}

List<Map<String, dynamic>> _readMapList(Object? value) {
  return (value as List?)?.whereType<Map<String, dynamic>>().toList() ??
      const [];
}

List<String> _readStringList(Object? value) {
  return (value as List?)?.whereType<String>().toList() ?? const [];
}

String _confidenceLabel(String value) {
  return switch (value) {
    "high" => "高",
    "low" => "低",
    _ => "中",
  };
}

String _freshnessStatusLabel(String value) {
  return switch (value) {
    "fresh" => "较新",
    "stale" => "可能过期",
    "missing" => "缺失",
    _ => "部分可用",
  };
}

String _sourceModeLabel(String value) {
  return switch (value) {
    "live-external" => "外部资料",
    "cached-external" => "已保存资料",
    "derived" => "规则派生",
    _ => "基础快扫",
  };
}

String _assetTypeLabel(String value) {
  return switch (value) {
    "stock" => "股票",
    "etf" => "ETF",
    "fund" => "基金",
    "cash" => "现金",
    _ => "其他资产",
  };
}

String _valuationMethodLabel(String value) {
  return switch (value) {
    "multiples_evidence" => "倍数证据",
    "analyst_consensus" => "分析师共识",
    "dcf_reference" => "DCF 参考",
    "etf_macro_proxy" => "ETF 宏观代理",
    _ => "估值资料不足",
  };
}

String _entryPostureLabel(String value) {
  return switch (value) {
    "consider_now" => "可继续确认",
    "wait_for_pullback" => "等待回撤",
    "wait_for_confirmation" => "等待确认",
    _ => "暂不适用",
  };
}

String _actionStatusLabel(String value) {
  return switch (value) {
    "ready" => "可执行前确认",
    "blocked" => "被护栏阻断",
    "needs_data" => "需补资料",
    _ => "等待",
  };
}

String _sanityStatusLabel(String value) {
  return switch (value) {
    "pass" => "通过",
    "watch" => "观察",
    "fail" => "不通过",
    _ => "缺资料",
  };
}

String _researchSourceTypeLabel(String value) {
  return switch (value) {
    "quote" => "行情",
    "history" => "历史价格",
    "fundamental" => "基本面",
    "macro" => "宏观",
    "preference" => "偏好",
    "external_research" => "外部资料",
    _ => "组合资料",
  };
}

String _guardrailSeverityToRisk(String value) {
  return switch (value) {
    "blocker" => "high",
    "warning" => "medium",
    _ => "info",
  };
}
