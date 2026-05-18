import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../app/mobile_routes.dart";
import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../../discover/presentation/discover_page.dart";
import "../data/mobile_recommendation_models.dart";

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
  final _scrollController = ScrollController();
  final _watchlistKey = GlobalKey();
  final _priorityKey = GlobalKey();
  var _working = false;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToSection(GlobalKey key) {
    final context = key.currentContext;
    if (context == null) return;
    Scrollable.ensureVisible(
      context,
      duration: const Duration(milliseconds: 360),
      curve: Curves.easeOutCubic,
      alignment: 0.08,
    );
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

  Future<void> _createCustomRun() async {
    final amountController = TextEditingController(text: "2500");
    final amount = await showDialog<double>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("重算进货清单"),
        content: TextField(
          controller: amountController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: "本次可用银两 CAD"),
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
            child: const Text("重算"),
          ),
        ],
      ),
    );
    amountController.dispose();
    if (amount == null || amount <= 0 || _working) {
      return;
    }

    await _createRun(amount);
  }

  Future<void> _createRun(double amount) async {
    if (amount <= 0 || _working) {
      return;
    }

    setState(() => _working = true);
    try {
      await widget.apiClient.createRecommendationRun(amount);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("进货清单已重算。")),
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
        return LooPageGradient(
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: CustomScrollView(
              controller: _scrollController,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: _PageHeader(
                    title: "进货台",
                    subtitle: snapshot.hasData
                        ? "先搜货、再看护栏；Loo皇只给候选，不替你下单。"
                        : "正在清点今日可进货清单...",
                  ),
                ),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (snapshot.hasError)
                  SliverFillRemaining(
                    child: _ErrorState(
                      message: snapshot.error.toString(),
                      onRetry: _refresh,
                    ),
                  )
                else if (snapshot.hasData)
                  SliverPadding(
                    padding: looPagePadding(context),
                    sliver: SliverList.list(
                      children: [
                        _SummaryCard(
                          snapshot.data!,
                          working: _working,
                          onCustomAmount: _createCustomRun,
                          onRunAmount: _createRun,
                          onDiscover: _openDiscover,
                          onOpenSettings: () =>
                              context.push(MobileRoutes.settings),
                          onOpenPriorities: () =>
                              _scrollToSection(_priorityKey),
                          onOpenWatchlist: () =>
                              _scrollToSection(_watchlistKey),
                        ),
                        const SizedBox(height: 16),
                        if (snapshot
                            .data!.recentObservationItems.isNotEmpty) ...[
                          _RecentObservationCard(
                            items: snapshot.data!.recentObservationItems,
                            onOpen: _openMarketItem,
                          ),
                          const SizedBox(height: 16),
                        ],
                        KeyedSubtree(
                          key: _watchlistKey,
                          child: _WatchlistCard(
                            items: snapshot.data!.watchlistMarketItems,
                            working: _working,
                            onRemove: _removeWatchlistSymbol,
                            onOpen: _openMarketItem,
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (snapshot.data!.priorities.isEmpty)
                          const _EmptyCard("暂时没有新的推荐。先完成持仓导入，Loo皇会再下达谕令。")
                        else
                          KeyedSubtree(
                            key: _priorityKey,
                            child: _PriorityWorkbench(
                              priorities: snapshot.data!.priorities,
                              onOpenSecurity: _openSecurityDetail,
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
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

  void _openSecurityDetail(MobileRecommendationPriority priority) {
    if (priority.securitySymbol.isEmpty) {
      return;
    }

    context.push(
      MobileRoutes.securityDetail(
        symbol: priority.securitySymbol,
        securityId: priority.securityId.isNotEmpty ? priority.securityId : null,
        exchange: priority.securityExchange.isNotEmpty
            ? priority.securityExchange
            : null,
        currency: priority.securityCurrency.isNotEmpty
            ? priority.securityCurrency
            : null,
      ),
    );
  }

  void _openMarketItem(MobileRecommendationMarketItem item) {
    if (item.symbol.isEmpty) {
      return;
    }
    context.push(
      MobileRoutes.securityDetail(
        symbol: item.symbol,
        securityId: item.securityId.isNotEmpty ? item.securityId : null,
        exchange: item.exchange.isNotEmpty ? item.exchange : null,
        currency: item.currency.isNotEmpty ? item.currency : null,
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
    final tokens = context.looTokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: tokens.mutedText,
                ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCard extends StatefulWidget {
  const _SummaryCard(
    this.data, {
    required this.working,
    required this.onCustomAmount,
    required this.onRunAmount,
    required this.onDiscover,
    required this.onOpenSettings,
    required this.onOpenPriorities,
    required this.onOpenWatchlist,
  });

  final MobileRecommendationsSnapshot data;
  final bool working;
  final VoidCallback onCustomAmount;
  final ValueChanged<double> onRunAmount;
  final VoidCallback onDiscover;
  final VoidCallback onOpenSettings;
  final VoidCallback onOpenPriorities;
  final VoidCallback onOpenWatchlist;

  @override
  State<_SummaryCard> createState() => _SummaryCardState();
}

class _SummaryCardState extends State<_SummaryCard> {
  var _rulesExpanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final data = widget.data;
    final watchCount = data.preferenceContext.watchlistSymbols.length;
    final priorityCount = data.priorities.length;
    return LooGlassCard(
      isHero: true,
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
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
                    Text("本轮可用银两", style: theme.textTheme.bodyLarge),
                    const SizedBox(height: 8),
                    Text(
                      data.contributionAmount,
                      style: theme.textTheme.displaySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              FilledButton.tonalIcon(
                onPressed: widget.onDiscover,
                icon: const Icon(Icons.travel_explore_outlined, size: 18),
                label: const Text("搜货"),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _BudgetChips(
            working: widget.working,
            onRunAmount: widget.onRunAmount,
            onCustomAmount: widget.onCustomAmount,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _HeroMiniStat(
                  icon: Icons.auto_awesome_outlined,
                  label: "推荐",
                  value: "$priorityCount",
                  detail: "Loo皇推荐",
                  onTap: widget.onOpenPriorities,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _HeroMiniStat(
                  icon: Icons.inventory_2_outlined,
                  label: "囤货",
                  value: "$watchCount",
                  detail: "已确认身份",
                  onTap: widget.onOpenWatchlist,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _HeroRulesDisclosure(
            summary: data.engineSummary,
            expanded: _rulesExpanded,
            onToggle: () => setState(() => _rulesExpanded = !_rulesExpanded),
            onOpenSettings: widget.onOpenSettings,
          ),
        ],
      ),
    );
  }
}

class _BudgetChips extends StatelessWidget {
  const _BudgetChips({
    required this.working,
    required this.onRunAmount,
    required this.onCustomAmount,
  });

  final bool working;
  final ValueChanged<double> onRunAmount;
  final VoidCallback onCustomAmount;

  @override
  Widget build(BuildContext context) {
    final chips = [500.0, 1000.0, 2500.0, 5000.0];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          for (final amount in chips) ...[
            _BudgetChip(
              label: _formatCadChip(amount),
              enabled: !working,
              onTap: () => onRunAmount(amount),
            ),
            const SizedBox(width: 8),
          ],
          _BudgetChip(
            label: "自定义",
            enabled: !working,
            icon: Icons.edit_rounded,
            onTap: onCustomAmount,
          ),
        ],
      ),
    );
  }
}

class _HeroRulesDisclosure extends StatelessWidget {
  const _HeroRulesDisclosure({
    required this.summary,
    required this.expanded,
    required this.onToggle,
    required this.onOpenSettings,
  });

  final MobileRecommendationEngineSummary summary;
  final bool expanded;
  final VoidCallback onToggle;
  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: onToggle,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Icon(Icons.tune_rounded, color: tokens.accent, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      "囤货规矩 · ${_engineRuleSummary(summary)}",
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelLarge,
                    ),
                  ),
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: const Icon(Icons.keyboard_arrow_down_rounded),
                  ),
                ],
              ),
            ),
          ),
          if (expanded) ...[
            Divider(height: 1, color: tokens.cardBorder),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (summary.chips.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children:
                          summary.chips.take(4).map(_InfoPill.new).toList(),
                    ),
                  if (summary.rankingInputs.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    _EngineInputGrid(summary.rankingInputs),
                  ],
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: onOpenSettings,
                      icon: const Icon(Icons.settings_outlined, size: 18),
                      label: const Text("调整偏好因子"),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _BudgetChip extends StatelessWidget {
  const _BudgetChip({
    required this.label,
    required this.enabled,
    required this.onTap,
    this.icon,
  });

  final String label;
  final bool enabled;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: enabled ? onTap : null,
        child: Ink(
          decoration: BoxDecoration(
            color: tokens.accentSoft.withValues(alpha: enabled ? 0.72 : 0.28),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: tokens.cardBorder),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 15, color: tokens.accent),
                  const SizedBox(width: 5),
                ],
                Text(label, style: Theme.of(context).textTheme.labelLarge),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _formatCadChip(double amount) {
  if (amount >= 1000 && amount % 1000 == 0) {
    return "${(amount / 1000).toStringAsFixed(0)}k";
  }
  return amount.toStringAsFixed(0);
}

class _HeroMiniStat extends StatelessWidget {
  const _HeroMiniStat({
    required this.icon,
    required this.label,
    required this.value,
    required this.detail,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final String detail;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            color:
                Theme.of(context).colorScheme.surface.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: tokens.cardBorder),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(icon, color: tokens.accent, size: 18),
                const SizedBox(width: 8),
                Text(value, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              label,
                              style: Theme.of(context).textTheme.labelLarge,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 2),
                          Icon(Icons.keyboard_arrow_down_rounded,
                              size: 14, color: tokens.mutedText),
                        ],
                      ),
                      Text(
                        detail,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: tokens.mutedText,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EngineSummaryCard extends StatefulWidget {
  const _EngineSummaryCard({
    required this.summary,
    required this.onOpenSettings,
  });

  final MobileRecommendationEngineSummary summary;
  final VoidCallback onOpenSettings;

  @override
  State<_EngineSummaryCard> createState() => _EngineSummaryCardState();
}

class _EngineSummaryCardState extends State<_EngineSummaryCard> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    return LooGlassCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(tokens.radiusMd),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Row(
              children: [
                Icon(Icons.tune_rounded, color: tokens.accent),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("囤货规矩", style: theme.textTheme.titleMedium),
                      const SizedBox(height: 2),
                      Text(
                        _engineRuleSummary(widget.summary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: tokens.mutedText,
                        ),
                      ),
                    ],
                  ),
                ),
                AnimatedRotation(
                  turns: _expanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 180),
                  child: const Icon(Icons.keyboard_arrow_down_rounded),
                ),
              ],
            ),
          ),
          if (widget.summary.chips.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children:
                  widget.summary.chips.take(4).map(_InfoPill.new).toList(),
            ),
          ],
          if (_expanded) ...[
            const SizedBox(height: 14),
            _EngineInputGrid(widget.summary.rankingInputs),
            const SizedBox(height: 12),
            _EngineFactorSection(
              title: "影响因子",
              items: widget.summary.preferenceFactors,
            ),
            const SizedBox(height: 12),
            _EngineFactorSection(
              title: "推荐护栏",
              items: widget.summary.guardrails,
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.tonalIcon(
                onPressed: widget.onOpenSettings,
                icon: const Icon(Icons.settings_outlined),
                label: const Text("调整偏好因子"),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

String _engineRuleSummary(MobileRecommendationEngineSummary summary) {
  final parts = <String>[];
  final strategy = _firstInputValueContaining(summary.rankingInputs, "策略");
  final account = _firstInputValueContaining(summary.rankingInputs, "账户");
  if (strategy != null) parts.add(strategy);
  if (account != null) parts.add(account);
  if (parts.isEmpty && summary.summary.isNotEmpty) {
    return summary.summary;
  }
  return parts.isEmpty ? "按配置缺口、账户、税务和护栏排序" : parts.join(" · ");
}

String? _firstInputValueContaining(
  List<MobileRecommendationInput> inputs,
  String token,
) {
  for (final input in inputs) {
    if (input.label.contains(token) && input.value.isNotEmpty) {
      return input.value;
    }
  }
  return null;
}

class _EngineInputGrid extends StatelessWidget {
  const _EngineInputGrid(this.items);

  final List<MobileRecommendationInput> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: items.take(6).map((item) {
        return SizedBox(
          width: 148,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color:
                  Theme.of(context).colorScheme.surface.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: context.looTokens.cardBorder),
            ),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.label,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: context.looTokens.mutedText,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.value,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _EngineFactorSection extends StatelessWidget {
  const _EngineFactorSection({
    required this.title,
    required this.items,
  });

  final String title;
  final List<MobileRecommendationEngineFactor> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        ...items.take(8).map((item) => _EngineFactorRow(item)),
      ],
    );
  }
}

class _EngineFactorRow extends StatelessWidget {
  const _EngineFactorRow(this.item);

  final MobileRecommendationEngineFactor item;

  @override
  Widget build(BuildContext context) {
    final color = switch (item.tone) {
      "success" => Colors.green.shade300,
      "warning" => Colors.orange.shade300,
      _ => context.looTokens.mutedText,
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        children: [
          Expanded(
            child: Text(
              item.label,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              item.value,
              textAlign: TextAlign.right,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WatchlistCard extends StatefulWidget {
  const _WatchlistCard({
    required this.items,
    required this.working,
    required this.onRemove,
    required this.onOpen,
  });

  final List<MobileRecommendationMarketItem> items;
  final bool working;
  final ValueChanged<String> onRemove;
  final ValueChanged<MobileRecommendationMarketItem> onOpen;

  @override
  State<_WatchlistCard> createState() => _WatchlistCardState();
}

class _WatchlistCardState extends State<_WatchlistCard> {
  @override
  Widget build(BuildContext context) {
    final resolved = widget.items.where(_isResolvedMarketItem).toList();
    final unresolved =
        widget.items.where((item) => !_isResolvedMarketItem(item)).toList();
    return LooGlassCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  "囤货清单",
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              _InfoPill("${resolved.length} 已确认"),
            ],
          ),
          const SizedBox(height: 10),
          if (widget.items.isEmpty)
            const Text("暂无囤货标的。")
          else if (resolved.isNotEmpty)
            _MarketItemRail(
              items: resolved,
              onOpen: widget.onOpen,
              onLongPress: widget.working
                  ? null
                  : (item) => _confirmRemoveWatchlistItem(context, item),
            ),
          if (unresolved.isNotEmpty) ...[
            const SizedBox(height: 12),
            _UnresolvedWatchlistPanel(
              items: unresolved,
              working: widget.working,
              onRemove: widget.onRemove,
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _confirmRemoveWatchlistItem(
    BuildContext context,
    MobileRecommendationMarketItem item,
  ) async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "移出囤货清单？",
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text("将 ${item.symbol} 从囤货清单移除。"),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(context).pop(false),
                        child: const Text("取消"),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => Navigator.of(context).pop(true),
                        child: const Text("移除"),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
    if (confirmed == true && context.mounted) {
      widget.onRemove(item.key);
    }
  }
}

bool _isResolvedMarketItem(MobileRecommendationMarketItem item) {
  return item.symbol.isNotEmpty &&
      item.exchange.isNotEmpty &&
      item.currency.isNotEmpty;
}

class _UnresolvedWatchlistPanel extends StatelessWidget {
  const _UnresolvedWatchlistPanel({
    required this.items,
    required this.working,
    required this.onRemove,
  });

  final List<MobileRecommendationMarketItem> items;
  final bool working;
  final ValueChanged<String> onRemove;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.orange.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.orange.withValues(alpha: 0.28)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.warning_amber_rounded,
                    color: Colors.orange.shade300, size: 18),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    "待鉴定包裹",
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                _InfoPill("${items.length} 个"),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              "缺少交易所或币种，不进入推荐。",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.mutedText,
                  ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final item in items.take(8))
                  InputChip(
                    label: Text(item.symbol.isEmpty ? item.key : item.symbol),
                    onDeleted: working ? null : () => onRemove(item.key),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RecentObservationCard extends StatelessWidget {
  const _RecentObservationCard({
    required this.items,
    required this.onOpen,
  });

  final List<MobileRecommendationMarketItem> items;
  final ValueChanged<MobileRecommendationMarketItem> onOpen;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  "近期观察",
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              _InfoPill("${items.length} 个"),
            ],
          ),
          const SizedBox(height: 10),
          _MarketItemRail(items: items, onOpen: onOpen),
        ],
      ),
    );
  }
}

class _MarketItemRail extends StatelessWidget {
  const _MarketItemRail({
    required this.items,
    required this.onOpen,
    this.onLongPress,
  });

  final List<MobileRecommendationMarketItem> items;
  final ValueChanged<MobileRecommendationMarketItem> onOpen;
  final ValueChanged<MobileRecommendationMarketItem>? onLongPress;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          for (final item in items.take(12)) ...[
            _MarketItemCard(
              item: item,
              onTap: () => onOpen(item),
              onLongPress:
                  onLongPress == null ? null : () => onLongPress!(item),
            ),
            const SizedBox(width: 10),
          ],
        ],
      ),
    );
  }
}

class _MarketItemCard extends StatelessWidget {
  const _MarketItemCard({
    required this.item,
    required this.onTap,
    this.onLongPress,
  });

  final MobileRecommendationMarketItem item;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final moveColor = _marketMoveColor(context, item.dayChangeVariant);
    return SizedBox(
      width: 132,
      height: 112,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          onLongPress: onLongPress,
          child: Ink(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface.withValues(
                    alpha: item.hasMarketMove ? 0.22 : 0.14,
                  ),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: item.hasMarketMove
                    ? moveColor.withValues(alpha: 0.34)
                    : tokens.cardBorder,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.symbol,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    item.lastPriceLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.35,
                        ),
                  ),
                  const Spacer(),
                  _MarketMoveBadge(
                    label: _marketMoveLabel(item),
                    color: moveColor,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MarketMoveBadge extends StatelessWidget {
  const _MarketMoveBadge({
    required this.label,
    required this.color,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w800,
              ),
        ),
      ),
    );
  }
}

String _marketMoveLabel(MobileRecommendationMarketItem item) {
  if (!item.hasMarketMove) {
    return item.dayChangeLabel;
  }
  if (item.dayChangePctLabel.isNotEmpty &&
      item.dayChangePctLabel != "今日涨跌待刷新") {
    return "${item.dayChangeLabel} · ${item.dayChangePctLabel}";
  }
  return item.dayChangeLabel;
}

Color _marketMoveColor(BuildContext context, String variant) {
  return switch (variant) {
    "positive" => Colors.green.shade300,
    "negative" => Colors.red.shade300,
    "neutral" => context.looTokens.mutedText,
    _ => context.looTokens.mutedText,
  };
}

class _PriorityWorkbench extends StatefulWidget {
  const _PriorityWorkbench({
    required this.priorities,
    required this.onOpenSecurity,
  });

  final List<MobileRecommendationPriority> priorities;
  final ValueChanged<MobileRecommendationPriority> onOpenSecurity;

  @override
  State<_PriorityWorkbench> createState() => _PriorityWorkbenchState();
}

class _PriorityWorkbenchState extends State<_PriorityWorkbench> {
  var _selectedIndex = 0;

  @override
  void didUpdateWidget(covariant _PriorityWorkbench oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_selectedIndex >= widget.priorities.length) {
      _selectedIndex = 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    final selected = widget.priorities[_selectedIndex];

    return LooGlassCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.local_mall_outlined, color: tokens.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text("扫货台", style: theme.textTheme.titleLarge),
              ),
              Text(
                "${widget.priorities.length} 条",
                style: theme.textTheme.labelLarge?.copyWith(
                  color: tokens.mutedText,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            "按优先级横向选择标的，下方固定展示当前候选的进货建议。",
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: tokens.mutedText,
            ),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                for (var index = 0;
                    index < widget.priorities.length;
                    index++) ...[
                  _PriorityTab(
                    priority: widget.priorities[index],
                    rank: index + 1,
                    selected: index == _selectedIndex,
                    onTap: () => setState(() => _selectedIndex = index),
                  ),
                  if (index != widget.priorities.length - 1)
                    const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            child: _PriorityCard(
              key: ValueKey(
                "${selected.securityId}:${selected.securitySymbol}:$_selectedIndex",
              ),
              priority: selected,
              onOpenSecurity: widget.onOpenSecurity,
              embedded: true,
            ),
          ),
        ],
      ),
    );
  }
}

class _PriorityTab extends StatelessWidget {
  const _PriorityTab({
    required this.priority,
    required this.rank,
    required this.selected,
    required this.onTap,
  });

  final MobileRecommendationPriority priority;
  final int rank;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    final color = selected ? tokens.accent : tokens.mutedText;
    final symbol = priority.candidateBrief?.identity.symbol.isNotEmpty == true
        ? priority.candidateBrief!.identity.symbol
        : priority.securitySymbol;
    final action = _actionLabel(priority.candidateBrief?.decision.action ?? "");

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutCubic,
          constraints: const BoxConstraints(minWidth: 96),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: selected
                ? tokens.accentSoft.withValues(alpha: 0.88)
                : Theme.of(context).colorScheme.surface.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: selected ? tokens.accent : tokens.cardBorder,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "#$rank",
                style: theme.textTheme.labelSmall?.copyWith(color: color),
              ),
              const SizedBox(height: 2),
              Text(
                symbol.isEmpty ? priority.assetClass : symbol,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleSmall?.copyWith(
                  color:
                      selected ? Theme.of(context).colorScheme.onSurface : null,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                action,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: tokens.mutedText,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PriorityCard extends StatefulWidget {
  const _PriorityCard({
    super.key,
    required this.priority,
    required this.onOpenSecurity,
    this.embedded = false,
  });

  final MobileRecommendationPriority priority;
  final ValueChanged<MobileRecommendationPriority> onOpenSecurity;
  final bool embedded;

  @override
  State<_PriorityCard> createState() => _PriorityCardState();
}

class _PriorityCardState extends State<_PriorityCard> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final priority = widget.priority;
    final tokens = context.looTokens;
    final brief = priority.candidateBrief;
    final hiddenSections = [
      priority.scoreline,
      priority.gapSummary,
      if (priority.v3Overlay != null) "v3",
      ...priority.whyThis,
      ...priority.whyNot,
      ...priority.constraints.map((constraint) => constraint.label),
      ...priority.execution.map((item) => item.label),
      ...priority.alternatives,
      ...priority.intelligenceRefs.map((item) => item.title),
    ].where((item) => item.trim().isNotEmpty).length;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _priorityTitle(priority),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _prioritySubtitle(priority),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: tokens.mutedText,
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            _DecisionBadge(brief: brief, fallbackAmount: priority.amount),
          ],
        ),
        const SizedBox(height: 10),
        _PriorityImpactRow(priority: priority),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children:
              _priorityBadges(priority).take(5).map(_InfoPill.new).toList(),
        ),
        if (priority.securitySymbol.isNotEmpty) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonalIcon(
                  onPressed: () => widget.onOpenSecurity(priority),
                  icon: const Icon(Icons.open_in_new),
                  label: const Text("打开研究台"),
                ),
              ),
              if (hiddenSections > 0) ...[
                const SizedBox(width: 10),
                TextButton.icon(
                  onPressed: () => setState(() => _expanded = !_expanded),
                  icon: AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: const Icon(Icons.keyboard_arrow_down_rounded),
                  ),
                  label: Text(_expanded ? "收起" : "证据"),
                ),
              ],
            ],
          ),
        ],
        if (_expanded) ...[
          const SizedBox(height: 12),
          DecoratedBox(
            decoration: BoxDecoration(
              color:
                  Theme.of(context).colorScheme.surface.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: tokens.cardBorder),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (priority.scoreline.isNotEmpty ||
                      priority.gapSummary.isNotEmpty) ...[
                    _ScorelinePanel(priority),
                    const SizedBox(height: 12),
                  ],
                  if (priority.v3Overlay != null) ...[
                    _V3OverlayPanel(priority.v3Overlay!),
                    const SizedBox(height: 12),
                  ],
                  if (priority.intelligenceRefs.isNotEmpty) ...[
                    _PriorityIntelligenceSection(priority.intelligenceRefs),
                    const SizedBox(height: 12),
                  ],
                  if (priority.whyThis.isNotEmpty) ...[
                    _ExplanationSection(
                      title: "为什么它排前面",
                      items: priority.whyThis,
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (priority.whyNot.isNotEmpty) ...[
                    _ExplanationSection(
                      title: "需要注意什么",
                      items: priority.whyNot,
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (priority.constraints.isNotEmpty) ...[
                    _ConstraintSection(priority.constraints),
                    const SizedBox(height: 12),
                  ],
                  if (priority.execution.isNotEmpty) ...[
                    _ExecutionSection(priority.execution),
                    const SizedBox(height: 12),
                  ],
                  if (priority.alternatives.isNotEmpty)
                    _ExplanationSection(
                      title: "可替代选择",
                      items: priority.alternatives,
                    ),
                ],
              ),
            ),
          ),
        ],
      ],
    );

    if (widget.embedded) {
      return DecoratedBox(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: tokens.cardBorder),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: content,
        ),
      );
    }

    return LooGlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      child: content,
    );
  }
}

class _DecisionBadge extends StatelessWidget {
  const _DecisionBadge({
    required this.brief,
    required this.fallbackAmount,
  });

  final MobileCandidateBrief? brief;
  final String fallbackAmount;

  @override
  Widget build(BuildContext context) {
    final action = brief?.decision.action ?? "dca";
    final color = _actionColor(context, action);
    final label = _actionLabel(action);
    final amount = brief == null
        ? fallbackAmount
        : "CAD ${brief!.decision.recommendedAmountCad.toStringAsFixed(0)}";
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.34)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              amount,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PriorityImpactRow extends StatelessWidget {
  const _PriorityImpactRow({required this.priority});

  final MobileRecommendationPriority priority;

  @override
  Widget build(BuildContext context) {
    final brief = priority.candidateBrief;
    final targetAccount = brief?.decision.targetAccount ?? priority.account;
    final score = brief?.decision.matchScore;
    final before = brief?.portfolioImpact.gapBeforePct;
    final after = brief?.portfolioImpact.gapAfterPct;

    return Row(
      children: [
        Expanded(
          child: _MiniEvidenceTile(
            label: "目标账户",
            value: targetAccount.isEmpty ? "--" : targetAccount,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _MiniEvidenceTile(
            label: "匹配度",
            value: score == null ? "--" : "$score",
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _MiniEvidenceTile(
            label: "缺口",
            value: before == null || after == null
                ? "--"
                : "${before.toStringAsFixed(1)}→${after.toStringAsFixed(1)}%",
          ),
        ),
      ],
    );
  }
}

class _MiniEvidenceTile extends StatelessWidget {
  const _MiniEvidenceTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.looTokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ],
        ),
      ),
    );
  }
}

String _priorityTitle(MobileRecommendationPriority priority) {
  final brief = priority.candidateBrief;
  if (brief != null && brief.identity.symbol.isNotEmpty) {
    return "${brief.identity.symbol} · ${brief.identity.name}";
  }
  return priority.security.isNotEmpty ? priority.security : priority.assetClass;
}

String _prioritySubtitle(MobileRecommendationPriority priority) {
  final brief = priority.candidateBrief;
  if (brief == null) {
    return priority.description.isNotEmpty
        ? priority.description
        : priority.assetClass;
  }
  return [
    if (brief.identity.exchange.isNotEmpty) brief.identity.exchange,
    if (brief.identity.currency.isNotEmpty) brief.identity.currency,
    _sourceLabel(brief.source),
  ].join(" · ");
}

List<String> _priorityBadges(MobileRecommendationPriority priority) {
  final brief = priority.candidateBrief;
  final badges = <String>[
    if (brief != null) ...brief.badges,
    if (brief?.primaryBlocker != null) "注意：${brief!.primaryBlocker}",
    if (brief == null) priority.assetClass,
    if (brief == null && priority.account.isNotEmpty) priority.account,
    if (brief == null && priority.gapSummary.isNotEmpty)
      _compactGapLabel(priority.gapSummary),
  ];
  return badges.where((badge) => badge.trim().isNotEmpty).toList();
}

String _sourceLabel(String source) {
  return switch (source) {
    "watchlist" => "囤货清单",
    "existing_holding" => "已有仓位",
    "core_pool" => "核心池",
    _ => "手动候选",
  };
}

String _actionLabel(String action) {
  return switch (action) {
    "lump_sum" => "一次进货",
    "wait_pullback" => "等回撤",
    "avoid" => "暂缓",
    _ => "分批进货",
  };
}

Color _actionColor(BuildContext context, String action) {
  return switch (action) {
    "lump_sum" => Colors.green.shade300,
    "wait_pullback" => Colors.orange.shade300,
    "avoid" => Theme.of(context).colorScheme.error,
    _ => context.looTokens.accent,
  };
}

String _compactGapLabel(String value) {
  final normalized = value.trim();
  if (normalized.length <= 16) {
    return normalized;
  }
  return "${normalized.substring(0, 16)}...";
}

class _PriorityIntelligenceSection extends StatelessWidget {
  const _PriorityIntelligenceSection(this.items);

  final List<MobileRecommendationIntelligenceRef> items;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.looTokens.accentSoft,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.looTokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("相关秘闻", style: theme.textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              "用于解释背景；价格和刷新状态仍以当前 listing 为准。",
              style: theme.textTheme.bodySmall?.copyWith(
                color: context.looTokens.mutedText,
              ),
            ),
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
        color: context.looTokens.accentSoft,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.looTokens.cardBorder),
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

class _V3OverlayPanel extends StatelessWidget {
  const _V3OverlayPanel(this.overlay);

  final MobileRecommendationV3Overlay overlay;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    String score(double? value) =>
        value == null ? "--" : value.toStringAsFixed(0);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.looTokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.auto_awesome_outlined, size: 18),
                const SizedBox(width: 6),
                Text("V3 情报评分", style: theme.textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoPill("最终 ${score(overlay.finalScore)}"),
                _InfoPill("V2.1 ${score(overlay.baselineScore)}"),
                _InfoPill("偏好 ${score(overlay.preferenceFitScore)}"),
                _InfoPill("情报 ${score(overlay.externalInsightScore)}"),
              ],
            ),
            if (overlay.confidenceLabel.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(overlay.confidenceLabel),
            ],
            if (overlay.explanation.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(overlay.explanation, style: theme.textTheme.bodySmall),
            ],
            if (overlay.signals.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text("命中：${overlay.signals.take(3).join(" / ")}"),
            ],
            if (overlay.riskFlags.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                "注意：${overlay.riskFlags.take(2).join(" / ")}",
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
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

class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      child: Text(message),
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
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.36),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: context.looTokens.cardBorder),
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
          Text("进货台暂时打不开", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text("重新读取")),
        ],
      ),
    );
  }
}
