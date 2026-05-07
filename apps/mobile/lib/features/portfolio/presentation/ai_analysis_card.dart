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
    this.description = "基于本地规则、当前组合、投资偏好和缓存资料生成；不会默认调用外部 GPT。",
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
  Future<MobileAiGptEnhancement>? _gptEnhancement;
  ValueListenable<LooMinisterSuggestedAction?>? _ministerActionListenable;
  bool _hasResult = false;
  bool _isLoading = false;
  bool _isEnhancing = false;

  @override
  void initState() {
    super.initState();
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
    if (widget.autoRun && oldWidget.payload != widget.payload && !_isLoading) {
      _runAnalysis(refresh: false);
      return;
    }
    if (
      widget.refreshKey != null &&
      oldWidget.refreshKey != widget.refreshKey &&
      _hasResult &&
      !_isLoading
    ) {
      _runAnalysis(refresh: true);
    }
  }

  void _runAnalysis({bool refresh = false}) {
    setState(() {
      _isLoading = true;
      _gptEnhancement = null;
      _analysis = _loadAnalysis(refresh: refresh);
    });
  }

  void _runGptEnhancement() {
    if (_isEnhancing || !_hasResult) return;
    setState(() {
      _isEnhancing = true;
      _gptEnhancement = _loadGptEnhancement();
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

  Future<MobileAiGptEnhancement> _loadGptEnhancement() async {
    try {
      final response = await widget.apiClient.createAnalyzerGptEnhancement({
        ...widget.payload,
        "forceFreshBaseAnalysis": false,
      });
      final data = response["data"];
      if (data is! Map<String, dynamic>) {
        throw const LooApiException("GPT 增强解读格式不正确。");
      }
      final enhancement = data["enhancement"];
      if (enhancement is! Map<String, dynamic>) {
        throw const LooApiException("GPT 增强解读为空。");
      }
      final result = MobileAiGptEnhancement.fromJson(enhancement);
      if (mounted) {
        setState(() {
          _isEnhancing = false;
        });
      }
      return result;
    } on Object {
      if (mounted) {
        setState(() {
          _isEnhancing = false;
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
                    if (_hasResult) ...[
                      const SizedBox(height: 6),
                      Text(
                        "跳过缓存",
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
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
                      message: snapshot.error.toString(),
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

class MobileAiAnalysisResult {
  const MobileAiAnalysisResult({
    required this.scope,
    required this.title,
    required this.thesis,
    required this.confidence,
    required this.securityDecision,
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
      scorecards: _readMapList(json["scorecards"])
          .map(MobileAiScorecard.fromJson)
          .toList(),
      risks: _readMapList(json["risks"]).map(MobileAiRisk.fromJson).toList(),
      taxNotes: _readStringList(json["taxNotes"])
          .map(_friendlyAnalysisText)
          .toList(),
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
      confidenceScore:
          confidenceScore is num ? confidenceScore.toDouble().clamp(0, 100) : null,
      directAnswer:
          _friendlyAnalysisText(json["directAnswer"] as String? ?? ""),
      primaryAction: json["primaryAction"] is Map<String, dynamic>
          ? MobileAiPrimaryAction.fromJson(
              json["primaryAction"] as Map<String, dynamic>)
          : null,
      whyNow: _readStringList(json["whyNow"]).map(_friendlyAnalysisText).toList(),
      portfolioFit:
          _readStringList(json["portfolioFit"]).map(_friendlyAnalysisText).toList(),
      keyBlockers:
          _readStringList(json["keyBlockers"]).map(_friendlyAnalysisText).toList(),
      decisionGates: _readStringList(json["decisionGates"])
          .map(_friendlyAnalysisText)
          .toList(),
      nextSteps:
          _readStringList(json["nextSteps"]).map(_friendlyAnalysisText).toList(),
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
      directAnswer: _friendlyAnalysisText(json["directAnswer"] as String? ?? ""),
      reasoning:
          _readStringList(json["reasoning"]).map(_friendlyAnalysisText).toList(),
      decisionGates: _readStringList(json["decisionGates"])
          .map(_friendlyAnalysisText)
          .toList(),
      boundary: _friendlyNullableText(json["boundary"] as String?),
      nextStep: _friendlyNullableText(json["nextStep"] as String?),
      sourceLabel: json["sourceLabel"] as String? ?? "GPT 增强解读",
      authorityBoundary: _friendlyAnalysisText(
        json["authorityBoundary"] as String? ??
            "GPT 只增强解释，不改变智能快扫结论、护栏或行动优先级。",
      ),
      disclaimerZh:
          disclaimer["zh"] as String? ?? "仅用于研究学习，不构成投资建议。",
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
      .replaceAll("Local recommendation run", "本地推荐运行记录");
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
              _MetaPill(
                  [
                    if (securityDecision?.decisionLabel != null)
                      securityDecision!.decisionLabel!,
                    if (securityDecision != null)
                      _verdictLabel(securityDecision.verdict),
                    if (securityDecision?.confidenceScore != null)
                      "决策置信 ${securityDecision!.confidenceScore!.round()}",
                    "置信度 ${_confidenceLabel(data.confidence)}",
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
        if (securityDecision != null && securityDecision.whyNow.isNotEmpty)
          _AnalysisSection(
            title: "为什么现在看",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: securityDecision.whyNow.take(4).map(_bullet).toList(),
            ),
          ),
        if (securityDecision != null && securityDecision.keyBlockers.isNotEmpty)
          _AnalysisSection(
            title: "主要护栏",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children:
                  securityDecision.keyBlockers.take(4).map(_bullet).toList(),
            ),
          ),
        if (securityDecision != null &&
            securityDecision.decisionGates.isNotEmpty)
          _AnalysisSection(
            title: "判断前提",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children:
                  securityDecision.decisionGates.take(4).map(_bullet).toList(),
            ),
          ),
        if (securityDecision?.positionSizingIdea != null)
          _AnalysisSection(
            title: "仓位思路",
            child: Text(securityDecision!.positionSizingIdea!),
          ),
        if (visibleActionItems.isNotEmpty)
          _AnalysisSection(
            title: labels.actions,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: visibleActionItems.take(4).map(_ActionRow.new).toList(),
            ),
          ),
        if (data.risks.isNotEmpty)
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
        if (visibleFit.isNotEmpty)
          _AnalysisSection(
            title: labels.fit,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: visibleFit.take(4).map(_bullet).toList(),
            ),
          ),
        if (securityDecision != null &&
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
        if (securityDecision != null && securityDecision.nextSteps.isNotEmpty)
          _AnalysisSection(
            title: "下一步",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: securityDecision.nextSteps.take(4).map(_bullet).toList(),
            ),
          ),
        if (securityDecision?.boundary != null)
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
            title: Text("数据依据",
                style: Theme.of(context).textTheme.titleSmall),
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
            title:
                Text("来源详情", style: Theme.of(context).textTheme.titleSmall),
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

class _GptEnhancementPanel extends StatelessWidget {
  const _GptEnhancementPanel({
    required this.future,
    required this.isLoading,
    required this.onRun,
  });

  final Future<MobileAiGptEnhancement>? future;
  final bool isLoading;
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
                  child: Text(future == null ? "增强" : "重新增强"),
                ),
              ],
            ),
            if (isLoading) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(),
            ] else if (future != null) ...[
              const SizedBox(height: 12),
              FutureBuilder<MobileAiGptEnhancement>(
                future: future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const LinearProgressIndicator();
                  }
                  if (snapshot.hasError) {
                    return Text(
                      "GPT 增强暂时失败，请稍后重试；上方智能快扫结果仍可继续参考。",
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.error),
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
          Text("下一步：${data.nextStep}"),
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

String _verdictLabel(String value) {
  return switch (value) {
    "good-candidate" => "候选较强",
    "weak-fit" => "适配偏弱",
    "review-existing" => "复核持仓",
    "needs-more-data" => "需补数据",
    _ => "先观察",
  };
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
          actions: "买入前确认",
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
          actions: "下一步确认",
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
                    "${action.label} · ${action.priority}",
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
      child: Text("• ${action.title}：${action.detail}"),
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
    "live-external" => "实时外部研究",
    "cached-external" => "缓存外部研究",
    "derived" => "规则派生",
    _ => "本地快扫",
  };
}
