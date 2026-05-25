import "dart:math" as math;

import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../app/mobile_routes.dart";
import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../../intelligence/data/daily_intelligence_models.dart";
import "../../intelligence/presentation/daily_intelligence_card.dart";
import "../../onboarding/presentation/loo_coach_mark_overlay.dart";
import "../../onboarding/presentation/onboarding_checklist_card.dart";
import "../data/mobile_home_models.dart";
import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "../../shared/presentation/loo_minister_scope.dart";

class OverviewPage extends StatefulWidget {
  const OverviewPage({
    required this.apiClient,
    this.onOpenAccounts,
    this.onOpenHoldings,
    this.onOpenRecommendations,
    super.key,
  });

  final LooApiClient apiClient;
  final VoidCallback? onOpenAccounts;
  final VoidCallback? onOpenHoldings;
  final VoidCallback? onOpenRecommendations;

  @override
  State<OverviewPage> createState() => _OverviewPageState();
}

class _OverviewPageState extends State<OverviewPage> {
  late Future<MobileHomeSnapshot> _snapshot;
  late Future<MobileDailyIntelligenceSnapshot> _dailyIntelligence;
  final _summaryCoachKey = GlobalKey();
  final _intelligenceCoachKey = GlobalKey();
  final _accountsCoachKey = GlobalKey();
  var _coachScheduled = false;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
    _dailyIntelligence = _loadDailyIntelligence();
  }

  Future<MobileHomeSnapshot> _loadSnapshot() async {
    final response = await widget.apiClient.getMobileHome();
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("总览数据格式不正确。");
    }

    final snapshot = MobileHomeSnapshot.fromJson(data);
    if (mounted) {
      LooMinisterScope.report(
        context,
        snapshot.toMinisterContext(
            asOf: DateTime.now().toUtc().toIso8601String()),
      );
      _scheduleOverviewCoachMarks(snapshot);
    }
    return snapshot;
  }

  void _scheduleOverviewCoachMarks(MobileHomeSnapshot snapshot) {
    if (_coachScheduled ||
        snapshot.onboarding.skippedAll ||
        snapshot.onboarding.coachStatusFor("overview") != "pending") {
      return;
    }
    _coachScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      showLooCoachMarks(
        context: context,
        steps: [
          LooCoachStep(
            targetKey: _summaryCoachKey,
            title: "国库总览",
            body: "这里看总资产、健康分、buying power 和主要入口。",
          ),
          LooCoachStep(
            targetKey: _intelligenceCoachKey,
            title: "Loo国秘闻",
            body: "这里是每日市场摘要，不是单个标的买卖指令。",
          ),
          LooCoachStep(
            targetKey: _accountsCoachKey,
            title: "账户入口",
            body: "这里进入单个账户和持仓明细。",
          ),
        ],
        onCompleted: () => widget.apiClient.updateOnboarding({
          "coachMarks": {"overview": "completed"},
        }),
        onSkipped: () => widget.apiClient.updateOnboarding({
          "coachMarks": {"overview": "skipped"},
        }),
      );
    });
  }

  Future<MobileDailyIntelligenceSnapshot> _loadDailyIntelligence() async {
    final response = await widget.apiClient.getDailyIntelligence(limit: 8);
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("今日秘闻数据格式不正确。");
    }
    return MobileDailyIntelligenceSnapshot.fromJson(data);
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
      _dailyIntelligence = _loadDailyIntelligence();
    });
  }

  Future<void> _skipOnboarding() async {
    await widget.apiClient.updateOnboarding({"skippedAll": true});
    if (!mounted) {
      return;
    }
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MobileHomeSnapshot>(
      future: _snapshot,
      builder: (context, snapshot) {
        return RefreshIndicator(
          onRefresh: () async => _refresh(),
          child: LooPageGradient(
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: _PageHeader(
                    title: "Loo国总览",
                    subtitle: snapshot.hasData
                        ? "欢迎回来，${snapshot.data!.viewerName}"
                        : "正在召集 Loo 国财政大臣...",
                    profile: snapshot.data?.citizenProfile,
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
                        KeyedSubtree(
                          key: _summaryCoachKey,
                          child: _OverviewSummaryPanel(
                            snapshot.data!,
                            onOpenHealth: _openHealthScore,
                            onOpenHoldings: widget.onOpenHoldings,
                            onShowHoldingsShare: () => _showTopHoldingsShare(
                              snapshot.data!.topHoldings,
                            ),
                            onOpenRecommendations: widget.onOpenRecommendations,
                          ),
                        ),
                        if (snapshot.data!.onboarding.shouldShowChecklist) ...[
                          const SizedBox(height: 18),
                          OnboardingChecklistCard(
                            state: snapshot.data!.onboarding,
                            onOpenSettings: () =>
                                context.push(MobileRoutes.settings),
                            onOpenImport: () =>
                                context.push(MobileRoutes.importFlow),
                            onOpenHealth: _openHealthScore,
                            onOpenRecommendations:
                                widget.onOpenRecommendations ?? () {},
                            onSkip: _skipOnboarding,
                          ),
                        ],
                        if (snapshot.data!.netWorthChart != null ||
                            snapshot.data!.netWorthTrend.isNotEmpty) ...[
                          const SizedBox(height: 18),
                          _OverviewTrendCard(
                            chart: snapshot.data!.netWorthChart,
                            fallbackPoints: snapshot.data!.netWorthTrend,
                          ),
                        ],
                        if (snapshot.data!.marketSentiment != null) ...[
                          const SizedBox(height: 18),
                          _MarketSentimentCard(
                            snapshot.data!.marketSentiment!,
                          ),
                        ],
                        const SizedBox(height: 18),
                        KeyedSubtree(
                          key: _intelligenceCoachKey,
                          child: FutureBuilder<MobileDailyIntelligenceSnapshot>(
                            future: _dailyIntelligence,
                            builder: (context, intelligenceSnapshot) {
                              return DailyIntelligenceCard(
                                snapshot: intelligenceSnapshot.data,
                                isLoading:
                                    intelligenceSnapshot.connectionState ==
                                        ConnectionState.waiting,
                                errorMessage: intelligenceSnapshot.hasError
                                    ? intelligenceSnapshot.error.toString()
                                    : null,
                                onViewSecurity: _openSecurityFromIntelligence,
                                onGenerateAiSummary:
                                    _generateDailyIntelligenceAiSummary,
                                compactCarousel: true,
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 18),
                        KeyedSubtree(
                          key: _accountsCoachKey,
                          child: Column(
                            children: [
                              _SectionTitle(
                                  title: "账户入口",
                                  actionLabel: "前往账户",
                                  onAction: widget.onOpenAccounts),
                              const SizedBox(height: 10),
                              ...snapshot.data!.accounts.map(
                                (account) => _AccountTile(
                                  account,
                                  onTap: () => _openAccountDetail(account),
                                ),
                              ),
                            ],
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

  Future<void> _openAccountDetail(MobileAccountCard account) async {
    final changed = await context.push<bool>(
      MobileRoutes.accountDetail(account.id),
    );
    if (changed == true && mounted) {
      _refresh();
    }
  }

  void _showTopHoldingsShare(List<MobileHoldingCard> holdings) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => _TopHoldingsShareSheet(holdings: holdings),
    );
  }

  void _openSecurityFromIntelligence(MobileDailyIntelligenceItem item) {
    context.push(
      MobileRoutes.securityDetail(
        symbol: item.identity.symbol,
        securityId:
            item.identity.securityId.isEmpty ? null : item.identity.securityId,
        exchange:
            item.identity.exchange.isEmpty ? null : item.identity.exchange,
        currency:
            item.identity.currency.isEmpty ? null : item.identity.currency,
      ),
    );
  }

  Future<MobileDailyIntelligenceAiSummary> _generateDailyIntelligenceAiSummary(
    MobileDailyIntelligenceItem item,
  ) async {
    final response =
        await widget.apiClient.createDailyIntelligenceAiSummary(item.id);
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("Loo皇总结数据格式不正确。");
    }
    return MobileDailyIntelligenceAiSummary.fromJson(data);
  }

  void _openHealthScore() {
    context.push(MobileRoutes.portfolioHealth);
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader({
    required this.title,
    required this.subtitle,
    required this.profile,
  });

  final String title;
  final String subtitle;
  final MobileHomeCitizenProfile? profile;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        tokens.gapLg,
        tokens.gapMd,
        tokens.gapLg,
        tokens.gapSm,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.headlineSmall),
                SizedBox(height: tokens.gapXs),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: tokens.mutedText,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          if (profile != null) _PersonaBadge(profile: profile!),
        ],
      ),
    );
  }
}

class _PersonaBadge extends StatelessWidget {
  const _PersonaBadge({required this.profile});

  final MobileHomeCitizenProfile profile;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return LooGlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
      child: SizedBox(
        width: 142,
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                shape: BoxShape.circle,
                border: Border.all(color: tokens.cardBorder, width: 1.2),
              ),
              clipBehavior: Clip.antiAlias,
              child: Image.asset(
                profile.avatarAsset,
                fit: BoxFit.cover,
              ),
            ),
            SizedBox(width: tokens.gapSm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    profile.rankLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    profile.addressLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: tokens.accent,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    profile.idCode,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: tokens.mutedText,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OverviewSummaryPanel extends StatelessWidget {
  const _OverviewSummaryPanel(
    this.snapshot, {
    required this.onOpenHealth,
    required this.onOpenHoldings,
    required this.onShowHoldingsShare,
    required this.onOpenRecommendations,
  });

  final MobileHomeSnapshot snapshot;
  final VoidCallback onOpenHealth;
  final VoidCallback? onOpenHoldings;
  final VoidCallback onShowHoldingsShare;
  final VoidCallback? onOpenRecommendations;

  @override
  Widget build(BuildContext context) {
    final total = _metricByLabel(snapshot.metrics, "总资产");
    final allTimeReturn = _metricByLabel(snapshot.metrics, "累计收益") ??
        _metricByLabel(snapshot.metrics, "All-time return");
    final risk = _metricByLabel(snapshot.metrics, "风险风格");
    final health = _metricByLabel(snapshot.metrics, "组合健康分");

    return Column(
      children: [
        _AssetHeroCard(
          total: total,
          registeredRoom: snapshot.registeredRoom,
          buyingPower: snapshot.buyingPower,
          risk: risk,
          allTimeReturn: allTimeReturn,
          chart: snapshot.netWorthChart,
          fallbackPoints: snapshot.netWorthTrend,
        ),
        const SizedBox(height: 12),
        if (snapshot.topHoldings.isNotEmpty) ...[
          _HoldingsOverviewCard(
            holdings: snapshot.topHoldings,
            holdingCount: snapshot.holdingCount,
            onOpenList: onOpenHoldings,
            onShowChart: onShowHoldingsShare,
          ),
          const SizedBox(height: 12),
        ],
        SizedBox(
          height: 172,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                flex: 5,
                child: _RecommendationCard(
                  snapshot.recommendationTheme,
                  snapshot.recommendationReason,
                  onTap: onOpenRecommendations,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 4,
                child: _CompactHealthCard(
                  score: health?.value ?? snapshot.health.score,
                  status: health?.detail.isNotEmpty == true
                      ? health!.detail
                      : snapshot.health.status,
                  onTap: onOpenHealth,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  MobileMetric? _metricByLabel(List<MobileMetric> metrics, String label) {
    for (final metric in metrics) {
      if (metric.label == label) return metric;
    }
    return null;
  }
}

class _AssetHeroCard extends StatelessWidget {
  const _AssetHeroCard({
    required this.total,
    required this.registeredRoom,
    required this.buyingPower,
    required this.risk,
    required this.allTimeReturn,
    required this.chart,
    required this.fallbackPoints,
  });

  final MobileMetric? total;
  final MobileRegisteredRoomSummary registeredRoom;
  final MobileBuyingPower buyingPower;
  final MobileMetric? risk;
  final MobileMetric? allTimeReturn;
  final MobileChartSeries? chart;
  final List<MobileHomeTrendPoint> fallbackPoints;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    final latestChange = _latestChange();
    return SizedBox(
      height: 152,
      child: LooGlassCard(
        isHero: true,
        padding: EdgeInsets.all(tokens.gapMd),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              flex: 5,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    total?.label ?? "总资产",
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: tokens.mutedText,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: tokens.gapXs),
                  Text(
                    total?.value ?? "--",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  SizedBox(height: tokens.gapMd),
                  if (latestChange != null)
                    _MetaValue(
                      label: latestChange.label,
                      value: latestChange.value,
                      color: latestChange.isNegative
                          ? tokens.danger
                          : tokens.success,
                    ),
                  if (latestChange != null && allTimeReturn != null)
                    const SizedBox(height: 4),
                  if (allTimeReturn != null)
                    _MetaValue(
                      label: "累计收益",
                      value: allTimeReturn!.value,
                      color: _isNegativeValue(allTimeReturn!.value)
                          ? tokens.danger
                          : tokens.success,
                    ),
                ],
              ),
            ),
            SizedBox(width: tokens.gapMd),
            Expanded(
              flex: 3,
              child: Column(
                children: [
                  Expanded(
                    child: _AssetMiniMetric(
                      label: "注册额度",
                      value: registeredRoom.value,
                      valueColor: theme.colorScheme.onSurface,
                    ),
                  ),
                  SizedBox(height: tokens.gapSm),
                  Expanded(
                    child: _AssetMiniMetric(
                      label: buyingPower.label,
                      value: buyingPower.value,
                      valueColor: buyingPower.confidence == "low"
                          ? tokens.mutedText
                          : theme.colorScheme.onSurface,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  ({String label, String value, bool isNegative})? _latestChange() {
    final points = chart?.points
            .map(
              (point) => (
                value: point.value,
                rawDate: DateTime.tryParse(point.rawDate ?? ""),
              ),
            )
            .toList() ??
        fallbackPoints
            .map(
              (point) => (
                value: point.chartValue,
                rawDate: null as DateTime?,
              ),
            )
            .toList();
    if (points.length < 2) return null;
    final current = points[points.length - 1];
    final previous = points[points.length - 2];
    if (previous.value <= 0) return null;
    final delta = current.value - previous.value;
    final percent = delta / previous.value * 100;
    final label =
        _isPreviousDay(previous.rawDate, current.rawDate) ? "今日变化" : "最新变化";
    return (
      label: label,
      value: "${_formatMoneyDelta(delta)} · ${_formatPercentDelta(percent)}",
      isNegative: delta < 0,
    );
  }

  bool _isPreviousDay(DateTime? previous, DateTime? current) {
    if (previous == null || current == null) return false;
    final previousDay = DateTime(previous.year, previous.month, previous.day);
    final currentDay = DateTime(current.year, current.month, current.day);
    return currentDay.difference(previousDay).inDays == 1;
  }

  String _formatMoneyDelta(double value) {
    final sign = value >= 0 ? "+" : "-";
    final absValue = value.abs();
    if (absValue >= 1000000) {
      return "$sign\$${(absValue / 1000000).toStringAsFixed(1)}M";
    }
    if (absValue >= 1000) {
      return "$sign\$${(absValue / 1000).toStringAsFixed(1)}k";
    }
    return "$sign\$${absValue.toStringAsFixed(0)}";
  }

  String _formatPercentDelta(double value) {
    final sign = value >= 0 ? "+" : "";
    return "$sign${value.toStringAsFixed(1)}%";
  }

  bool _isNegativeValue(String value) {
    return value.trimLeft().startsWith("-");
  }
}

class _AssetMiniMetric extends StatelessWidget {
  const _AssetMiniMetric({
    required this.label,
    required this.value,
    required this.valueColor,
  });

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        horizontal: tokens.gapSm,
        vertical: tokens.gapSm,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(tokens.radiusMd),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(
              color: tokens.mutedText,
              fontWeight: FontWeight.w700,
            ),
          ),
          SizedBox(height: tokens.gapXs),
          Text(
            value,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleSmall?.copyWith(
              color: valueColor,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaValue extends StatelessWidget {
  const _MetaValue({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return SizedBox(
      width: double.infinity,
      child: RichText(
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        text: TextSpan(
          style: theme.textTheme.bodySmall?.copyWith(height: 1.1),
          children: [
            TextSpan(
              text: "$label ",
              style: TextStyle(
                color: tokens.mutedText,
                fontWeight: FontWeight.w700,
              ),
            ),
            TextSpan(
              text: _compactValue(value),
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _compactValue(String value) {
    return value.replaceAll(" · ", " · ").replaceAll(RegExp(r"\\.0%\\b"), "%");
  }
}

class _CompactHealthCard extends StatelessWidget {
  const _CompactHealthCard({
    required this.score,
    required this.status,
    required this.onTap,
  });

  final String score;
  final String status;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return LooGlassCard(
      onTap: onTap,
      padding: EdgeInsets.all(tokens.gapSm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text("组合健康分", style: theme.textTheme.titleSmall),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: tokens.warning.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(tokens.radiusXl),
                  border: Border.all(color: tokens.cardBorder),
                ),
                child: Text(
                  status,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: tokens.warning,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: tokens.gapXs),
          Expanded(
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  left: 0,
                  top: 4,
                  child: Text(
                    _scoreNumber(score),
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                Positioned(
                  right: -10,
                  bottom: -8,
                  child: SizedBox(
                    width: 106,
                    height: 106,
                    child: CustomPaint(
                      painter: _MiniRadarPainter(tokens),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 6),
            child: Text(
              "健康分析 →",
              style: theme.textTheme.labelSmall?.copyWith(
                color: tokens.accent,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _scoreNumber(String value) {
    final match = RegExp(r"\d+").firstMatch(value);
    return match?.group(0) ?? "--";
  }
}

class _MiniRadarPainter extends CustomPainter {
  const _MiniRadarPainter(this.tokens);

  final LooThemeTokens tokens;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.shortestSide * 0.42;
    final angles = List<double>.generate(
      5,
      (index) => (-90 + index * 72) * 3.141592653589793 / 180,
    );
    final values = [0.82, 0.58, 0.72, 0.52, 0.68];
    final shape = Path();
    for (var i = 0; i < angles.length; i++) {
      final point = center +
          Offset(
            radius * values[i] * _cos(angles[i]),
            radius * values[i] * _sin(angles[i]),
          );
      if (i == 0) {
        shape.moveTo(point.dx, point.dy);
      } else {
        shape.lineTo(point.dx, point.dy);
      }
    }
    shape.close();
    canvas.drawCircle(
      center,
      radius * 0.82,
      Paint()
        ..color = tokens.accent.withValues(alpha: 0.08)
        ..style = PaintingStyle.fill,
    );
    canvas.drawPath(
      shape,
      Paint()
        ..color = tokens.accent.withValues(alpha: 0.24)
        ..style = PaintingStyle.fill,
    );
    canvas.drawPath(
      shape,
      Paint()
        ..color = tokens.accent
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }

  double _sin(double value) {
    return math.sin(value);
  }

  double _cos(double value) {
    return math.cos(value);
  }

  @override
  bool shouldRepaint(covariant _MiniRadarPainter oldDelegate) =>
      oldDelegate.tokens != tokens;
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.title,
    required this.actionLabel,
    this.onAction,
  });

  final String title;
  final String actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        TextButton(
          onPressed: onAction,
          child: Text(actionLabel),
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

class _HoldingsOverviewCard extends StatelessWidget {
  const _HoldingsOverviewCard({
    required this.holdings,
    required this.holdingCount,
    required this.onOpenList,
    required this.onShowChart,
  });

  final List<MobileHoldingCard> holdings;
  final int holdingCount;
  final VoidCallback? onOpenList;
  final VoidCallback onShowChart;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    final topSymbols =
        holdings.take(4).map((holding) => holding.symbol).toList();

    final displayCount = holdingCount > 0 ? holdingCount : holdings.length;

    return SizedBox(
      height: 58,
      child: Row(
        children: [
          Expanded(
            child: LooGlassCard(
              padding: EdgeInsets.symmetric(
                horizontal: tokens.gapMd,
                vertical: tokens.gapSm,
              ),
              onTap: onOpenList,
              child: Row(
                children: [
                  _HoldingSymbolStack(symbols: topSymbols),
                  SizedBox(width: tokens.gapMd),
                  Expanded(
                    child: Text(
                      "共 $displayCount 个标的",
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall,
                    ),
                  ),
                  SizedBox(width: tokens.gapSm),
                  Icon(
                    Icons.arrow_forward_rounded,
                    color: theme.colorScheme.onSurface,
                  ),
                ],
              ),
            ),
          ),
          SizedBox(width: tokens.gapSm),
          SizedBox(
            width: 68,
            child: LooGlassCard(
              padding: EdgeInsets.symmetric(
                horizontal: tokens.gapSm,
                vertical: tokens.gapSm,
              ),
              onTap: onShowChart,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.donut_small_outlined, color: tokens.accent),
                  SizedBox(height: tokens.gapXs),
                  Text(
                    "占比",
                    maxLines: 1,
                    style: theme.textTheme.labelMedium?.copyWith(
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

class _HoldingSymbolStack extends StatelessWidget {
  const _HoldingSymbolStack({required this.symbols});

  final List<String> symbols;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final shown = symbols.take(3).toList();
    return SizedBox(
      width: 58,
      height: 34,
      child: Stack(
        children: [
          for (var index = 0; index < shown.length; index++)
            Positioned(
              left: index * 16,
              child: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: Theme.of(context)
                      .colorScheme
                      .surfaceContainerHighest
                      .withValues(alpha: 0.92),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: tokens.cardBorder),
                ),
                alignment: Alignment.center,
                child: Text(
                  shown[index].characters.take(2).toString(),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _TopHoldingsShareSheet extends StatelessWidget {
  const _TopHoldingsShareSheet({required this.holdings});

  final List<MobileHoldingCard> holdings;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    final slices = holdings
        .map(
          (holding) => _HoldingShareSlice(
            symbol: holding.symbol,
            value: _parsePercent(holding.weight),
            label: holding.weight.isEmpty ? "--" : holding.weight,
            amount: holding.value,
          ),
        )
        .where((slice) => slice.value > 0)
        .toList();

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
          Text("主要持仓占比", style: theme.textTheme.titleLarge),
          SizedBox(height: tokens.gapSm),
          Text(
            "按当前组合市值占比展示前 ${holdings.length} 个标的。",
            style: theme.textTheme.bodySmall?.copyWith(
              color: tokens.mutedText,
            ),
          ),
          SizedBox(height: tokens.gapLg),
          Center(
            child: _TopHoldingsDonutChart(slices: slices),
          ),
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
                      color: _holdingSliceColor(context, slices.indexOf(slice)),
                      shape: BoxShape.circle,
                    ),
                  ),
                  SizedBox(width: tokens.gapSm),
                  Expanded(
                    child: Text(
                      slice.symbol,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Text(
                    "${slice.label} · ${slice.amount}",
                    style: theme.textTheme.bodySmall?.copyWith(
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

class _TopHoldingsDonutChart extends StatelessWidget {
  const _TopHoldingsDonutChart({required this.slices});

  final List<_HoldingShareSlice> slices;

  @override
  Widget build(BuildContext context) {
    final total = slices.fold<double>(0, (sum, slice) => sum + slice.value);
    final tokens = context.looTokens;
    return SizedBox(
      width: 172,
      height: 172,
      child: CustomPaint(
        painter: _TopHoldingsDonutPainter(
          slices: slices,
          total: total <= 0 ? 1 : total,
          tokens: tokens,
        ),
        child: Center(
          child: Text(
            "${total.toStringAsFixed(1)}%",
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ),
      ),
    );
  }
}

class _TopHoldingsDonutPainter extends CustomPainter {
  const _TopHoldingsDonutPainter({
    required this.slices,
    required this.total,
    required this.tokens,
  });

  final List<_HoldingShareSlice> slices;
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
      paint.color = _holdingSliceColorFromTokens(tokens, index);
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
  bool shouldRepaint(covariant _TopHoldingsDonutPainter oldDelegate) =>
      oldDelegate.slices != slices ||
      oldDelegate.total != total ||
      oldDelegate.tokens != tokens;
}

class _HoldingShareSlice {
  const _HoldingShareSlice({
    required this.symbol,
    required this.value,
    required this.label,
    required this.amount,
  });

  final String symbol;
  final double value;
  final String label;
  final String amount;
}

double _parsePercent(String value) {
  return double.tryParse(value.replaceAll("%", "").trim()) ?? 0;
}

Color _holdingSliceColor(BuildContext context, int index) {
  return _holdingSliceColorFromTokens(context.looTokens, index);
}

Color _holdingSliceColorFromTokens(LooThemeTokens tokens, int index) {
  final colors = [
    tokens.accent,
    tokens.success,
    tokens.warning,
    tokens.info,
    tokens.danger,
  ];
  return colors[index % colors.length];
}

class _OverviewTrendCard extends StatelessWidget {
  const _OverviewTrendCard({
    required this.chart,
    required this.fallbackPoints,
  });

  final MobileChartSeries? chart;
  final List<MobileHomeTrendPoint> fallbackPoints;

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
        title: chart?.title ?? "总资产走势",
        initialRange: LooTrendRange.threeMonths,
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

class _MarketSentimentCard extends StatefulWidget {
  const _MarketSentimentCard(this.sentiment);

  final MobileMarketSentiment sentiment;

  @override
  State<_MarketSentimentCard> createState() => _MarketSentimentCardState();
}

class _MarketSentimentCardState extends State<_MarketSentimentCard> {
  late final PageController _controller;
  var _page = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      _MarketPulseSummaryPage(widget.sentiment),
      _MarketPulseQuadrantPage(widget.sentiment),
      _MarketPulseDistributionPage(widget.sentiment),
    ];
    return LooGlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "今日市场脉搏",
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 354,
            child: PageView(
              controller: _controller,
              onPageChanged: (value) => setState(() => _page = value),
              children: pages,
            ),
          ),
          const SizedBox(height: 12),
          Center(
            child: _CarouselDots(count: pages.length, activeIndex: _page),
          ),
        ],
      ),
    );
  }
}

class _MarketPulseSummaryPage extends StatelessWidget {
  const _MarketPulseSummaryPage(this.sentiment);

  final MobileMarketSentiment sentiment;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final indexPerformances = sentiment.indexPerformances;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _PulseGaugeTile(
                label: "VIX",
                value: sentiment.vixDisplay,
                gaugeValue: _normalizeVix(sentiment.vixValue),
                change: sentiment.vixChange,
                changeDigits: 2,
                detail: sentiment.vixLevelLabel,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _PulseGaugeTile(
                label: sentiment.fgiLabel,
                value: "${sentiment.fgiScore}",
                gaugeValue: sentiment.fgiScore.toDouble(),
                change: sentiment.fgiChange,
                detail: sentiment.fgiLevelLabel,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _PulseDecisionTile(
                result: sentiment.ratingLabel,
                strategy: sentiment.strategyLabel,
                detail: sentiment.buySignalLabel,
              ),
            ),
          ],
        ),
        if (indexPerformances.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            "美股三大指数表现",
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 106,
            child: Row(
              children: [
                for (var index = 0;
                    index < indexPerformances.length;
                    index += 1) ...[
                  Expanded(
                    child: _PulsePerformanceTile(indexPerformances[index]),
                  ),
                  if (index != indexPerformances.length - 1) _PulseDivider(),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        Text(
          sentiment.quadrantLabel,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          sentiment.strategyDetail,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.bodyMedium,
        ),
      ],
    );
  }

  double _normalizeVix(double? value) {
    if (value == null) return 50;
    return ((value - 10) / 30 * 100).clamp(0, 100).toDouble();
  }
}

class _MarketPulseQuadrantPage extends StatelessWidget {
  const _MarketPulseQuadrantPage(this.sentiment);

  final MobileMarketSentiment sentiment;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("情绪区间详情", style: theme.textTheme.titleMedium),
        const SizedBox(height: 10),
        SizedBox(
          height: 205,
          child: Row(
            children: [
              Expanded(
                flex: 5,
                child: CustomPaint(
                  painter: _MarketQuadrantPainter(
                    tokens: tokens,
                    vixScore: _normalizeVix(sentiment.vixValue),
                    greedScore: sentiment.fgiScore.clamp(0, 100).toDouble(),
                  ),
                  child: const SizedBox.expand(),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 4,
                child: Column(
                  children: [
                    _PulseRangeTile(
                      label: "VIX 波动",
                      value: sentiment.vixDisplay,
                      stage: sentiment.vixLevelLabel,
                      progress: _normalizeVix(sentiment.vixValue) / 100,
                      lowLabel: "平静",
                      highLabel: "极端",
                    ),
                    const SizedBox(height: 10),
                    _PulseRangeTile(
                      label: sentiment.fgiLabel,
                      value: "${sentiment.fgiScore}",
                      stage: sentiment.fgiLevelLabel,
                      progress:
                          sentiment.fgiScore.clamp(0, 100).toDouble() / 100,
                      lowLabel: "恐惧",
                      highLabel: "贪婪",
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Text(
          sentiment.quadrantLabel,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style:
              theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 5),
        Text(
          _quadrantExplanation(sentiment),
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.bodySmall?.copyWith(
            color: tokens.mutedText,
            height: 1.35,
          ),
        ),
      ],
    );
  }

  String _quadrantExplanation(MobileMarketSentiment sentiment) {
    final vix = sentiment.vixLevelLabel;
    final fgi = sentiment.fgiLevelLabel;
    return "当前 VIX 处于$vix，${sentiment.fgiLabel}处于$fgi。象限图把“市场情绪”和“波动压力”放在一起看：情绪偏热但波动升高时，更适合等待价格确认，避免追高。";
  }

  double _normalizeVix(double? value) {
    if (value == null) return 50;
    return ((value - 10) / 30 * 100).clamp(0, 100).toDouble();
  }
}

class _PulseRangeTile extends StatelessWidget {
  const _PulseRangeTile({
    required this.label,
    required this.value,
    required this.stage,
    required this.progress,
    required this.lowLabel,
    required this.highLabel,
  });

  final String label;
  final String value;
  final String stage;
  final double progress;
  final String lowLabel;
  final String highLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    final clamped = progress.clamp(0, 1).toDouble();
    return Expanded(
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(10, 9, 10, 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(tokens.radiusMd),
          color: tokens.accentSoft,
          border: Border.all(color: tokens.cardBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelMedium,
                  ),
                ),
                Text(
                  value,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 3),
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _PulseGaugePainter(
                        value: clamped * 100,
                        tokens: tokens,
                        needleColor: theme.colorScheme.onSurface,
                      ),
                    ),
                  ),
                  Align(
                    alignment: const Alignment(0, 0.24),
                    child: Text(
                      stage,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onSurface,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Row(
              children: [
                Text(
                  lowLabel,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: tokens.mutedText,
                  ),
                ),
                const Spacer(),
                Text(
                  highLabel,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: tokens.mutedText,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 3),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: SizedBox(
                height: 5,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final markerX = (constraints.maxWidth * clamped)
                        .clamp(3.0, constraints.maxWidth - 3);
                    return Stack(
                      children: [
                        Positioned.fill(
                          child: Row(
                            children: [
                              Expanded(child: ColoredBox(color: tokens.info)),
                              Expanded(child: ColoredBox(color: tokens.accent)),
                              Expanded(
                                child: ColoredBox(color: tokens.warning),
                              ),
                              Expanded(child: ColoredBox(color: tokens.danger)),
                            ],
                          ),
                        ),
                        Positioned(
                          left: markerX - 2,
                          top: 0,
                          bottom: 0,
                          child: Container(
                            width: 4,
                            color: theme.colorScheme.onSurface,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MarketPulseDistributionPage extends StatelessWidget {
  const _MarketPulseDistributionPage(this.sentiment);

  final MobileMarketSentiment sentiment;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    final indicators = _indicatorViews();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text("真实指标详情", style: theme.textTheme.titleMedium),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                color: tokens.accentSoft,
                border: Border.all(color: tokens.cardBorder),
              ),
              child: Text(
                "${indicators.length} 项",
                style: theme.textTheme.labelSmall?.copyWith(
                  color: tokens.mutedText,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Expanded(
          child: indicators.isEmpty
              ? Center(
                  child: Text(
                    "真实指标暂不可用，等待下一次后台刷新。",
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: context.looTokens.mutedText,
                    ),
                  ),
                )
              : SingleChildScrollView(
                  child: Column(
                    children: [
                      ...indicators
                          .map((item) => _PulseIndicatorCompactRow(item)),
                      const SizedBox(height: 4),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(tokens.radiusMd),
                          color: Theme.of(context)
                              .colorScheme
                              .surface
                              .withValues(alpha: 0.45),
                          border: Border.all(
                            color: tokens.cardBorder.withValues(alpha: 0.7),
                          ),
                        ),
                        child: Text(
                          "只展示已成功获取的真实数据；不可用数据不会用占位值替代。",
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: tokens.mutedText,
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
        ),
      ],
    );
  }

  List<_PulseIndicatorView> _indicatorViews() {
    final credit = _findMacro("credit-pressure");
    final rate = _findMacro("rate-pressure");
    final secondary = sentiment.macroIndicators
        .where(
          (item) => item.id != "credit-pressure" && item.id != "rate-pressure",
        )
        .map(_PulseIndicatorView.fromMacro);
    return [
      _PulseIndicatorView(
        label: sentiment.fgiLabel,
        value: "${sentiment.fgiScore}",
        changeLabel: _formatSigned(sentiment.fgiChange, 0),
        levelLabel: sentiment.fgiLevelLabel,
        detail: sentiment.fgiSourceMode == "cnn"
            ? "CNN Fear & Greed 官方分数。"
            : "CNN FGI 暂不可用，当前为 Loo 派生情绪分。",
        sourceLabel: sentiment.fgiSourceMode == "cnn" ? "CNN GraphData" : "派生",
        score: sentiment.fgiScore.toDouble(),
      ),
      if (sentiment.vixValue != null)
        _PulseIndicatorView(
          label: "VIX",
          value: sentiment.vixDisplay,
          changeLabel: _formatSigned(sentiment.vixChange, 2),
          levelLabel: sentiment.vixLevelLabel,
          detail: "CBOE VIX 波动率指数，衡量短期波动压力。",
          sourceLabel: sentiment.sourceLabel,
          score: _normalizeVix(sentiment.vixValue),
        ),
      if (credit != null) _PulseIndicatorView.fromMacro(credit),
      if (rate != null) _PulseIndicatorView.fromMacro(rate),
      ...secondary,
    ];
  }

  MobileMarketPulseIndicator? _findMacro(String id) {
    for (final item in sentiment.macroIndicators) {
      if (item.id == id) return item;
    }
    return null;
  }

  String _formatSigned(double? value, int digits) {
    if (value == null) return "--";
    if (value.abs() < 0.005) return "0";
    final sign = value > 0 ? "+" : "";
    return "$sign${value.toStringAsFixed(digits)}";
  }

  double _normalizeVix(double? value) {
    if (value == null) return 50;
    return ((value - 10) / 30 * 100).clamp(0, 100).toDouble();
  }
}

class _PulseIndicatorView {
  const _PulseIndicatorView({
    required this.label,
    required this.value,
    required this.changeLabel,
    required this.levelLabel,
    required this.detail,
    required this.sourceLabel,
    required this.score,
  });

  final String label;
  final String value;
  final String changeLabel;
  final String levelLabel;
  final String detail;
  final String sourceLabel;
  final double? score;

  factory _PulseIndicatorView.fromMacro(MobileMarketPulseIndicator item) {
    return _PulseIndicatorView(
      label: item.label,
      value: item.value,
      changeLabel: item.changeLabel,
      levelLabel: item.levelLabel,
      detail: item.detail,
      sourceLabel: item.sourceLabel,
      score: item.score,
    );
  }
}

class _PulseIndicatorCompactRow extends StatelessWidget {
  const _PulseIndicatorCompactRow(this.item);

  final _PulseIndicatorView item;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(tokens.radiusSm),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Theme.of(context).colorScheme.surface.withValues(alpha: 0.98),
              tokens.accentSoft.withValues(alpha: 0.48),
            ],
          ),
          border: Border.all(
            color: tokens.cardBorder.withValues(alpha: 0.76),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.035),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              flex: 5,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    item.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.detail,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: tokens.mutedText,
                      height: 1.18,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 4,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Wrap(
                    spacing: 4,
                    runSpacing: 3,
                    children: [
                      _PulseMiniBadge(item.levelLabel),
                      if (item.changeLabel != "--")
                        _PulseMiniBadge(
                          item.changeLabel,
                          emphasized: true,
                        ),
                    ],
                  ),
                  if (item.sourceLabel.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      _compactSource(item.sourceLabel),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: tokens.mutedText.withValues(alpha: 0.82),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            _PulseValuePill(item.value),
          ],
        ),
      ),
    );
  }

  String _compactSource(String source) {
    return source
        .replaceAll("GraphData", "")
        .replaceAll("Yahoo Finance", "Yahoo")
        .replaceAll("FRED ", "")
        .replaceAll(RegExp(r"\s+"), " ")
        .trim();
  }
}

class _PulseValuePill extends StatelessWidget {
  const _PulseValuePill(this.value);

  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Container(
      constraints: const BoxConstraints(minWidth: 64, maxWidth: 82),
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(tokens.radiusSm),
        color: tokens.accent.withValues(alpha: 0.14),
        border: Border.all(
          color: tokens.accent.withValues(alpha: 0.26),
        ),
      ),
      child: Text(
        value,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w900,
              letterSpacing: -0.2,
            ),
      ),
    );
  }
}

class _PulseMiniBadge extends StatelessWidget {
  const _PulseMiniBadge(this.label, {this.emphasized = false});

  final String label;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: emphasized
            ? tokens.accent.withValues(alpha: 0.13)
            : Theme.of(context).colorScheme.surface.withValues(alpha: 0.72),
        border: Border.all(
          color: emphasized
              ? tokens.accent.withValues(alpha: 0.24)
              : tokens.cardBorder.withValues(alpha: 0.72),
        ),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: emphasized
                  ? Theme.of(context).colorScheme.onSurface
                  : tokens.mutedText,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
  }
}

class _CarouselDots extends StatelessWidget {
  const _CarouselDots({required this.count, required this.activeIndex});

  final int count;
  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (index) {
        final active = index == activeIndex;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: active ? 28 : 9,
          height: 9,
          decoration: BoxDecoration(
            color: active ? tokens.accent : tokens.cardBorder,
            borderRadius: BorderRadius.circular(999),
          ),
        );
      }),
    );
  }
}

class _MarketQuadrantPainter extends CustomPainter {
  const _MarketQuadrantPainter({
    required this.tokens,
    required this.vixScore,
    required this.greedScore,
  });

  final LooThemeTokens tokens;
  final double vixScore;
  final double greedScore;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final axisPaint = Paint()
      ..color = tokens.cardBorder
      ..strokeWidth = 1;
    final fillPaint = Paint()..style = PaintingStyle.fill;
    final midX = rect.width / 2;
    final midY = rect.height / 2;

    final quadrants = [
      (Rect.fromLTWH(0, 0, midX, midY), tokens.danger.withValues(alpha: 0.08)),
      (
        Rect.fromLTWH(midX, 0, midX, midY),
        tokens.warning.withValues(alpha: 0.10)
      ),
      (Rect.fromLTWH(0, midY, midX, midY), tokens.info.withValues(alpha: 0.08)),
      (
        Rect.fromLTWH(midX, midY, midX, midY),
        tokens.success.withValues(alpha: 0.08)
      ),
    ];
    for (final item in quadrants) {
      canvas.drawRect(item.$1, fillPaint..color = item.$2);
    }
    canvas.drawLine(Offset(midX, 0), Offset(midX, rect.height), axisPaint);
    canvas.drawLine(Offset(0, midY), Offset(rect.width, midY), axisPaint);
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect.deflate(1), const Radius.circular(16)),
      Paint()
        ..color = tokens.cardBorder
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );

    final point = Offset(
      (greedScore / 100).clamp(0, 1) * rect.width,
      rect.height - (vixScore / 100).clamp(0, 1) * rect.height,
    );
    canvas.drawCircle(
        point, 12, Paint()..color = tokens.accent.withValues(alpha: 0.22));
    canvas.drawCircle(point, 6, Paint()..color = tokens.accent);
    _paintText(canvas, "恐惧", Offset(8, rect.height - 22), tokens.mutedText);
    _paintText(canvas, "贪婪", Offset(rect.width - 8, rect.height - 22),
        tokens.mutedText,
        alignRight: true);
    _paintText(canvas, "高波动", const Offset(8, 8), tokens.mutedText);
  }

  void _paintText(
    Canvas canvas,
    String text,
    Offset offset,
    Color color, {
    bool alignRight = false,
  }) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final paintOffset =
        alignRight ? Offset(offset.dx - painter.width, offset.dy) : offset;
    painter.paint(canvas, paintOffset);
  }

  @override
  bool shouldRepaint(covariant _MarketQuadrantPainter oldDelegate) {
    return oldDelegate.tokens != tokens ||
        oldDelegate.vixScore != vixScore ||
        oldDelegate.greedScore != greedScore;
  }
}

class _PulseDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 84,
      margin: const EdgeInsets.symmetric(horizontal: 7),
      color: context.looTokens.cardBorder.withValues(alpha: 0.72),
    );
  }
}

class _PulseGaugeTile extends StatelessWidget {
  const _PulseGaugeTile({
    required this.label,
    required this.value,
    required this.gaugeValue,
    required this.change,
    required this.detail,
    this.changeDigits = 0,
  });

  final String label;
  final String value;
  final double gaugeValue;
  final double? change;
  final String detail;
  final int changeDigits;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Container(
      height: 118,
      padding: const EdgeInsets.fromLTRB(8, 9, 8, 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(tokens.radiusMd),
        color: tokens.accentSoft,
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Column(
        children: [
          SizedBox(
            height: 48,
            child: CustomPaint(
              painter: _PulseGaugePainter(
                value: gaugeValue.clamp(0, 100).toDouble(),
                tokens: tokens,
                needleColor: Theme.of(context).colorScheme.onSurface,
              ),
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: Text(
                    value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 5),
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 2),
          Text(
            detail,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 2),
          Text(
            _formatChange(change, changeDigits),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: _changeColor(tokens, change),
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }

  String _formatChange(double? value, int digits) {
    if (value == null) return "较昨日 --";
    if (value.abs() < 0.005) return "较昨日 0";
    final sign = value > 0 ? "+" : "";
    return "较昨日 $sign${value.toStringAsFixed(digits)}";
  }

  Color _changeColor(LooThemeTokens tokens, double? value) {
    if (value == null || value.abs() < 0.005) return tokens.mutedText;
    return value > 0 ? tokens.success : tokens.danger;
  }
}

class _PulseDecisionTile extends StatelessWidget {
  const _PulseDecisionTile({
    required this.result,
    required this.strategy,
    required this.detail,
  });

  final String result;
  final String strategy;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    return Container(
      height: 118,
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 9),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(tokens.radiusMd),
        color: tokens.accentSoft,
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("今日结果", style: theme.textTheme.labelMedium),
          const SizedBox(height: 5),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              result,
              maxLines: 1,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w900,
                letterSpacing: -0.4,
              ),
            ),
          ),
          const SizedBox(height: 6),
          DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              color: theme.colorScheme.surface.withValues(alpha: 0.48),
              border: Border.all(color: tokens.cardBorder),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Text(
                strategy,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: tokens.warning,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
          const Spacer(),
          Text(
            detail,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              color: tokens.mutedText,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _PulsePerformanceTile extends StatelessWidget {
  const _PulsePerformanceTile(this.item);

  final MobileMarketIndexPerformance item;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final positive = (item.changePct ?? 0) >= 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          item.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 7),
        SizedBox(
          height: 31,
          width: double.infinity,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              _compactValue(item.value),
              maxLines: 1,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.7,
                  ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Icon(
              positive
                  ? Icons.arrow_upward_rounded
                  : Icons.arrow_downward_rounded,
              size: 14,
              color: _changeColor(tokens, item.changePct),
            ),
            const SizedBox(width: 3),
            Expanded(
              child: Text(
                item.changeLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: _changeColor(tokens, item.changePct),
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ),
          ],
        ),
        const Spacer(),
        SizedBox(
          height: 34,
          width: double.infinity,
          child: CustomPaint(
            painter: _MiniPulseSparklinePainter(
              points: item.points,
              color: _changeColor(tokens, item.changePct),
              fillColor:
                  _changeColor(tokens, item.changePct).withValues(alpha: 0.10),
            ),
          ),
        ),
      ],
    );
  }

  Color _changeColor(LooThemeTokens tokens, double? value) {
    if (value == null || value.abs() < 0.005) return tokens.mutedText;
    return value > 0 ? tokens.success : tokens.danger;
  }

  String _compactValue(String value) {
    final cleaned = value.replaceAll(",", "");
    final numeric = double.tryParse(cleaned);
    if (numeric == null || numeric.abs() < 10000) return value;
    return "${(numeric / 1000).toStringAsFixed(1)}k";
  }
}

class _PulseGaugePainter extends CustomPainter {
  const _PulseGaugePainter({
    required this.value,
    required this.tokens,
    required this.needleColor,
  });

  final double value;
  final LooThemeTokens tokens;
  final Color needleColor;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = math.max(5.0, size.width * 0.08);
    final rect = Rect.fromLTWH(
      stroke / 2,
      stroke / 2 + 4,
      size.width - stroke,
      (size.height - stroke) * 1.58,
    );
    const start = math.pi;
    const sweep = math.pi;
    final background = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = tokens.cardBorder.withValues(alpha: 0.55);
    final progress = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        startAngle: math.pi,
        endAngle: math.pi * 2,
        colors: [
          tokens.danger,
          tokens.warning,
          tokens.accent,
          tokens.success,
        ],
      ).createShader(rect);

    canvas.drawArc(rect, start, sweep, false, background);
    canvas.drawArc(rect, start, sweep * (value / 100), false, progress);

    final angle = start + sweep * (value / 100);
    final center = rect.center;
    final radius = rect.width / 2;
    final needleEnd = Offset(
      center.dx + math.cos(angle) * radius * 0.84,
      center.dy + math.sin(angle) * radius * 0.84,
    );
    canvas.drawLine(
      center,
      needleEnd,
      Paint()
        ..color = needleColor.withValues(alpha: 0.88)
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(center, 3.5, Paint()..color = needleColor);
  }

  @override
  bool shouldRepaint(covariant _PulseGaugePainter oldDelegate) {
    return oldDelegate.value != value ||
        oldDelegate.tokens != tokens ||
        oldDelegate.needleColor != needleColor;
  }
}

class _MiniPulseSparklinePainter extends CustomPainter {
  const _MiniPulseSparklinePainter({
    required this.points,
    required this.color,
    required this.fillColor,
  });

  final List<double> points;
  final Color color;
  final Color fillColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final minValue = points.reduce(math.min);
    final maxValue = points.reduce(math.max);
    final span = math.max(1, maxValue - minValue);
    final path = Path();
    for (var i = 0; i < points.length; i += 1) {
      final x = points.length == 1 ? 0 : size.width * i / (points.length - 1);
      final y = size.height -
          ((points[i] - minValue) / span).clamp(0, 1) * (size.height - 4) -
          2;
      if (i == 0) {
        path.moveTo(x.toDouble(), y.toDouble());
      } else {
        path.lineTo(x.toDouble(), y.toDouble());
      }
    }
    final fillPath = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(fillPath, Paint()..color = fillColor);
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _MiniPulseSparklinePainter oldDelegate) {
    return oldDelegate.points != points ||
        oldDelegate.color != color ||
        oldDelegate.fillColor != fillColor;
  }
}

class _RecommendationCard extends StatelessWidget {
  const _RecommendationCard(
    this.theme,
    this.reason, {
    required this.onTap,
  });

  final String theme;
  final String reason;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final appTheme = Theme.of(context);
    final tokens = context.looTokens;
    final advice = _recommendationAdvice(theme, reason);

    return LooGlassCard(
      onTap: onTap,
      padding: EdgeInsets.all(tokens.gapSm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text("Loo皇谕令", style: appTheme.textTheme.titleSmall),
              ),
              Icon(
                Icons.auto_awesome_rounded,
                size: 16,
                color: tokens.accent,
              ),
            ],
          ),
          SizedBox(height: tokens.gapSm),
          for (var index = 0; index < advice.length; index++) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 18,
                  height: 18,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: index == 0 ? tokens.accent : tokens.accentSoft,
                    shape: BoxShape.circle,
                    border: Border.all(color: tokens.cardBorder),
                  ),
                  child: Text(
                    "${index + 1}",
                    style: appTheme.textTheme.labelSmall?.copyWith(
                      color: index == 0
                          ? Theme.of(context).colorScheme.onPrimary
                          : tokens.accent,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                SizedBox(width: tokens.gapXs),
                Expanded(
                  child: Text(
                    advice[index],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: appTheme.textTheme.bodySmall?.copyWith(
                      color: index == 0
                          ? Theme.of(context).colorScheme.onSurface
                          : tokens.mutedText,
                      fontWeight:
                          index == 0 ? FontWeight.w900 : FontWeight.w700,
                      height: 1.12,
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: tokens.gapXs),
          ],
          const Spacer(),
          Padding(
            padding: const EdgeInsets.only(left: 6),
            child: Row(
              children: [
                Icon(Icons.tune_rounded, size: 13, color: tokens.accent),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    "按谕令查看推荐 →",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: appTheme.textTheme.labelSmall?.copyWith(
                      color: tokens.accent,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<String> _recommendationAdvice(String theme, String reason) {
    final source = "$theme $reason";
    final advice = <String>[];
    void add(String value) {
      final normalized = value.trim();
      if (normalized.isEmpty || advice.contains(normalized)) return;
      advice.add(normalized);
    }

    add(theme);
    if (source.contains("美股") || source.toUpperCase().contains("US")) {
      add("暂停继续加码美股");
    }
    if (source.contains("现金")) {
      add("保留现金缓冲");
    }
    if (source.contains("税")) {
      add("优先检查税务位置");
    }
    if (source.contains("债") || source.contains("固定收益")) {
      add("补足防守型资产");
    }
    if (source.contains("科技")) {
      add("控制科技仓位集中");
    }
    if (source.contains("能源")) {
      add("单独评估能源敞口");
    }
    add("优先补齐组合短板");
    add("等待更好买入窗口");
    return advice.take(3).toList();
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return LooStatePanel(
      title: "Loo国财政部暂时连不上",
      message: message,
      actionLabel: "重新召集",
      onAction: onRetry,
    );
  }
}
