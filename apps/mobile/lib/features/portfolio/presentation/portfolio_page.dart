import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../app/mobile_routes.dart";
import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../../shared/data/mobile_chart_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "../../shared/presentation/loo_minister_scope.dart";
import "../data/mobile_portfolio_models.dart";
import "health_score_page.dart";

class PortfolioPage extends StatefulWidget {
  const PortfolioPage({
    required this.apiClient,
    this.accountTypeFilter,
    this.title,
    this.initialSection,
    this.sectionRequestToken = 0,
    super.key,
  });

  final LooApiClient apiClient;
  final String? accountTypeFilter;
  final String? title;
  final PortfolioInitialSection? initialSection;
  final int sectionRequestToken;

  @override
  State<PortfolioPage> createState() => _PortfolioPageState();
}

class _PortfolioPageState extends State<PortfolioPage> {
  late Future<MobilePortfolioSnapshot> _snapshot;
  final _scrollController = ScrollController();
  final _accountsKey = GlobalKey();
  final _holdingsKey = GlobalKey();
  int _handledSectionRequestToken = -1;

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

  Future<MobilePortfolioSnapshot> _loadSnapshot() async {
    final response = await widget.apiClient.getPortfolioOverview();
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("组合数据格式不正确。");
    }

    final snapshot = MobilePortfolioSnapshot.fromJson(data);
    final accountTypeFilter = widget.accountTypeFilter;
    if (accountTypeFilter == null || accountTypeFilter.isEmpty) {
      if (mounted) {
        LooMinisterScope.report(
          context,
          snapshot.toMinisterContext(
            asOf: DateTime.now().toUtc().toIso8601String(),
          ),
        );
      }
      return snapshot;
    }

    final filteredSnapshot = snapshot.filteredByAccountType(accountTypeFilter);
    if (mounted) {
      LooMinisterScope.report(
        context,
        filteredSnapshot.toMinisterContext(
          asOf: DateTime.now().toUtc().toIso8601String(),
        ),
      );
    }
    return filteredSnapshot;
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MobilePortfolioSnapshot>(
      future: _snapshot,
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          _scheduleInitialSectionScroll();
        }
        return RefreshIndicator(
          onRefresh: () async => _refresh(),
          child: LooPageGradient(
            child: CustomScrollView(
              controller: _scrollController,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: _PageHeader(
                    title: widget.title ?? "组合御览",
                    subtitle: snapshot.hasData
                        ? snapshot.data!.quoteStatus
                        : "正在整理 Loo国资产账本...",
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
                    padding: looPagePadding(context),
                    sliver: SliverList.list(
                      children: [
                        if (_isFiltered)
                          _FilterSummaryCard(snapshot.data!)
                        else
                          _HealthCard(
                            snapshot.data!.healthScore,
                            snapshot.data!.summaryPoints,
                            onTap: _openHealthScore,
                          ),
                        if (!_isFiltered &&
                            (snapshot.data!.portfolioValueChart != null ||
                                snapshot.data!.performance.isNotEmpty)) ...[
                          const SizedBox(height: 18),
                          _PortfolioTrendCard(
                            chart: snapshot.data!.portfolioValueChart,
                            fallbackPoints: snapshot.data!.performance,
                          ),
                        ],
                        if (!_isFiltered &&
                            (snapshot.data!.accountTypeAllocation.isNotEmpty ||
                                snapshot.data!.accountInstanceAllocation
                                    .isNotEmpty ||
                                snapshot
                                    .data!.assetClassDrilldown.isNotEmpty)) ...[
                          const SizedBox(height: 18),
                          _PortfolioDistributionSwitcherCard(
                            accountTypes: snapshot.data!.accountTypeAllocation,
                            accounts: snapshot.data!.accountInstanceAllocation,
                            assetClasses: snapshot.data!.assetClassDrilldown,
                          ),
                        ],
                        const SizedBox(height: 18),
                        _NavigationEntryCard(
                          key: _accountsKey,
                          title: "账户列表",
                          subtitle: "查看全部账户、账户级盈亏与账户内持仓。",
                          value: "${snapshot.data!.accounts.length} 个",
                          icon: Icons.account_balance_wallet_outlined,
                          onTap: () => context.push(
                            MobileRoutes.portfolioAccounts,
                          ),
                        ),
                        const SizedBox(height: 10),
                        _NavigationEntryCard(
                          key: _holdingsKey,
                          title: "持仓列表",
                          subtitle: "查看全部持仓、账户归属、盈亏与仓位详情。",
                          value: "${snapshot.data!.holdings.length} 个",
                          icon: Icons.view_list_rounded,
                          onTap: () => context.push(
                            MobileRoutes.portfolioHoldings,
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

  void _scheduleInitialSectionScroll() {
    final section = widget.initialSection;
    if (section == null ||
        _handledSectionRequestToken == widget.sectionRequestToken) {
      return;
    }
    _handledSectionRequestToken = widget.sectionRequestToken;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final key = switch (section) {
        PortfolioInitialSection.accounts => _accountsKey,
        PortfolioInitialSection.holdings => _holdingsKey,
      };
      final targetContext = key.currentContext;
      if (targetContext == null) return;
      Scrollable.ensureVisible(
        targetContext,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
        alignment: 0.08,
      );
    });
  }

  void _openHealthScore() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => HealthScorePage(apiClient: widget.apiClient),
      ),
    );
  }

  bool get _isFiltered =>
      widget.accountTypeFilter != null && widget.accountTypeFilter!.isNotEmpty;
}

enum PortfolioInitialSection { accounts, holdings }

class _PageHeader extends StatelessWidget {
  const _PageHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return LooHeroHeader(
      eyebrow: "Portfolio",
      title: title,
      subtitle: subtitle,
    );
  }
}

class _HealthCard extends StatelessWidget {
  const _HealthCard(this.score, this.summaryPoints, {required this.onTap});

  final String score;
  final List<String> summaryPoints;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return LooGlassCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text("国库健康度",
                    style: Theme.of(context).textTheme.titleLarge),
              ),
              Text(
                "查看巡查",
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: tokens.accent,
                    ),
              ),
            ],
          ),
          SizedBox(height: tokens.gapSm),
          Text(score, style: Theme.of(context).textTheme.headlineMedium),
          SizedBox(height: tokens.gapSm),
          ...summaryPoints.take(3).map((point) => Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text("• $point"),
              )),
        ],
      ),
    );
  }
}

class _FilterSummaryCard extends StatelessWidget {
  const _FilterSummaryCard(this.data);

  final MobilePortfolioSnapshot data;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("账户类型筛选", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          const Text("这里只显示健康巡查中对应账户类型下的账户和持仓。"),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: Text("账户 ${data.accounts.length} 个")),
              Expanded(child: Text("持仓 ${data.holdings.length} 个")),
            ],
          ),
        ],
      ),
    );
  }
}

class _PortfolioTrendCard extends StatelessWidget {
  const _PortfolioTrendCard({
    required this.chart,
    required this.fallbackPoints,
  });

  final MobileChartSeries? chart;
  final List<MobilePortfolioPerformancePoint> fallbackPoints;

  @override
  Widget build(BuildContext context) {
    final points = chart?.points
            .map((point) => (
                  label: point.label,
                  displayValue: point.displayValue,
                  chartValue: point.value,
                ))
            .toList() ??
        fallbackPoints
            .map((point) => (
                  label: point.label,
                  displayValue: point.displayValue,
                  chartValue: point.chartValue,
                ))
            .toList();
    if (points.length < 2) {
      return const SizedBox.shrink();
    }

    final first = points.first;
    final last = points.last;
    final freshness = chart?.freshness;

    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(chart?.title ?? "组合价值走势",
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          LooLineChart(
            points: points
                .map(
                  (point) => LooLineChartPoint(
                    label: point.label,
                    value: point.chartValue,
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 12),
          Text(
            "${first.label} ${first.displayValue} → ${last.label} ${last.displayValue}",
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          if (freshness != null) ...[
            const SizedBox(height: 10),
            Chip(label: Text(freshness.label)),
            const SizedBox(height: 6),
            Text(
              freshness.detail,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (chart != null && chart!.notes.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...chart!.notes.take(2).map(
                  (note) => Text(
                    "· $note",
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
          ],
        ],
      ),
    );
  }
}

class _PortfolioDistributionSwitcherCard extends StatefulWidget {
  const _PortfolioDistributionSwitcherCard({
    required this.accountTypes,
    required this.accounts,
    required this.assetClasses,
  });

  final List<MobilePortfolioAllocationPoint> accountTypes;
  final List<MobilePortfolioAllocationPoint> accounts;
  final List<MobileAssetClassDrilldown> assetClasses;

  @override
  State<_PortfolioDistributionSwitcherCard> createState() =>
      _PortfolioDistributionSwitcherCardState();
}

class _PortfolioDistributionSwitcherCardState
    extends State<_PortfolioDistributionSwitcherCard> {
  var _selected = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = <_DistributionTab>[
      if (widget.accountTypes.any((point) => point.value > 0))
        _DistributionTab(
          label: "类型",
          title: "账户类型分布",
          segments: widget.accountTypes
              .where((point) => point.value > 0)
              .take(6)
              .map(
                (point) => LooDistributionSegment(
                  label: point.name,
                  value: point.value,
                ),
              )
              .toList(),
        ),
      if (widget.accounts.any((point) => point.value > 0))
        _DistributionTab(
          label: "账户",
          title: "账户实例分布",
          segments: widget.accounts
              .where((point) => point.value > 0)
              .take(6)
              .map(
                (point) => LooDistributionSegment(
                  label: point.name,
                  value: point.value,
                ),
              )
              .toList(),
        ),
      if (widget.assetClasses.any((item) => item.currentPct > 0))
        _DistributionTab(
          label: "资产",
          title: "资产类别配置",
          segments: widget.assetClasses
              .where((item) => item.currentPct > 0)
              .take(6)
              .map(
                (item) => LooDistributionSegment(
                  label: item.name,
                  value: item.currentPct,
                ),
              )
              .toList(),
        ),
    ];

    if (tabs.isEmpty) return const SizedBox.shrink();
    final selectedIndex = _selected.clamp(0, tabs.length - 1);
    final selected = tabs[selectedIndex];
    final tokens = context.looTokens;

    return LooGlassCard(
      child: AnimatedSize(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    selected.title,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                const SizedBox(width: 10),
                _DistributionTabSwitch(
                  tabs: tabs,
                  selectedIndex: selectedIndex,
                  onSelected: (index) => setState(() => _selected = index),
                ),
              ],
            ),
            SizedBox(height: tokens.gapMd),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeOutCubic,
              child: KeyedSubtree(
                key: ValueKey(selected.label),
                child: LooDistributionBar(segments: selected.segments),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DistributionTab {
  const _DistributionTab({
    required this.label,
    required this.title,
    required this.segments,
  });

  final String label;
  final String title;
  final List<LooDistributionSegment> segments;
}

class _DistributionTabSwitch extends StatelessWidget {
  const _DistributionTabSwitch({
    required this.tabs,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<_DistributionTab> tabs;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(3),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var index = 0; index < tabs.length; index++)
              _DistributionTabButton(
                label: tabs[index].label,
                isSelected: index == selectedIndex,
                onTap: () => onSelected(index),
              ),
          ],
        ),
      ),
    );
  }
}

class _DistributionTabButton extends StatelessWidget {
  const _DistributionTabButton({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? tokens.accent.withValues(alpha: 0.22) : null,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: isSelected ? tokens.accent : tokens.mutedText,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
              ),
        ),
      ),
    );
  }
}

class _NavigationEntryCard extends StatelessWidget {
  const _NavigationEntryCard({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.icon,
    required this.onTap,
    super.key,
  });

  final String title;
  final String subtitle;
  final String value;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return LooGlassCard(
      onTap: onTap,
      padding: EdgeInsets.all(tokens.gapMd),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: tokens.accent.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(tokens.radiusMd),
            ),
            child: Icon(icon, color: tokens.accent),
          ),
          SizedBox(width: tokens.gapMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                SizedBox(height: tokens.gapXs),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: tokens.mutedText,
                      ),
                ),
              ],
            ),
          ),
          SizedBox(width: tokens.gapMd),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(value, style: Theme.of(context).textTheme.titleLarge),
              SizedBox(height: tokens.gapXs),
              Icon(Icons.arrow_forward_rounded, color: tokens.mutedText),
            ],
          ),
        ],
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
    return LooStatePanel(
      title: "Loo国资产账本暂时打不开",
      message: message,
      actionLabel: "重新翻阅",
      onAction: onRetry,
    );
  }
}
