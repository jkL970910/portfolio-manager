import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../shared/data/mobile_models.dart";

class RecommendationsPage extends StatefulWidget {
  const RecommendationsPage({
    required this.apiClient,
    super.key,
  });

  final LooApiClient apiClient;

  @override
  State<RecommendationsPage> createState() => _RecommendationsPageState();
}

class _RecommendationsPageState extends State<RecommendationsPage> {
  late Future<MobileRecommendationsSnapshot> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  Future<MobileRecommendationsSnapshot> _loadSnapshot() async {
    final response = await widget.apiClient.getRecommendations();
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("推荐数据格式不正确。");
    }

    return MobileRecommendationsSnapshot.fromJson(data);
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MobileRecommendationsSnapshot>(
      future: _snapshot,
      builder: (context, snapshot) {
        return RefreshIndicator(
          onRefresh: () async => _refresh(),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: _PageHeader(
                  title: "Loo皇谕令",
                  subtitle: snapshot.hasData
                      ? snapshot.data!.engineLine
                      : "正在读取 Loo国投资军令...",
                ),
              ),
              if (snapshot.connectionState == ConnectionState.waiting)
                const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()))
              else if (snapshot.hasError)
                SliverFillRemaining(
                  child: _ErrorState(
                      message: snapshot.error.toString(), onRetry: _refresh),
                )
              else if (snapshot.hasData)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
                  sliver: SliverList.list(
                    children: [
                      _SummaryCard(snapshot.data!),
                      if (snapshot.data!.explainer.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        const _SectionTitle("策略说明"),
                        const SizedBox(height: 8),
                        _TextCard(snapshot.data!.explainer.take(4).join("\n")),
                      ],
                      const SizedBox(height: 16),
                      _SectionTitle("优先事项",
                          actionLabel: "${snapshot.data!.priorities.length} 条"),
                      const SizedBox(height: 8),
                      if (snapshot.data!.priorities.isEmpty)
                        const _EmptyCard("暂时没有新的推荐。先完成持仓导入，Loo皇会再下达谕令。")
                      else
                        ...snapshot.data!.priorities
                            .take(6)
                            .map(_PriorityCard.new),
                      if (snapshot.data!.scenarios.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        const _SectionTitle("情景比较"),
                        const SizedBox(height: 8),
                        ...snapshot.data!.scenarios
                            .take(3)
                            .map(_ScenarioCard.new),
                      ],
                      if (snapshot.data!.notes.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        const _SectionTitle("备注"),
                        const SizedBox(height: 8),
                        _TextCard(snapshot.data!.notes.take(4).join("\n")),
                      ],
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class MobileRecommendationsSnapshot {
  const MobileRecommendationsSnapshot({
    required this.contributionAmount,
    required this.engineLine,
    required this.inputs,
    required this.explainer,
    required this.priorities,
    required this.scenarios,
    required this.notes,
  });

  final String contributionAmount;
  final String engineLine;
  final List<MobileRecommendationInput> inputs;
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
      constraints: readJsonList(json, "constraints")
          .map(MobileRecommendationConstraint.fromJson)
          .toList(),
      execution: readJsonList(json, "execution")
          .map(MobileRecommendationInput.fromJson)
          .toList(),
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

class _PageHeader extends StatelessWidget {
  const _PageHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard(this.data);

  final MobileRecommendationsSnapshot data;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Theme.of(context).colorScheme.primaryContainer,
              Theme.of(context).colorScheme.surface,
            ],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("本轮可部署资金", style: Theme.of(context).textTheme.bodyLarge),
              const SizedBox(height: 8),
              Text(data.contributionAmount,
                  style: Theme.of(context).textTheme.displaySmall),
              if (data.inputs.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: data.inputs
                      .take(4)
                      .map((input) =>
                          _InfoPill("${input.label}: ${input.value}"))
                      .toList(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title, {this.actionLabel});

  final String title;
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        if (actionLabel != null)
          Text(actionLabel!, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class _PriorityCard extends StatelessWidget {
  const _PriorityCard(this.priority);

  final MobileRecommendationPriority priority;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(priority.assetClass,
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(priority.description),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoPill(priority.amount),
                if (priority.account.isNotEmpty) _InfoPill(priority.account),
                if (priority.security.isNotEmpty) _InfoPill(priority.security),
              ],
            ),
            if (priority.scoreline.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(priority.scoreline,
                  style: Theme.of(context).textTheme.titleMedium),
            ],
            if (priority.gapSummary.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(priority.gapSummary),
            ],
            ...priority.whyThis.take(2).map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text("• $item"),
                  ),
                ),
            if (priority.constraints.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: priority.constraints
                    .take(3)
                    .map(_ConstraintPill.new)
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ScenarioCard extends StatelessWidget {
  const _ScenarioCard(this.scenario);

  final MobileRecommendationScenario scenario;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        title: Text("${scenario.label} · ${scenario.amount}"),
        subtitle: Text([
          scenario.summary,
          ...scenario.diffs.take(2),
        ].where((item) => item.isNotEmpty).join("\n")),
      ),
    );
  }
}

class _TextCard extends StatelessWidget {
  const _TextCard(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(text),
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(message),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(label, style: Theme.of(context).textTheme.labelMedium),
      ),
    );
  }
}

class _ConstraintPill extends StatelessWidget {
  const _ConstraintPill(this.constraint);

  final MobileRecommendationConstraint constraint;

  @override
  Widget build(BuildContext context) {
    final color = switch (constraint.variant) {
      "success" => Colors.green.shade700,
      "warning" => Colors.orange.shade800,
      _ => Theme.of(context).colorScheme.onSurfaceVariant,
    };

    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(constraint.label,
            style: Theme.of(context)
                .textTheme
                .labelMedium
                ?.copyWith(color: color)),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text("Loo皇谕令暂时打不开", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text("重新读取")),
        ],
      ),
    );
  }
}
