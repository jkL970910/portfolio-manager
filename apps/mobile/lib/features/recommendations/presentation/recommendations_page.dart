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
  final _scenariosKey = GlobalKey();
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
    if (context == null) {
      ScaffoldMessenger.of(this.context).showSnackBar(
        const SnackBar(content: Text("还没有可查看的模拟。先点“重算清单”生成分配方案。")),
      );
      return;
    }
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
                          onOpenPriorities: () =>
                              _scrollToSection(_priorityKey),
                          onOpenWatchlist: () =>
                              _scrollToSection(_watchlistKey),
                          onOpenScenarios: () =>
                              _scrollToSection(_scenariosKey),
                          canOpenScenarios: snapshot.data!.scenarios.isNotEmpty,
                        ),
                        const SizedBox(height: 16),
                        _ActionDock(
                          working: _working,
                          onDiscover: _openDiscover,
                          onGenerate: _createRun,
                        ),
                        const SizedBox(height: 16),
                        KeyedSubtree(
                          key: _watchlistKey,
                          child: _WatchlistCard(
                            symbols:
                                snapshot.data!.preferenceContext.watchlistSymbols,
                            working: _working,
                            onRemove: _removeWatchlistSymbol,
                            onOpen: _openWatchlistSymbol,
                          ),
                        ),
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
                        const SizedBox(height: 16),
                        _RecommendationIntelligenceStatusCard(snapshot.data!),
                        const SizedBox(height: 16),
                        _PreferenceContextCard(
                          snapshot.data!.preferenceContext,
                        ),
                        if (snapshot.data!.explainer.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          _CollapsibleTextCard(
                            title: "进货规则",
                            summary: "风险偏好、账户顺序、税务放置和再平衡阈值会影响排序。",
                            text: snapshot.data!.explainer.take(4).join("\n"),
                          ),
                        ],
                        if (snapshot.data!.scenarios.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          KeyedSubtree(
                            key: _scenariosKey,
                            child: const _SectionTitle("银两分配模拟"),
                          ),
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

  void _openWatchlistSymbol(String watchlistKey) {
    final identity = _WatchlistIdentity.parse(watchlistKey);
    if (identity.symbol.isEmpty) {
      return;
    }
    context.push(
      MobileRoutes.securityDetail(
        symbol: identity.symbol,
        exchange: identity.exchange,
        currency: identity.currency,
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
    required this.onOpenPriorities,
    required this.onOpenWatchlist,
    required this.onOpenScenarios,
    required this.canOpenScenarios,
  });

  final MobileRecommendationsSnapshot data;
  final VoidCallback onOpenPriorities;
  final VoidCallback onOpenWatchlist;
  final VoidCallback onOpenScenarios;
  final bool canOpenScenarios;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    final watchCount = data.preferenceContext.watchlistSymbols.length;
    final priorityCount = data.priorities.length;
    final scenarioCount = data.scenarios.length;
    return LooGlassCard(
      isHero: true,
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
              _HeroCountPill(
                label: "候选",
                value: "$priorityCount",
                onTap: onOpenPriorities,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _HeroMiniStat(
                  label: "囤货",
                  value: "$watchCount",
                  detail: "已确认身份",
                  onTap: onOpenWatchlist,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _HeroMiniStat(
                  label: "模拟",
                  value: "$scenarioCount",
                  detail: canOpenScenarios ? "银两分配" : "重算后查看",
                  onTap: onOpenScenarios,
                  enabled: canOpenScenarios,
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

class _HeroCountPill extends StatelessWidget {
  const _HeroCountPill({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
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
            color: tokens.accentSoft,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: tokens.cardBorder),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Column(
              children: [
                Text(value, style: Theme.of(context).textTheme.titleLarge),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(label, style: Theme.of(context).textTheme.labelSmall),
                    const SizedBox(width: 2),
                    Icon(Icons.keyboard_arrow_down_rounded,
                        size: 14, color: tokens.mutedText),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroMiniStat extends StatelessWidget {
  const _HeroMiniStat({
    required this.label,
    required this.value,
    required this.detail,
    required this.onTap,
    this.enabled = true,
  });

  final String label;
  final String value;
  final String detail;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: enabled ? onTap : null,
        child: Ink(
          decoration: BoxDecoration(
            color:
                Theme.of(context).colorScheme.surface.withValues(
                      alpha: enabled ? 0.18 : 0.08,
                    ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: tokens.cardBorder),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
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
                          Icon(
                            enabled
                                ? Icons.keyboard_arrow_down_rounded
                                : Icons.lock_clock_outlined,
                            size: 14,
                            color: tokens.mutedText,
                          ),
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

class _RecommendationIntelligenceStatusCard extends StatelessWidget {
  const _RecommendationIntelligenceStatusCard(this.data);

  final MobileRecommendationsSnapshot data;

  @override
  Widget build(BuildContext context) {
    final refs = data.priorities
        .expand((priority) => priority.intelligenceRefs)
        .toList();
    final hasRefs = refs.isNotEmpty;
    return LooGlassCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Icon(Icons.auto_awesome_outlined, color: context.looTokens.accent),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("秘闻参考",
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  hasRefs
                      ? "已引用 ${refs.length} 条外部新闻缓存，完整秘闻在总览页查看。"
                      : "暂无可用秘闻，排序按国库持仓和偏好计算。",
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: context.looTokens.mutedText,
                      ),
                ),
              ],
            ),
          ),
          _InfoPill(hasRefs ? "已纳入" : "无缓存"),
        ],
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
    this.isBusy = false,
  });

  final IconData icon;
  final String title;
  final String detail;
  final VoidCallback? onTap;
  final bool isBusy;

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
                if (isBusy)
                  const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
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
    required this.onGenerate,
  });

  final bool working;
  final VoidCallback onDiscover;
  final VoidCallback onGenerate;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _DiscoverEntryCard(onOpen: onDiscover)),
        const SizedBox(width: 12),
        Expanded(
          child: _GenerateRecommendationCard(
            working: working,
            onGenerate: onGenerate,
          ),
        ),
      ],
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
    return _CompactActionCard(
      icon: Icons.auto_awesome,
      title: "重算清单",
      detail: "输入本次可用银两，按国库缺口和护栏重新排序。",
      isBusy: working,
      onTap: working ? null : onGenerate,
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

class _PreferenceContextCard extends StatelessWidget {
  const _PreferenceContextCard(this.context);

  final MobilePreferenceContext context;

  @override
  Widget build(BuildContext context_) {
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("当前进货规矩", style: Theme.of(context_).textTheme.titleLarge),
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
            Text(
              context.allocationLine,
              style: Theme.of(context_).textTheme.bodySmall?.copyWith(
                    color: context_.looTokens.mutedText,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

class _WatchlistCard extends StatefulWidget {
  const _WatchlistCard({
    required this.symbols,
    required this.working,
    required this.onRemove,
    required this.onOpen,
  });

  final List<String> symbols;
  final bool working;
  final ValueChanged<String> onRemove;
  final ValueChanged<String> onOpen;

  @override
  State<_WatchlistCard> createState() => _WatchlistCardState();
}

class _WatchlistCardState extends State<_WatchlistCard> {
  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return LooGlassCard(
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
              _InfoPill("${widget.symbols.length} 个"),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            "新增请从搜货台打开研究台后确认。",
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.mutedText,
                ),
          ),
          const SizedBox(height: 12),
          if (widget.symbols.isEmpty)
            const Text("暂时没有囤货标的。点上方“搜货”进入研究台后加入。")
          else
            Column(
              children: widget.symbols.take(6).map((symbol) {
                final identity = _WatchlistIdentity.parse(symbol);
                final subtitle = [
                  if (identity.exchange != null) identity.exchange!,
                  if (identity.currency != null) identity.currency!,
                  "已确认",
                ].join(" · ");
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .surface
                          .withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: tokens.cardBorder),
                    ),
                    child: ListTile(
                      dense: true,
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 12),
                      leading: CircleAvatar(
                        radius: 18,
                        backgroundColor: tokens.accentSoft,
                        child: Text(
                          identity.symbol.length > 2
                              ? identity.symbol.substring(0, 2)
                              : identity.symbol,
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                      ),
                      title: Text(_formatWatchlistLabel(symbol)),
                      subtitle: Text(subtitle),
                      trailing: Wrap(
                        spacing: 2,
                        children: [
                          IconButton(
                            tooltip: "打开研究台",
                            onPressed: () => widget.onOpen(symbol),
                            icon: const Icon(Icons.open_in_new),
                          ),
                          IconButton(
                            tooltip: "移出囤货",
                            onPressed: widget.working
                                ? null
                                : () => widget.onRemove(symbol),
                            icon: const Icon(Icons.close),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }
}

String _formatWatchlistLabel(String symbol) {
  return symbol.split(":").where((part) => part.isNotEmpty).join(" · ");
}

class _WatchlistIdentity {
  const _WatchlistIdentity({
    required this.symbol,
    required this.exchange,
    required this.currency,
  });

  final String symbol;
  final String? exchange;
  final String? currency;

  String get label => [
        symbol,
        if (exchange != null && exchange!.isNotEmpty) exchange!,
        if (currency != null && currency!.isNotEmpty) currency!,
      ].join(" · ");

  static _WatchlistIdentity parse(String value) {
    final parts = value
        .split(":")
        .map((part) => part.trim().toUpperCase())
        .where((part) => part.isNotEmpty)
        .toList();
    return _WatchlistIdentity(
      symbol: parts.isNotEmpty ? parts[0] : "",
      exchange: parts.length > 1 ? parts[1] : null,
      currency: parts.length > 2 ? parts[2] : null,
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
      child: Padding(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    priority.assetClass,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                if (priority.amount.isNotEmpty) _InfoPill(priority.amount),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              priority.description,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (priority.account.isNotEmpty) _InfoPill(priority.account),
                if (priority.security.isNotEmpty) _InfoPill(priority.security),
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

class _ScenarioCard extends StatelessWidget {
  const _ScenarioCard(this.scenario);

  final MobileRecommendationScenario scenario;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "${scenario.label} · ${scenario.amount}",
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 6),
          Text(
            [
              scenario.summary,
              ...scenario.diffs.take(2),
            ].where((item) => item.isNotEmpty).join("\n"),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
        ],
      ),
    );
  }
}

class _TextCard extends StatelessWidget {
  const _TextCard(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      child: Text(text),
    );
  }
}

class _CollapsibleTextCard extends StatefulWidget {
  const _CollapsibleTextCard({
    required this.title,
    required this.summary,
    required this.text,
  });

  final String title;
  final String summary;
  final String text;

  @override
  State<_CollapsibleTextCard> createState() => _CollapsibleTextCardState();
}

class _CollapsibleTextCardState extends State<_CollapsibleTextCard> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(tokens.radiusMd),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.title,
                    style: Theme.of(context).textTheme.titleLarge,
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
          const SizedBox(height: 8),
          Text(
            _expanded ? widget.text : widget.summary,
            maxLines: _expanded ? null : 2,
            overflow: _expanded ? null : TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: _expanded ? null : tokens.mutedText,
                ),
          ),
        ],
      ),
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
