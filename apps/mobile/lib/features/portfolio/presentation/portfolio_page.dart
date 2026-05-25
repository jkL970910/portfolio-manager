import "dart:math" as math;

import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../app/mobile_routes.dart";
import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "../../shared/presentation/loo_minister_scope.dart";
import "../data/mobile_portfolio_models.dart";

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
                if (_isFiltered || !snapshot.hasData)
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
                    padding: looPagePadding(
                      context,
                      top: _isFiltered ? 0 : 12,
                    ),
                    sliver: SliverList.list(
                      children: [
                        if (_isFiltered)
                          _FilterSummaryCard(snapshot.data!)
                        else
                          _PortfolioHeroCard(
                            snapshot.data!,
                            onTap: () => _openHealthScore(snapshot.data!),
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
                        const SizedBox(height: 18),
                        _AccountsDropdownCard(
                          key: _accountsKey,
                          accounts: snapshot.data!.accounts,
                          onOpenAccount: (account) async {
                            final changed = await context.push<bool>(
                              MobileRoutes.accountDetail(account.id),
                            );
                            if (changed == true && context.mounted) {
                              _refresh();
                            }
                          },
                        ),
                        const SizedBox(height: 10),
                        _HoldingsSummaryEntryCard(
                          key: _holdingsKey,
                          holdings: snapshot.data!.securityHoldings,
                          onOpenHolding: (holding) => context.push(
                            MobileRoutes.securityDetail(
                              symbol: holding.symbol,
                              securityId: holding.securityId.isEmpty
                                  ? null
                                  : holding.securityId,
                              exchange: holding.exchange.isEmpty
                                  ? null
                                  : holding.exchange,
                              currency: holding.currency.isEmpty
                                  ? null
                                  : holding.currency,
                            ),
                          ),
                          onOpenHoldings: () => context.push(
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

  void _openHealthScore(MobilePortfolioSnapshot data) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => _PortfolioHealthSheet(
        data: data,
        onOpenFullHealth: () {
          Navigator.of(context).pop();
          context.push(MobileRoutes.portfolioHealth);
        },
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
      title: title,
      subtitle: subtitle,
    );
  }
}

class _PortfolioHeroCard extends StatefulWidget {
  const _PortfolioHeroCard(this.data, {required this.onTap});

  final MobilePortfolioSnapshot data;
  final VoidCallback onTap;

  @override
  State<_PortfolioHeroCard> createState() => _PortfolioHeroCardState();
}

class _PortfolioHeroCardState extends State<_PortfolioHeroCard> {
  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    return LooGlassCard(
      isHero: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "组合预览",
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          SizedBox(height: tokens.gapXs),
          Text(
            widget.data.summaryPoints.isEmpty
                ? widget.data.quoteStatus
                : widget.data.summaryPoints.first,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: tokens.mutedText,
            ),
          ),
          SizedBox(height: tokens.gapMd),
          _PortfolioHeroMetrics(
            data: widget.data,
            onOpenHealth: widget.onTap,
          ),
        ],
      ),
    );
  }
}

class _PortfolioHeroMetrics extends StatelessWidget {
  const _PortfolioHeroMetrics({
    required this.data,
    required this.onOpenHealth,
  });

  final MobilePortfolioSnapshot data;
  final VoidCallback onOpenHealth;

  @override
  Widget build(BuildContext context) {
    final topHoldingsShare = data.securityHoldings
        .where((holding) => _parsePercent(holding.weight) > 0)
        .take(8)
        .toList();
    final shareSheetHoldings = data.securityHoldings
        .where((holding) => _parsePercent(holding.weight) > 0)
        .toList();
    final largestHolding =
        topHoldingsShare.isEmpty ? null : topHoldingsShare.first;
    final shareLabel = topHoldingsShare.isEmpty
        ? "${data.securityHoldings.length} 个"
        : "前${topHoldingsShare.length}项";

    return Row(
      children: [
        Expanded(
          child: _HeroMetricButton(
            label: largestHolding?.symbol ?? "最大仓位",
            value: largestHolding?.weight ?? "--",
            icon: Icons.stacked_line_chart_rounded,
            onTap: shareSheetHoldings.isEmpty
                ? null
                : () => _showHoldingsShareSheet(
                      context,
                      shareSheetHoldings,
                      includeOtherHoldings: true,
                    ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _HeroMetricButton(
            label: "持仓比例",
            value: shareLabel,
            icon: Icons.donut_large_rounded,
            onTap: topHoldingsShare.isEmpty
                ? null
                : () => _showHoldingsShareSheet(
                      context,
                      topHoldingsShare,
                      includeOtherHoldings: false,
                    ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _HeroMetricButton(
            label: "健康分",
            value: data.healthScore.replaceAll(" 分", ""),
            icon: Icons.radar_rounded,
            onTap: onOpenHealth,
          ),
        ),
      ],
    );
  }
}

class _HeroMetricButton extends StatelessWidget {
  const _HeroMetricButton({
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return InkWell(
      borderRadius: BorderRadius.circular(tokens.radiusLg),
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.24),
          borderRadius: BorderRadius.circular(tokens.radiusLg),
          border: Border.all(color: tokens.cardBorder),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Row(
                children: [
                  Icon(icon, size: 15, color: tokens.accent),
                  const Spacer(),
                  if (onTap != null)
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 16,
                      color: tokens.mutedText,
                    ),
                ],
              ),
              const SizedBox(height: 7),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
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

void _showHoldingsShareSheet(
  BuildContext context,
  List<MobileHoldingCard> holdings, {
  required bool includeOtherHoldings,
}) {
  final visibleHoldings =
      includeOtherHoldings ? holdings.take(8).toList() : holdings;
  final slices = visibleHoldings
      .map(
        (holding) => _ShareSlice(
          label: holding.symbol,
          value: _parsePercent(holding.weight),
          displayValue: holding.weight,
          amount: holding.value,
        ),
      )
      .where((slice) => slice.value > 0)
      .toList();
  final visibleTotal =
      slices.fold<double>(0, (sum, slice) => sum + slice.value);
  final hiddenCount =
      math.max(holdings.length - visibleHoldings.length, 0).toInt();
  final otherValue = math.max<double>(0.0, 100.0 - visibleTotal);
  if (includeOtherHoldings && otherValue >= 0.05) {
    slices.add(
      _ShareSlice(
        label: hiddenCount > 0 ? "其他持仓" : "未列出部分",
        value: otherValue,
        displayValue: "${otherValue.toStringAsFixed(1)}%",
        amount: hiddenCount > 0 ? "$hiddenCount 项" : "",
      ),
    );
  }
  _showShareSheet(
    context,
    title: includeOtherHoldings ? "完整持仓比例" : "前 8 项持仓",
    subtitle: includeOtherHoldings
        ? "按当前组合市值占比展示，前 8 项之外合并为其他持仓。"
        : "只展示前 8 项持仓在整个组合中的合计占比，不包含其他持仓。",
    slices: slices,
  );
}

void _showShareSheet(
  BuildContext context, {
  required String title,
  required String subtitle,
  required List<_ShareSlice> slices,
}) {
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) => _ShareSheet(
      title: title,
      subtitle: subtitle,
      slices: slices,
    ),
  );
}

class _ShareSheet extends StatelessWidget {
  const _ShareSheet({
    required this.title,
    required this.subtitle,
    required this.slices,
  });

  final String title;
  final String subtitle;
  final List<_ShareSlice> slices;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        tokens.gapLg,
        0,
        tokens.gapLg,
        tokens.gapXl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          SizedBox(height: tokens.gapSm),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.mutedText,
                ),
          ),
          SizedBox(height: tokens.gapLg),
          Center(child: _ShareDonutChart(slices: slices)),
          SizedBox(height: tokens.gapLg),
          ...slices.map(
            (slice) => Padding(
              padding: EdgeInsets.only(bottom: tokens.gapSm),
              child: Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: _shareSliceColor(context, slices.indexOf(slice)),
                      shape: BoxShape.circle,
                    ),
                  ),
                  SizedBox(width: tokens.gapSm),
                  Expanded(
                    child: Text(
                      slice.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ),
                  Text(
                    [
                      slice.displayValue,
                      if (slice.amount.isNotEmpty && slice.amount != "--")
                        slice.amount,
                    ].join(" · "),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: tokens.mutedText,
                        ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PortfolioHealthSheet extends StatelessWidget {
  const _PortfolioHealthSheet({
    required this.data,
    required this.onOpenFullHealth,
  });

  final MobilePortfolioSnapshot data;
  final VoidCallback onOpenFullHealth;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    final radar = data.healthRadar
        .map(
          (point) => LooRadarPoint(
            label: point.dimension,
            value: point.value,
          ),
        )
        .toList();

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.82,
        ),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            tokens.gapLg,
            0,
            tokens.gapLg,
            tokens.gapXl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("国库健康度", style: theme.textTheme.titleLarge),
              SizedBox(height: tokens.gapSm),
              Text(
                data.healthScore,
                style: theme.textTheme.displaySmall,
              ),
              if (data.summaryPoints.isNotEmpty) ...[
                SizedBox(height: tokens.gapXs),
                Text(
                  data.summaryPoints.first,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: tokens.mutedText,
                  ),
                ),
              ],
              SizedBox(height: tokens.gapMd),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: onOpenFullHealth,
                  icon: const Icon(Icons.chevron_right_rounded),
                  label: const Text("健康分析"),
                ),
              ),
              if (radar.isNotEmpty) ...[
                SizedBox(height: tokens.gapLg),
                Center(
                  child: SizedBox(
                    width: math.min(MediaQuery.sizeOf(context).width - 48, 320),
                    child: LooRadarChart(points: radar, height: 230),
                  ),
                ),
              ],
              if (data.summaryPoints.length > 1) ...[
                SizedBox(height: tokens.gapLg),
                Text("重点提示", style: theme.textTheme.titleMedium),
                SizedBox(height: tokens.gapSm),
                ...data.summaryPoints.skip(1).take(3).map(
                      (item) => Padding(
                        padding: EdgeInsets.only(bottom: tokens.gapSm),
                        child: Text("• $item"),
                      ),
                    ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ShareDonutChart extends StatelessWidget {
  const _ShareDonutChart({required this.slices});

  final List<_ShareSlice> slices;

  @override
  Widget build(BuildContext context) {
    final total = slices.fold<double>(0, (sum, slice) => sum + slice.value);
    final tokens = context.looTokens;
    final displayTotal =
        slices.any((slice) => slice.label == "其他持仓" || slice.label == "未列出部分")
            ? "100.0%"
            : "${total.toStringAsFixed(1)}%";
    return SizedBox(
      width: 172,
      height: 172,
      child: CustomPaint(
        painter: _ShareDonutPainter(
          slices: slices,
          total: total <= 0 ? 1 : total,
          tokens: tokens,
        ),
        child: Center(
          child: Text(
            displayTotal,
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ),
      ),
    );
  }
}

class _ShareDonutPainter extends CustomPainter {
  const _ShareDonutPainter({
    required this.slices,
    required this.total,
    required this.tokens,
  });

  final List<_ShareSlice> slices;
  final double total;
  final LooThemeTokens tokens;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final strokeWidth = size.shortestSide * 0.14;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = strokeWidth;

    paint.color = tokens.cardBorder;
    canvas.drawArc(
      rect.deflate(strokeWidth / 2),
      -math.pi / 2,
      math.pi * 2,
      false,
      paint,
    );

    var start = -math.pi / 2;
    for (var index = 0; index < slices.length; index++) {
      final sweep = math.pi * 2 * (slices[index].value / total);
      paint.color = _shareSliceColorFromTokens(tokens, index);
      canvas.drawArc(
        rect.deflate(strokeWidth / 2),
        start,
        math.max(0.04, sweep - 0.03),
        false,
        paint,
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _ShareDonutPainter oldDelegate) =>
      oldDelegate.slices != slices ||
      oldDelegate.total != total ||
      oldDelegate.tokens != tokens;
}

class _ShareSlice {
  const _ShareSlice({
    required this.label,
    required this.value,
    required this.displayValue,
    required this.amount,
  });

  final String label;
  final double value;
  final String displayValue;
  final String amount;
}

Color _shareSliceColor(BuildContext context, int index) {
  return _shareSliceColorFromTokens(context.looTokens, index);
}

Color _shareSliceColorFromTokens(LooThemeTokens tokens, int index) {
  final colors = [
    tokens.accent,
    tokens.success,
    tokens.info,
    tokens.warning,
    tokens.danger,
    tokens.accentSoft,
  ];
  return colors[index % colors.length];
}

double _parsePercent(String value) {
  final match = RegExp(r"[-+]?\d+(?:\.\d+)?").firstMatch(value);
  return double.tryParse(match?.group(0) ?? "") ?? 0;
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
          const Text("这里只显示国库巡查中对应账户类型下的账户和持仓。"),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: Text("账户 ${data.accounts.length} 个")),
              Expanded(child: Text("标的 ${data.securityHoldings.length} 个")),
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
                  rawDate: DateTime.tryParse(point.rawDate ?? ""),
                ))
            .toList() ??
        fallbackPoints
            .map((point) => (
                  label: point.label,
                  displayValue: point.displayValue,
                  chartValue: point.chartValue,
                  rawDate: null as DateTime?,
                ))
            .toList();
    if (points.length < 2) {
      return const SizedBox.shrink();
    }

    return LooGlassCard(
      child: LooTrendChart(
        title: chart?.title ?? "组合价值走势",
        initialRange: LooTrendRange.ytd,
        points: points
            .map(
              (point) => LooTrendPoint(
                label: point.label,
                displayValue: point.displayValue,
                value: point.chartValue,
                rawDate: point.rawDate,
              ),
            )
            .toList(),
      ),
    );
  }
}

class _AccountsDropdownCard extends StatefulWidget {
  const _AccountsDropdownCard({
    required this.accounts,
    required this.onOpenAccount,
    super.key,
  });

  final List<MobileAccountCard> accounts;
  final ValueChanged<MobileAccountCard> onOpenAccount;

  @override
  State<_AccountsDropdownCard> createState() => _AccountsDropdownCardState();
}

class _AccountsDropdownCardState extends State<_AccountsDropdownCard> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return LooGlassCard(
      padding: EdgeInsets.all(tokens.gapMd),
      child: AnimatedSize(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        alignment: Alignment.topCenter,
        child: Column(
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(tokens.radiusMd),
              onTap: () => setState(() => _expanded = !_expanded),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    const _EntryIcon(Icons.account_balance_wallet_outlined),
                    SizedBox(width: tokens.gapMd),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "账户总览",
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          SizedBox(height: tokens.gapXs),
                          Text(
                            "展开查看账户，点击单个账户进入详情。",
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
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
                        Text(
                          "${widget.accounts.length} 个",
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        SizedBox(height: tokens.gapXs),
                        AnimatedRotation(
                          turns: _expanded ? 0.5 : 0,
                          duration: const Duration(milliseconds: 180),
                          curve: Curves.easeOutCubic,
                          child: Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: tokens.mutedText,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (_expanded) ...[
              SizedBox(height: tokens.gapMd),
              Divider(height: 1, color: tokens.cardBorder),
              SizedBox(height: tokens.gapSm),
              if (widget.accounts.isEmpty)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    "还没有账户。",
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: tokens.mutedText,
                        ),
                  ),
                )
              else
                ...widget.accounts.map(
                  (account) => _CompactAccountRow(
                    account: account,
                    onTap: () => widget.onOpenAccount(account),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _HoldingsSummaryEntryCard extends StatefulWidget {
  const _HoldingsSummaryEntryCard({
    required this.holdings,
    required this.onOpenHolding,
    required this.onOpenHoldings,
    super.key,
  });

  final List<MobileHoldingCard> holdings;
  final ValueChanged<MobileHoldingCard> onOpenHolding;
  final VoidCallback onOpenHoldings;

  @override
  State<_HoldingsSummaryEntryCard> createState() =>
      _HoldingsSummaryEntryCardState();
}

class _HoldingsSummaryEntryCardState extends State<_HoldingsSummaryEntryCard> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final topHolding = widget.holdings.isEmpty ? null : widget.holdings.first;
    final subtitle = topHolding == null
        ? "展开查看主要标的，或进入完整持仓列表。"
        : "展开查看主要标的 · 最大仓位 ${topHolding.symbol} ${topHolding.weight}";

    return LooGlassCard(
      padding: EdgeInsets.all(tokens.gapMd),
      child: AnimatedSize(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        alignment: Alignment.topCenter,
        child: Column(
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(tokens.radiusMd),
              onTap: () => setState(() => _expanded = !_expanded),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    const _EntryIcon(Icons.view_list_rounded),
                    SizedBox(width: tokens.gapMd),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "持仓总览",
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          SizedBox(height: tokens.gapXs),
                          Text(
                            subtitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
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
                        Text(
                          "${widget.holdings.length} 个",
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        SizedBox(height: tokens.gapXs),
                        AnimatedRotation(
                          turns: _expanded ? 0.5 : 0,
                          duration: const Duration(milliseconds: 180),
                          curve: Curves.easeOutCubic,
                          child: Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: tokens.mutedText,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (_expanded) ...[
              SizedBox(height: tokens.gapMd),
              Divider(height: 1, color: tokens.cardBorder),
              SizedBox(height: tokens.gapSm),
              if (widget.holdings.isEmpty)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    "还没有持仓。",
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: tokens.mutedText,
                        ),
                  ),
                )
              else
                ...widget.holdings.take(5).map(
                      (holding) => _CompactHoldingRow(
                        holding: holding,
                        onTap: () => widget.onOpenHolding(holding),
                      ),
                    ),
              SizedBox(height: tokens.gapSm),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: widget.onOpenHoldings,
                  icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                  label: const Text("完整持仓列表"),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CompactHoldingRow extends StatelessWidget {
  const _CompactHoldingRow({required this.holding, required this.onTap});

  final MobileHoldingCard holding;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final subtitle = [
      if (holding.accountCount.isNotEmpty) "${holding.accountCount} 个账户",
      if (holding.weight.isNotEmpty) holding.weight,
      if (holding.exchange.isNotEmpty || holding.currency.isNotEmpty)
        [holding.exchange, holding.currency]
            .where((item) => item.isNotEmpty)
            .join(" · "),
    ].where((item) => item.isNotEmpty).join(" · ");
    return InkWell(
      borderRadius: BorderRadius.circular(tokens.radiusMd),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: tokens.gapSm),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _holdingTitle(holding),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  if (subtitle.isNotEmpty) ...[
                    SizedBox(height: tokens.gapXs),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: tokens.mutedText,
                          ),
                    ),
                  ],
                ],
              ),
            ),
            SizedBox(width: tokens.gapMd),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  holding.value,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                if (holding.gainLoss.isNotEmpty) ...[
                  SizedBox(height: tokens.gapXs),
                  Text(
                    holding.gainLoss,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: holding.gainLoss.trim().startsWith("-")
                              ? tokens.danger
                              : tokens.success,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ],
              ],
            ),
            SizedBox(width: tokens.gapSm),
            Icon(Icons.chevron_right_rounded, color: tokens.mutedText),
          ],
        ),
      ),
    );
  }
}

String _holdingTitle(MobileHoldingCard holding) {
  final symbol = holding.symbol.trim();
  final name = holding.name.trim();
  if (name.isEmpty ||
      name == "--" ||
      name.toUpperCase() == symbol.toUpperCase()) {
    return symbol;
  }
  return "$symbol · $name";
}

class _CompactAccountRow extends StatelessWidget {
  const _CompactAccountRow({required this.account, required this.onTap});

  final MobileAccountCard account;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return InkWell(
      borderRadius: BorderRadius.circular(tokens.radiusMd),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: tokens.gapSm),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    account.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  if (account.detail.isNotEmpty) ...[
                    SizedBox(height: tokens.gapXs),
                    Text(
                      account.detail,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: tokens.mutedText,
                          ),
                    ),
                  ],
                ],
              ),
            ),
            SizedBox(width: tokens.gapMd),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(account.value,
                    style: Theme.of(context).textTheme.titleSmall),
                if (account.gainLoss.isNotEmpty) ...[
                  SizedBox(height: tokens.gapXs),
                  Text(
                    account.gainLoss,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: account.gainLoss.trim().startsWith("-")
                              ? tokens.danger
                              : tokens.success,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ],
              ],
            ),
            SizedBox(width: tokens.gapSm),
            Icon(Icons.chevron_right_rounded, color: tokens.mutedText),
          ],
        ),
      ),
    );
  }
}

class _EntryIcon extends StatelessWidget {
  const _EntryIcon(this.icon);

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: tokens.accent.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(tokens.radiusMd),
      ),
      child: Icon(icon, color: tokens.accent),
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
