import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../data/mobile_recommendation_models.dart";
import "../../discover/presentation/discover_page.dart";

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
  var _working = false;

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

  Future<void> _createRun() async {
    final amountController = TextEditingController(text: "2500");
    final amount = await showDialog<double>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("重新生成推荐"),
        content: TextField(
          controller: amountController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: "本次可投资金额 CAD"),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text("取消"),
          ),
          FilledButton(
            onPressed: () {
              final parsed = double.tryParse(amountController.text.trim());
              Navigator.of(context).pop(parsed);
            },
            child: const Text("生成"),
          ),
        ],
      ),
    );
    amountController.dispose();
    if (amount == null || amount <= 0 || _working) {
      return;
    }

    setState(() => _working = true);
    try {
      await widget.apiClient.createRecommendationRun(amount);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("新推荐已生成。")),
        );
        setState(() {
          _working = false;
          _snapshot = _loadSnapshot();
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => _working = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }

  Future<void> _addWatchlistSymbol(String symbol) async {
    final normalized = symbol.trim().toUpperCase();
    if (normalized.isEmpty || _working) {
      return;
    }
    setState(() => _working = true);
    try {
      await widget.apiClient.addWatchlistSymbol(normalized);
      if (mounted) {
        setState(() {
          _working = false;
          _snapshot = _loadSnapshot();
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => _working = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }

  Future<void> _removeWatchlistSymbol(String symbol) async {
    if (_working) {
      return;
    }
    setState(() => _working = true);
    try {
      await widget.apiClient.removeWatchlistSymbol(symbol);
      if (mounted) {
        setState(() {
          _working = false;
          _snapshot = _loadSnapshot();
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => _working = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
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
                      const SizedBox(height: 16),
                      _IntelligenceBriefsCard(
                        items: snapshot.data!.intelligenceBriefs,
                      ),
                      const SizedBox(height: 16),
                      _DiscoverEntryCard(onOpen: _openDiscover),
                      const SizedBox(height: 16),
                      _GenerateRecommendationCard(
                        working: _working,
                        onGenerate: _createRun,
                      ),
                      const SizedBox(height: 16),
                      _PreferenceContextCard(snapshot.data!.preferenceContext),
                      const SizedBox(height: 16),
                      _WatchlistCard(
                        symbols:
                            snapshot.data!.preferenceContext.watchlistSymbols,
                        working: _working,
                        onAdd: _addWatchlistSymbol,
                        onRemove: _removeWatchlistSymbol,
                      ),
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

  void _openDiscover() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => DiscoverPage(apiClient: widget.apiClient),
      ),
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

class _GenerateRecommendationCard extends StatelessWidget {
  const _GenerateRecommendationCard({
    required this.working,
    required this.onGenerate,
  });

  final bool working;
  final VoidCallback onGenerate;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.auto_awesome),
        title: const Text("重新生成推荐"),
        subtitle: const Text("使用当前投资偏好和持仓，输入本次可投资金额后生成新谕令。"),
        trailing: working
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.chevron_right),
        onTap: working ? null : onGenerate,
      ),
    );
  }
}

class _DiscoverEntryCard extends StatelessWidget {
  const _DiscoverEntryCard({required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.travel_explore_outlined),
        title: const Text("搜索标的"),
        subtitle: const Text("按代码或名称查找股票、ETF、CDR，再加入观察或打开标的详情。"),
        trailing: const Icon(Icons.chevron_right),
        onTap: onOpen,
      ),
    );
  }
}

class _IntelligenceBriefsCard extends StatelessWidget {
  const _IntelligenceBriefsCard({required this.items});

  final List<MobileIntelligenceBrief> items;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.newspaper_outlined),
                const SizedBox(width: 8),
                Expanded(
                  child: Text("Loo国今日秘闻", style: theme.textTheme.titleLarge),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text("这里只展示已缓存的 AI/行情研究，不会在页面加载时实时抓新闻或论坛。"),
            const SizedBox(height: 12),
            if (items.isEmpty)
              const Text("暂时没有可用秘闻。先在标的详情运行 AI 快扫，或手动触发缓存外部研究。")
            else
              ...items.take(3).map(_IntelligenceBriefTile.new),
          ],
        ),
      ),
    );
  }
}

class _IntelligenceBriefTile extends StatelessWidget {
  const _IntelligenceBriefTile(this.item);

  final MobileIntelligenceBrief item;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color:
              theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.42),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.title, style: theme.textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(item.detail),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _InfoPill(item.sourceLabel),
                  _InfoPill(item.freshnessLabel),
                  if (item.symbols.isNotEmpty)
                    _InfoPill(item.symbols.join(" · ")),
                ],
              ),
              if (item.sources.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  "来源：${item.sources.take(2).map((source) => source.value).join("；")}",
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _PreferenceContextCard extends StatelessWidget {
  const _PreferenceContextCard(this.context);

  final MobilePreferenceContext context;

  @override
  Widget build(BuildContext context_) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("当前推荐规则", style: Theme.of(context_).textTheme.titleLarge),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoPill("风险：${context.riskLabel}"),
                _InfoPill("账户：${context.accountFundingPriority.join(" -> ")}"),
                _InfoPill("策略：${context.recommendationStrategy}"),
                _InfoPill("再平衡：${context.rebalancingTolerancePct}%"),
                _InfoPill(context.taxAwarePlacement ? "税务感知：开" : "税务感知：关"),
              ],
            ),
            if (context.allocationLine.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(context.allocationLine),
            ],
          ],
        ),
      ),
    );
  }
}

class _WatchlistCard extends StatefulWidget {
  const _WatchlistCard({
    required this.symbols,
    required this.working,
    required this.onAdd,
    required this.onRemove,
  });

  final List<String> symbols;
  final bool working;
  final ValueChanged<String> onAdd;
  final ValueChanged<String> onRemove;

  @override
  State<_WatchlistCard> createState() => _WatchlistCardState();
}

class _WatchlistCardState extends State<_WatchlistCard> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final symbol = _controller.text.trim().toUpperCase();
    if (symbol.isEmpty) {
      return;
    }
    widget.onAdd(symbol);
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("观察标的", style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            const Text("这里的标的会影响候选评分和后续推荐解释。"),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    enabled: !widget.working,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(labelText: "代码，例如 VFV"),
                    onSubmitted: (_) => _submit(),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: widget.working ? null : _submit,
                  child: const Text("加入"),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (widget.symbols.isEmpty)
              const Text("暂时没有观察标的。")
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: widget.symbols
                    .map(
                      (symbol) => InputChip(
                        label: Text(symbol),
                        onDeleted: widget.working
                            ? null
                            : () => widget.onRemove(symbol),
                      ),
                    )
                    .toList(),
              ),
          ],
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
              _ScorelinePanel(priority),
            ],
            if (priority.intelligenceRefs.isNotEmpty) ...[
              const SizedBox(height: 12),
              _PriorityIntelligenceSection(priority.intelligenceRefs),
            ],
            if (priority.whyThis.isNotEmpty) ...[
              const SizedBox(height: 12),
              _ExplanationSection(
                title: "为什么它排前面",
                items: priority.whyThis,
              ),
            ],
            if (priority.whyNot.isNotEmpty) ...[
              const SizedBox(height: 12),
              _ExplanationSection(
                title: "需要注意什么",
                items: priority.whyNot,
              ),
            ],
            if (priority.constraints.isNotEmpty) ...[
              const SizedBox(height: 12),
              _ConstraintSection(priority.constraints),
            ],
            if (priority.execution.isNotEmpty) ...[
              const SizedBox(height: 12),
              _ExecutionSection(priority.execution),
            ],
            if (priority.alternatives.isNotEmpty) ...[
              const SizedBox(height: 12),
              _ExplanationSection(
                title: "可替代选择",
                items: priority.alternatives,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PriorityIntelligenceSection extends StatelessWidget {
  const _PriorityIntelligenceSection(this.items);

  final List<MobileRecommendationIntelligenceRef> items;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.tertiaryContainer.withValues(alpha: 0.32),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("相关秘闻", style: theme.textTheme.titleMedium),
            const SizedBox(height: 6),
            const Text("这些只是缓存情报引用，用来解释背景；底层资产情报可跨 CAD/USD 版本参考，具体价格和刷新状态仍以当前 listing 为准。"),
            ...items.take(2).map((item) {
              return Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.title, style: theme.textTheme.titleSmall),
                    const SizedBox(height: 4),
                    Text(item.detail),
                    const SizedBox(height: 4),
                    Text(
                      [
                        item.sourceLabel,
                        item.scopeLabel,
                        item.freshnessLabel,
                        item.listingLabel,
                      ].where((part) => part.isNotEmpty).join(" · "),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _ScorelinePanel extends StatelessWidget {
  const _ScorelinePanel(this.priority);

  final MobileRecommendationPriority priority;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer.withValues(alpha: 0.52),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("评分结论", style: theme.textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(priority.scoreline),
            if (priority.gapSummary.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(priority.gapSummary),
            ],
          ],
        ),
      ),
    );
  }
}

class _ExplanationSection extends StatelessWidget {
  const _ExplanationSection({required this.title, required this.items});

  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        ...items.take(4).map(
              (item) => Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Text("• $item"),
              ),
            ),
      ],
    );
  }
}

class _ConstraintSection extends StatelessWidget {
  const _ConstraintSection(this.constraints);

  final List<MobileRecommendationConstraint> constraints;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("约束检查", style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ...constraints.take(4).map(_ConstraintDetailTile.new),
      ],
    );
  }
}

class _ConstraintDetailTile extends StatelessWidget {
  const _ConstraintDetailTile(this.constraint);

  final MobileRecommendationConstraint constraint;

  @override
  Widget build(BuildContext context) {
    final color = _constraintColor(context, constraint.variant);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.34)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(constraint.label,
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(color: color)),
              if (constraint.detail.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(constraint.detail),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ExecutionSection extends StatelessWidget {
  const _ExecutionSection(this.items);

  final List<MobileRecommendationInput> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("执行拆解", style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ...items.take(5).map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Expanded(child: Text(item.label)),
                    Text(item.value,
                        style: Theme.of(context).textTheme.titleSmall),
                  ],
                ),
              ),
            ),
      ],
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

Color _constraintColor(BuildContext context, String variant) {
  return switch (variant) {
    "success" => Colors.green.shade700,
    "warning" => Colors.orange.shade800,
    _ => Theme.of(context).colorScheme.onSurfaceVariant,
  };
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
