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

  Future<void> _createRun() async {
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
                          onChangeAmount: _createRun,
                          onOpenPriorities: () =>
                              _scrollToSection(_priorityKey),
                          onOpenWatchlist: () =>
                              _scrollToSection(_watchlistKey),
                        ),
                        const SizedBox(height: 16),
                        _ActionDock(
                          working: _working,
                          onDiscover: _openDiscover,
                        ),
                        const SizedBox(height: 16),
                        _EngineSummaryCard(
                          summary: snapshot.data!.engineSummary,
                          onOpenSettings: () =>
                              context.push(MobileRoutes.settings),
                        ),
                        const SizedBox(height: 16),
                        KeyedSubtree(
                          key: _watchlistKey,
                          child: _WatchlistCard(
                            items: snapshot.data!.watchlistMarketItems,
                            working: _working,
                            onRemove: _removeWatchlistSymbol,
                            onOpen: _openMarketItem,
                          ),
                        ),
                        if (snapshot
                            .data!.recentObservationItems.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          _RecentObservationCard(
                            items: snapshot.data!.recentObservationItems,
                            onOpen: _openMarketItem,
                          ),
                        ],
                        const SizedBox(height: 16),
                        KeyedSubtree(
                          key: _priorityKey,
                          child: _SectionTitle(
                            "进货优先级",
                            actionLabel:
                                "${snapshot.data!.priorities.length} 条",
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (snapshot.data!.priorities.isEmpty)
                          const _EmptyCard("暂时没有新的推荐。先完成持仓导入，Loo皇会再下达谕令。")
                        else
                          ...snapshot.data!.priorities.take(6).map(
                                (priority) => _PriorityCard(
                                  priority: priority,
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

class _SummaryCard extends StatelessWidget {
  const _SummaryCard(
    this.data, {
    required this.working,
    required this.onChangeAmount,
    required this.onOpenPriorities,
    required this.onOpenWatchlist,
  });

  final MobileRecommendationsSnapshot data;
  final bool working;
  final VoidCallback onChangeAmount;
  final VoidCallback onOpenPriorities;
  final VoidCallback onOpenWatchlist;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    final watchCount = data.preferenceContext.watchlistSymbols.length;
    final priorityCount = data.priorities.length;
    final topAsset =
        data.priorities.isEmpty ? "暂无" : data.priorities.first.assetClass;
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
                onPressed: working ? null : onChangeAmount,
                icon: working
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.edit_rounded, size: 18),
                label: const Text("改金额"),
              ),
            ],
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
                  onTap: onOpenPriorities,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _HeroMiniStat(
                  icon: Icons.inventory_2_outlined,
                  label: "囤货",
                  value: "$watchCount",
                  detail: "已确认身份",
                  onTap: onOpenWatchlist,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _HeroMiniStat(
                  icon: Icons.savings_outlined,
                  label: "现金缺口",
                  value: _engineInputValue(data.engineSummary, "本轮银两"),
                  detail: "本次投入",
                  onTap: working ? () {} : onChangeAmount,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _HeroMiniStat(
                  icon: Icons.category_outlined,
                  label: "优先资产",
                  value: topAsset,
                  detail: "本轮第一候选",
                  onTap: onOpenPriorities,
                ),
              ),
            ],
          ),
          if (data.engineLine.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              data.engineLine,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                color: tokens.mutedText,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

String _engineInputValue(
  MobileRecommendationEngineSummary summary,
  String label,
) {
  for (final input in summary.rankingInputs) {
    if (input.label == label && input.value.isNotEmpty) {
      return input.value;
    }
  }
  return "--";
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

class _CompactActionCard extends StatelessWidget {
  const _CompactActionCard({
    required this.icon,
    required this.title,
    required this.detail,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String detail;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return LooGlassCard(
      padding: const EdgeInsets.all(14),
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 112),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: tokens.accent),
                const Spacer(),
                Icon(Icons.chevron_right, color: tokens.accent),
              ],
            ),
            const Spacer(),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              detail,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.mutedText,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionDock extends StatelessWidget {
  const _ActionDock({
    required this.working,
    required this.onDiscover,
  });

  final bool working;
  final VoidCallback onDiscover;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _DiscoverEntryCard(onOpen: onDiscover)),
      ],
    );
  }
}

class _DiscoverEntryCard extends StatelessWidget {
  const _DiscoverEntryCard({required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return _CompactActionCard(
      icon: Icons.travel_explore_outlined,
      title: "搜货",
      detail: "查股票、ETF 或 CDR，先打开研究台确认身份。",
      onTap: onOpen,
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
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
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
                      Text(
                        widget.summary.title,
                        style: theme.textTheme.titleLarge,
                      ),
                      if (widget.summary.summary.isNotEmpty)
                        Text(
                          widget.summary.summary,
                          maxLines: _expanded ? null : 1,
                          overflow: _expanded ? null : TextOverflow.ellipsis,
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
                  widget.summary.chips.take(5).map(_InfoPill.new).toList(),
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
    return LooGlassCard(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
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
              _InfoPill("${widget.items.length} 个"),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            "横向查看今日涨跌；新增请从搜货台进入研究台后确认。",
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
          const SizedBox(height: 12),
          if (widget.items.isEmpty)
            const Text("暂时没有囤货标的。点上方“搜货”进入研究台后加入。")
          else
            _MarketItemRail(
              items: widget.items,
              onOpen: widget.onOpen,
              trailingBuilder: (item) => IconButton(
                tooltip: "移出囤货",
                onPressed:
                    widget.working ? null : () => widget.onRemove(item.key),
                icon: const Icon(Icons.close_rounded, size: 18),
                visualDensity: VisualDensity.compact,
              ),
            ),
        ],
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
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
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
          const SizedBox(height: 6),
          Text(
            "来自本轮 Loo皇推荐候选；点击进入研究台复核。",
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
          const SizedBox(height: 12),
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
    this.trailingBuilder,
  });

  final List<MobileRecommendationMarketItem> items;
  final ValueChanged<MobileRecommendationMarketItem> onOpen;
  final Widget Function(MobileRecommendationMarketItem item)? trailingBuilder;

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
              trailing: trailingBuilder?.call(item),
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
    this.trailing,
  });

  final MobileRecommendationMarketItem item;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final moveColor = _marketMoveColor(context, item.dayChangeVariant);
    return SizedBox(
      width: 148,
      height: 132,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
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
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          item.symbol,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                        ),
                      ),
                      if (trailing != null) trailing!,
                    ],
                  ),
                  Text(
                    item.identityLine.isEmpty ? "待识别" : item.identityLine,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: tokens.mutedText,
                        ),
                  ),
                  const Spacer(),
                  Text(
                    item.lastPriceLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 6),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: moveColor.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      child: Text(
                        item.hasMarketMove
                            ? "${item.dayChangeLabel}  ${item.dayChangePctLabel}"
                            : item.dayChangeLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: moveColor,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ),
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

Color _marketMoveColor(BuildContext context, String variant) {
  return switch (variant) {
    "positive" => Colors.green.shade300,
    "negative" => Colors.red.shade300,
    "neutral" => context.looTokens.mutedText,
    _ => context.looTokens.mutedText,
  };
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
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
        if (actionLabel != null)
          Text(
            actionLabel!,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
      ],
    );
  }
}

class _PriorityCard extends StatefulWidget {
  const _PriorityCard({
    required this.priority,
    required this.onOpenSecurity,
  });

  final MobileRecommendationPriority priority;
  final ValueChanged<MobileRecommendationPriority> onOpenSecurity;

  @override
  State<_PriorityCard> createState() => _PriorityCardState();
}

class _PriorityCardState extends State<_PriorityCard> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final priority = widget.priority;
    final tokens = context.looTokens;
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

    return LooGlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  priority.security.isNotEmpty
                      ? priority.security
                      : priority.assetClass,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              if (priority.amount.isNotEmpty) _InfoPill(priority.amount),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            priority.description.isNotEmpty
                ? priority.description
                : priority.assetClass,
            maxLines: _expanded ? null : 2,
            overflow: _expanded ? null : TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoPill(priority.assetClass),
              if (priority.account.isNotEmpty) _InfoPill(priority.account),
              if (priority.gapSummary.isNotEmpty && !_expanded)
                _InfoPill(_compactGapLabel(priority.gapSummary)),
            ],
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
                color: Theme.of(context)
                    .colorScheme
                    .surface
                    .withValues(alpha: 0.16),
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
      ),
    );
  }
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
