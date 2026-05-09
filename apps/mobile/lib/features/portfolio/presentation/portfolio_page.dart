import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "../../shared/presentation/loo_minister_scope.dart";
import "../data/mobile_portfolio_models.dart";
import "account_detail_page.dart";
import "asset_class_drilldown_page.dart";
import "health_score_page.dart";
import "holding_detail_page.dart";

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
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
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
                            snapshot
                                .data!.accountTypeAllocation.isNotEmpty) ...[
                          const SizedBox(height: 18),
                          _AllocationCard(
                            title: "账户类型分布",
                            points: snapshot.data!.accountTypeAllocation,
                          ),
                        ],
                        if (!_isFiltered &&
                            snapshot.data!.accountInstanceAllocation
                                .isNotEmpty) ...[
                          const SizedBox(height: 18),
                          _AllocationCard(
                            title: "账户实例分布",
                            points: snapshot.data!.accountInstanceAllocation,
                          ),
                        ],
                        if (!_isFiltered &&
                            snapshot.data!.assetClassDrilldown.isNotEmpty) ...[
                          const SizedBox(height: 18),
                          _AssetClassCard(
                            items: snapshot.data!.assetClassDrilldown,
                            onTap: _openAssetClassDrilldown,
                          ),
                        ],
                        const SizedBox(height: 18),
                        _SectionTitle(
                            key: _accountsKey,
                            title: "账户",
                            actionLabel: "${snapshot.data!.accounts.length} 个"),
                        const SizedBox(height: 10),
                        ...snapshot.data!.accounts.map(
                          (account) => _AccountTile(
                            account,
                            onTap: () => _openAccountDetail(account),
                          ),
                        ),
                        const SizedBox(height: 18),
                        _SectionTitle(
                            key: _holdingsKey,
                            title: "持仓",
                            actionLabel: "${snapshot.data!.holdings.length} 个"),
                        const SizedBox(height: 10),
                        ...snapshot.data!.holdings.map(
                          (holding) => _HoldingTile(
                            holding,
                            onTap: () => _openHoldingDetail(holding),
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

  void _openAccountDetail(MobileAccountCard account) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AccountDetailPage(
          apiClient: widget.apiClient,
          accountId: account.id,
          fallbackTitle: account.name,
        ),
      ),
    );
  }

  void _openHoldingDetail(MobileHoldingCard holding) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => HoldingDetailPage(
          apiClient: widget.apiClient,
          holdingId: holding.id,
          fallbackTitle: holding.symbol,
        ),
      ),
    );
  }

  void _openHealthScore() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => HealthScorePage(apiClient: widget.apiClient),
      ),
    );
  }

  void _openAssetClassDrilldown(MobileAssetClassDrilldown item) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AssetClassDrilldownPage(
          apiClient: widget.apiClient,
          item: item,
        ),
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

class _AllocationCard extends StatelessWidget {
  const _AllocationCard({required this.title, required this.points});

  final String title;
  final List<MobilePortfolioAllocationPoint> points;

  @override
  Widget build(BuildContext context) {
    final shownPoints =
        points.where((point) => point.value > 0).take(6).toList();
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 14),
          LooDistributionBar(
            segments: shownPoints
                .map(
                  (point) => LooDistributionSegment(
                    label: point.name,
                    value: point.value,
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 12),
          ...shownPoints.map(
            (point) => Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                children: [
                  Expanded(child: Text(point.name)),
                  Text(point.displayValue,
                      style: Theme.of(context).textTheme.titleMedium),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AssetClassCard extends StatelessWidget {
  const _AssetClassCard({required this.items, required this.onTap});

  final List<MobileAssetClassDrilldown> items;
  final ValueChanged<MobileAssetClassDrilldown> onTap;

  @override
  Widget build(BuildContext context) {
    final shownItems =
        items.where((item) => item.currentPct > 0).take(6).toList();
    final tokens = context.looTokens;
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("资产类别配置", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 14),
          LooDistributionBar(
            segments: shownItems
                .map(
                  (item) => LooDistributionSegment(
                    label: item.name,
                    value: item.currentPct,
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 12),
          ...shownItems.map(
            (item) => Padding(
              padding: EdgeInsets.only(top: tokens.gapSm),
              child: LooTappableRow(
                title: item.name,
                subtitle: "目标 ${item.target} · 当前 ${item.current}",
                value: item.driftLabel,
                onTap: () => onTap(item),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.title,
    required this.actionLabel,
    super.key,
  });

  final String title;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        Text(
          actionLabel,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: context.looTokens.mutedText,
              ),
        ),
      ],
    );
  }
}

class _AccountTile extends StatelessWidget {
  const _AccountTile(this.account, {required this.onTap});

  final MobileAccountCard account;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return LooTappableRow(
      margin: const EdgeInsets.only(bottom: 10),
      title: account.name,
      subtitle: account.detail,
      value: account.value,
      valueDetail: account.gainLoss,
      onTap: onTap,
    );
  }
}

class _HoldingTile extends StatelessWidget {
  const _HoldingTile(this.holding, {required this.onTap});

  final MobileHoldingCard holding;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return LooTappableRow(
      margin: const EdgeInsets.only(bottom: 10),
      title: "${holding.symbol} · ${holding.name}",
      subtitle: holding.detail,
      value: holding.value,
      valueDetail: holding.gainLoss,
      onTap: onTap,
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
