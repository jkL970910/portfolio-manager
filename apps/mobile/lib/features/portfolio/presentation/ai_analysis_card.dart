import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";

class AiAnalysisCard extends StatefulWidget {
  const AiAnalysisCard({
    required this.apiClient,
    required this.payload,
    this.title = "AI 分析",
    this.description = "基于当前组合、账户、偏好和本地报价缓存生成，不包含实时新闻或论坛情绪。",
    super.key,
  });

  final LooApiClient apiClient;
  final Map<String, dynamic> payload;
  final String title;
  final String description;

  @override
  State<AiAnalysisCard> createState() => _AiAnalysisCardState();
}

class _AiAnalysisCardState extends State<AiAnalysisCard> {
  Future<MobileAiAnalysisResult>? _analysis;

  void _runAnalysis() {
    setState(() {
      _analysis = _loadAnalysis();
    });
  }

  Future<MobileAiAnalysisResult> _loadAnalysis() async {
    final response = await widget.apiClient.createAnalyzerQuickScan(widget.payload);
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("AI 分析格式不正确。");
    }
    return MobileAiAnalysisResult.fromJson(data);
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
                FilledButton.icon(
                  onPressed: future == null ? _runAnalysis : null,
                  icon: const Icon(Icons.auto_awesome),
                  label: Text(future == null ? "生成" : "已生成"),
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
                      onRetry: _runAnalysis,
                    );
                  }

                  final data = snapshot.data;
                  if (data == null) {
                    return _AnalysisError(
                      message: "没有拿到 AI 分析结果。",
                      onRetry: _runAnalysis,
                    );
                  }

                  return _AnalysisResultView(data);
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class MobileAiAnalysisResult {
  const MobileAiAnalysisResult({
    required this.title,
    required this.thesis,
    required this.confidence,
    required this.scorecards,
    required this.risks,
    required this.taxNotes,
    required this.portfolioFit,
    required this.actionItems,
    required this.sources,
    required this.disclaimerZh,
    required this.sourceMode,
  });

  final String title;
  final String thesis;
  final String confidence;
  final List<MobileAiScorecard> scorecards;
  final List<MobileAiRisk> risks;
  final List<String> taxNotes;
  final List<String> portfolioFit;
  final List<MobileAiActionItem> actionItems;
  final List<String> sources;
  final String disclaimerZh;
  final String sourceMode;

  factory MobileAiAnalysisResult.fromJson(Map<String, dynamic> json) {
    final summary = _readMap(json["summary"]);
    final dataFreshness = _readMap(json["dataFreshness"]);
    final disclaimer = _readMap(json["disclaimer"]);
    return MobileAiAnalysisResult(
      title: summary["title"] as String? ?? "AI 快速分析",
      thesis: summary["thesis"] as String? ?? "",
      confidence: summary["confidence"] as String? ?? "medium",
      scorecards: _readMapList(json["scorecards"])
          .map(MobileAiScorecard.fromJson)
          .toList(),
      risks: _readMapList(json["risks"]).map(MobileAiRisk.fromJson).toList(),
      taxNotes: _readStringList(json["taxNotes"]),
      portfolioFit: _readStringList(json["portfolioFit"]),
      actionItems: _readMapList(json["actionItems"])
          .map(MobileAiActionItem.fromJson)
          .toList(),
      sources: _readMapList(json["sources"])
          .map((item) => item["title"] as String? ?? "")
          .where((item) => item.isNotEmpty)
          .toList(),
      disclaimerZh: disclaimer["zh"] as String? ?? "仅用于研究学习，不构成投资建议。",
      sourceMode: dataFreshness["sourceMode"] as String? ?? "local",
    );
  }
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
      rationale: json["rationale"] as String? ?? "",
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
      detail: json["detail"] as String? ?? "",
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
      title: json["title"] as String? ?? "下一步",
      detail: json["detail"] as String? ?? "",
    );
  }
}

class _AnalysisResultView extends StatelessWidget {
  const _AnalysisResultView(this.data);

  final MobileAiAnalysisResult data;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(data.title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        Text(data.thesis),
        const SizedBox(height: 8),
        _MetaPill("置信度 ${_confidenceLabel(data.confidence)} · ${_sourceModeLabel(data.sourceMode)}"),
        if (data.scorecards.isNotEmpty) ...[
          const SizedBox(height: 14),
          ...data.scorecards.take(4).map(_ScorecardRow.new),
        ],
        if (data.risks.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text("风险护栏", style: Theme.of(context).textTheme.titleSmall),
          ...data.risks.take(4).map(_RiskRow.new),
        ],
        if (data.taxNotes.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text("税务/账户提醒", style: Theme.of(context).textTheme.titleSmall),
          ...data.taxNotes.take(3).map(_bullet),
        ],
        if (data.portfolioFit.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text("组合适配", style: Theme.of(context).textTheme.titleSmall),
          ...data.portfolioFit.take(4).map(_bullet),
        ],
        if (data.actionItems.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text("下一步", style: Theme.of(context).textTheme.titleSmall),
          ...data.actionItems.take(4).map(_ActionRow.new),
        ],
        const SizedBox(height: 14),
        Text(data.disclaimerZh, style: Theme.of(context).textTheme.bodySmall),
        if (data.sources.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text("来源：${data.sources.take(3).join("、")}",
              style: Theme.of(context).textTheme.bodySmall),
        ],
      ],
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
      child: Text("${action.priority} · ${action.title}：${action.detail}"),
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
        Text(message, style: TextStyle(color: Theme.of(context).colorScheme.error)),
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

String _sourceModeLabel(String value) {
  return switch (value) {
    "live-external" => "实时外部研究",
    "cached-external" => "缓存外部研究",
    _ => "本地快扫",
  };
}
