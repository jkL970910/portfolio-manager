import "dart:math" as math;

import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../app/mobile_routes.dart";
import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/loo_minister_context_models.dart";
import "../../shared/data/mobile_models.dart";
import "../data/mobile_portfolio_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "../../shared/presentation/loo_minister_scope.dart";
import "detail_state_widgets.dart";

class AccountDetailPage extends StatefulWidget {
  const AccountDetailPage({
    required this.apiClient,
    required this.accountId,
    required this.fallbackTitle,
    super.key,
  });

  final LooApiClient apiClient;
  final String accountId;
  final String fallbackTitle;

  @override
  State<AccountDetailPage> createState() => _AccountDetailPageState();
}

class _AccountDetailPageState extends State<AccountDetailPage> {
  late Future<MobileAccountDetailSnapshot?> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  Future<MobileAccountDetailSnapshot?> _loadSnapshot() async {
    final response =
        await widget.apiClient.getPortfolioAccountDetail(widget.accountId);
    final data = response["data"];
    if (data == null) {
      return null;
    }
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("账户详情格式不正确。");
    }

    final snapshot = MobileAccountDetailSnapshot.fromJson(data);
    if (mounted) {
      LooMinisterScope.report(
        context,
        snapshot.toMinisterContext(
          accountId: widget.accountId,
          asOf: DateTime.now().toUtc().toIso8601String(),
        ),
      );
    }
    return snapshot;
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.fallbackTitle),
        actions: [
          IconButton(
            tooltip: "编辑账户",
            onPressed: _openEditAccountSheet,
            icon: const Icon(Icons.edit_outlined),
          ),
          IconButton(
              tooltip: "删除账户",
              onPressed: _openAccountCleanupSheet,
              icon: const Icon(Icons.delete_outline)),
        ],
      ),
      body: FutureBuilder<MobileAccountDetailSnapshot?>(
        future: _snapshot,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LooPageGradient(
              child: Center(child: CircularProgressIndicator()),
            );
          }

          if (snapshot.hasError) {
            return LooPageGradient(
              child: DetailErrorState(
                title: "账户详情暂时打不开",
                message: snapshot.error.toString(),
                onRetry: _refresh,
              ),
            );
          }

          if (!snapshot.hasData) {
            return LooPageGradient(
              child: DetailNotFoundState(
                title: "没有找到这个账户",
                message: "这个账户可能已被删除、合并，或当前登录身份没有访问权限。",
                onRetry: _refresh,
              ),
            );
          }

          final data = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: LooPageGradient(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                children: [
                  _SummaryCard(
                    data,
                    onOpenShare: () => _openPortfolioShare(data),
                    onOpenHealth: () => _openHealthScore(data),
                  ),
                  const SizedBox(height: 12),
                  if (data.accountValueChart != null ||
                      data.performance.isNotEmpty) ...[
                    _AccountTrendCard(
                      chart: data.accountValueChart,
                      fallbackPoints: data.performance,
                    ),
                    const SizedBox(height: 12),
                  ],
                  const SizedBox(height: 4),
                  _AccountHoldingsPreview(
                    holdings: data.holdings,
                    onOpenHolding: _openHoldingDetail,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _openHoldingDetail(MobileHoldingCard holding) {
    context.push(
      MobileRoutes.securityDetail(
        symbol: holding.symbol,
        securityId: holding.securityId.isEmpty ? null : holding.securityId,
        exchange: holding.exchange.isEmpty ? null : holding.exchange,
        currency: holding.currency.isEmpty ? null : holding.currency,
        holdingId: holding.id,
      ),
    );
  }

  void _openHealthScore(MobileAccountDetailSnapshot data) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => _AccountHealthSheet(
        data: data,
        onOpenFullHealth: () {
          Navigator.of(context).pop();
          context
              .push(MobileRoutes.portfolioHealthForAccount(widget.accountId));
        },
      ),
    );
  }

  void _openPortfolioShare(MobileAccountDetailSnapshot data) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => _AccountPortfolioShareSheet(data: data),
    );
  }

  Future<void> _openEditAccountSheet() async {
    final current = await _snapshot;
    if (!mounted || current == null) {
      return;
    }

    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _EditAccountSheet(
        apiClient: widget.apiClient,
        accountId: widget.accountId,
        account: current,
      ),
    );
    if (updated == true && mounted) {
      _refresh();
    }
  }

  Future<void> _openAccountCleanupSheet() async {
    final current = await _snapshot;
    if (!mounted || current == null) {
      return;
    }
    final changed = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => _AccountCleanupSheet(
        apiClient: widget.apiClient,
        accountId: widget.accountId,
        account: current,
      ),
    );
    if (changed == true && mounted) {
      Navigator.of(context).pop(true);
    }
  }
}

class _AccountCleanupSheet extends StatefulWidget {
  const _AccountCleanupSheet({
    required this.apiClient,
    required this.accountId,
    required this.account,
  });

  final LooApiClient apiClient;
  final String accountId;
  final MobileAccountDetailSnapshot account;

  @override
  State<_AccountCleanupSheet> createState() => _AccountCleanupSheetState();
}

class _AccountCleanupSheetState extends State<_AccountCleanupSheet> {
  late Future<List<MobileAccountCard>> _accountsFuture;
  String? _targetAccountId;
  String? _error;
  var _merging = false;
  var _deleting = false;

  @override
  void initState() {
    super.initState();
    _accountsFuture = _loadAccounts();
  }

  Future<List<MobileAccountCard>> _loadAccounts() async {
    final response = await widget.apiClient.getPortfolioOverview();
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("账户列表格式不正确。");
    }
    return MobilePortfolioSnapshot.fromJson(data)
        .accounts
        .where((account) => account.id != widget.accountId)
        .toList();
  }

  Future<void> _mergeIntoTarget() async {
    final targetAccountId = _targetAccountId;
    if (targetAccountId == null || targetAccountId.isEmpty) {
      setState(() => _error = "请先选择要合并到的目标账户。");
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("合并账户？"),
        content: Text(
          "会把 ${widget.account.name} 的 ${widget.account.holdings.length} 个持仓合并到目标账户，然后删除当前重复账户。相同标的会合并数量和市值。",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text("取消"),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text("确认合并"),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    setState(() {
      _merging = true;
      _error = null;
    });
    try {
      await widget.apiClient.mergePortfolioAccounts(
        sourceAccountId: widget.accountId,
        targetAccountId: targetAccountId,
      );
      if (mounted) {
        Navigator.of(context).pop(true);
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _merging = false;
        });
      }
    }
  }

  Future<void> _deleteAccount({required bool force}) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(force ? "强制删除账户及持仓？" : "安全删除空账户？"),
        content: Text(
          force
              ? "这会删除该账户和账户内全部 ${widget.account.holdings.length} 个持仓。这个操作不能撤销，适合清理重复手动导入账户。"
              : "只有账户内没有持仓时才能删除。若账户仍有持仓，请先合并、删除持仓，或使用强制删除。",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text("取消"),
          ),
          FilledButton.tonal(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(force ? "强制删除" : "删除空账户"),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    setState(() {
      _deleting = true;
      _error = null;
    });
    try {
      await widget.apiClient.deletePortfolioAccount(
        widget.accountId,
        force: force,
      );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _deleting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          8,
          20,
          20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("账户清理", style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(
                "${widget.account.name} · ${widget.account.holdings.length} 个持仓",
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.mutedText,
                    ),
              ),
              const SizedBox(height: 16),
              _CleanupActionTile(
                title: "安全删除空账户",
                detail: _deleting ? "删除中..." : "仅当账户内没有持仓时删除。适合清理空壳账户。",
                icon: Icons.delete_outline_rounded,
                onTap: _deleting ? null : () => _deleteAccount(force: false),
              ),
              const SizedBox(height: 10),
              _CleanupActionTile(
                title: "强制删除账户及持仓",
                detail:
                    _deleting ? "正在删除账户和持仓..." : "直接删除当前账户和全部持仓。适合清理重复手动导入账户。",
                icon: Icons.warning_amber_rounded,
                destructive: true,
                trailing: _deleting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : null,
                onTap: _deleting ? null : () => _deleteAccount(force: true),
              ),
              const SizedBox(height: 18),
              Text("合并到账户", style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              FutureBuilder<List<MobileAccountCard>>(
                future: _accountsFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return Text(
                      snapshot.error.toString(),
                      style:
                          TextStyle(color: Theme.of(context).colorScheme.error),
                    );
                  }
                  final accounts = snapshot.data ?? const <MobileAccountCard>[];
                  if (accounts.isEmpty) {
                    return Text(
                      "没有可合并的目标账户。",
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: tokens.mutedText,
                          ),
                    );
                  }
                  return Column(
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue: _targetAccountId,
                        decoration: const InputDecoration(labelText: "目标账户"),
                        items: accounts
                            .map(
                              (account) => DropdownMenuItem(
                                value: account.id,
                                child: Text(
                                  "${account.name} · ${account.value}",
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: _merging
                            ? null
                            : (value) =>
                                setState(() => _targetAccountId = value),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _merging ? null : _mergeIntoTarget,
                          icon: _merging
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.merge_type_rounded),
                          label: Text(_merging ? "合并中..." : "确认合并"),
                        ),
                      ),
                    ],
                  );
                },
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _CleanupActionTile extends StatelessWidget {
  const _CleanupActionTile({
    required this.title,
    required this.detail,
    required this.icon,
    required this.onTap,
    this.destructive = false,
    this.trailing,
  });

  final String title;
  final String detail;
  final IconData icon;
  final Future<void> Function()? onTap;
  final bool destructive;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final color = destructive
        ? Theme.of(context).colorScheme.error
        : Theme.of(context).colorScheme.onSurface;
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: tokens.cardBorder),
          color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.16),
        ),
        child: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: color,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    detail,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: tokens.mutedText,
                        ),
                  ),
                ],
              ),
            ),
            trailing ?? const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    );
  }
}

class MobileAccountDetailSnapshot {
  const MobileAccountDetailSnapshot({
    required this.name,
    required this.typeId,
    required this.institution,
    required this.currency,
    required this.value,
    required this.gainLoss,
    required this.portfolioShare,
    required this.room,
    required this.subtitle,
    required this.summaryPoints,
    required this.performance,
    required this.accountValueChart,
    required this.allocation,
    required this.healthScore,
    required this.facts,
    required this.holdings,
  });

  final String name;
  final String typeId;
  final String institution;
  final String currency;
  final String value;
  final String gainLoss;
  final String portfolioShare;
  final String room;
  final String subtitle;
  final List<String> summaryPoints;
  final List<MobileAccountPerformancePoint> performance;
  final MobileChartSeries? accountValueChart;
  final List<MobileAllocationPoint> allocation;
  final MobileAccountHealthScore healthScore;
  final List<MobileFact> facts;
  final List<MobileHoldingCard> holdings;

  LooMinisterPageContext toMinisterContext({
    required String accountId,
    required String asOf,
  }) {
    final chart = accountValueChart;
    return LooMinisterPageContext(
      page: "account-detail",
      title: "$name账户详情",
      asOf: asOf,
      displayCurrency: currency.isEmpty ? "CAD" : currency,
      subject: LooMinisterSubject(accountId: accountId),
      dataFreshness: LooMinisterDataFreshness(
        chartFreshness: _toMinisterChartFreshness(chart?.freshness.status),
        sourceMode: _toMinisterSourceMode(chart?.sourceMode),
      ),
      facts: [
        LooMinisterFact(id: "account-value", label: "账户市值", value: value),
        if (gainLoss.isNotEmpty)
          LooMinisterFact(id: "gain-loss", label: "账户盈亏", value: gainLoss),
        if (portfolioShare.isNotEmpty)
          LooMinisterFact(
            id: "portfolio-share",
            label: "组合占比",
            value: portfolioShare,
          ),
        LooMinisterFact(
          id: "health-score",
          label: "账户健康分",
          value: healthScore.score,
          detail: healthScore.status,
          source: "analysis-cache",
        ),
        LooMinisterFact(
          id: "holding-count",
          label: "持仓数量",
          value: "${holdings.length} 个",
        ),
        if (chart != null)
          LooMinisterFact(
            id: "account-value-chart",
            label: chart.title,
            value: chart.freshness.label,
            detail: chart.freshness.detail,
            source: "portfolio-data",
          ),
        ...allocation.take(5).map(
              (item) => LooMinisterFact(
                id: "allocation-${_slug(item.name)}",
                label: "账户配置 ${item.name}",
                value: item.value,
                source: "analysis-cache",
              ),
            ),
        ...facts.take(5).map(
              (fact) => LooMinisterFact(
                id: "fact-${_slug(fact.label)}",
                label: fact.label,
                value: fact.value,
                detail: fact.detail,
              ),
            ),
      ],
      warnings: [
        ...summaryPoints.take(4),
        ...healthScore.highlights.take(3),
        ...healthScore.actions.take(3),
        if (chart != null && chart.notes.isNotEmpty) ...chart.notes.take(3),
      ],
      allowedActions: const [
        LooMinisterSuggestedAction(
          id: "open-account-health",
          label: "查看账户健康巡查",
          actionType: "navigate",
          target: {"page": "portfolio-health"},
        ),
        LooMinisterSuggestedAction(
          id: "run-account-analysis",
          label: "运行智能账户快扫",
          actionType: "run-analysis",
          target: {"scope": "account"},
          requiresConfirmation: true,
        ),
      ],
    );
  }

  factory MobileAccountDetailSnapshot.fromJson(Map<String, dynamic> json) {
    final account = json["account"];
    final accountData =
        account is Map<String, dynamic> ? account : const <String, dynamic>{};

    return MobileAccountDetailSnapshot(
      name: accountData["name"] as String? ?? "未知账户",
      typeId: accountData["typeId"] as String? ?? "Taxable",
      institution: accountData["institution"] as String? ?? "",
      currency: accountData["currency"] as String? ?? "CAD",
      value: accountData["value"] as String? ?? "--",
      gainLoss: accountData["gainLoss"] as String? ?? "",
      portfolioShare: accountData["portfolioShare"] as String? ?? "",
      room: accountData["room"] as String? ?? "",
      subtitle: [
        accountData["typeLabel"] as String? ?? "",
        accountData["institution"] as String? ?? "",
      ].where((item) => item.isNotEmpty).join(" · "),
      summaryPoints: (accountData["summaryPoints"] as List?)
              ?.whereType<String>()
              .toList() ??
          const [],
      performance: readJsonList(json, "performance")
          .map(MobileAccountPerformancePoint.fromJson)
          .toList(),
      accountValueChart: MobileChartSeries.fromJson(
        (json["chartSeries"] is Map<String, dynamic>
            ? json["chartSeries"] as Map<String, dynamic>
            : const <String, dynamic>{})["accountValue"],
      ),
      allocation: readJsonList(json, "allocation")
          .map(MobileAllocationPoint.fromJson)
          .toList(),
      healthScore: MobileAccountHealthScore.fromJson(json["healthScore"]),
      facts: readJsonList(json, "facts").map(MobileFact.fromJson).toList(),
      holdings: readJsonList(json, "holdings")
          .map(MobileHoldingCard.fromJson)
          .toList(),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard(
    this.data, {
    required this.onOpenShare,
    required this.onOpenHealth,
  });

  final MobileAccountDetailSnapshot data;
  final VoidCallback onOpenShare;
  final VoidCallback onOpenHealth;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);
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
                    Text(data.name,
                        style: Theme.of(context).textTheme.headlineMedium),
                    SizedBox(height: tokens.gapXs),
                    Text(
                      data.subtitle.isEmpty ? "账户详情" : data.subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: tokens.mutedText,
                          ),
                    ),
                  ],
                ),
              ),
              SizedBox(width: tokens.gapMd),
              Flexible(
                flex: 0,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 190),
                  child: Text(
                    data.value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: tokens.gapMd),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (data.gainLoss.isNotEmpty) _MiniPill(data.gainLoss),
              if (data.portfolioShare.isNotEmpty)
                _MiniPill("组合 ${data.portfolioShare}"),
              if (data.room.isNotEmpty) _MiniPill(data.room),
              _MiniPill("持仓 ${data.holdings.length} 个"),
            ],
          ),
          SizedBox(height: tokens.gapLg),
          _AccountMetricStrip(
            data,
            onOpenShare: onOpenShare,
            onOpenHealth: onOpenHealth,
          ),
        ],
      ),
    );
  }
}

class MobileAccountPerformancePoint {
  const MobileAccountPerformancePoint({
    required this.label,
    required this.displayValue,
    required this.chartValue,
  });

  final String label;
  final String displayValue;
  final double chartValue;

  factory MobileAccountPerformancePoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];
    return MobileAccountPerformancePoint(
      label: json["label"] as String? ?? "未知日期",
      displayValue: rawValue is num
          ? rawValue.toStringAsFixed(2)
          : rawValue?.toString() ?? "--",
      chartValue: rawValue is num ? rawValue.toDouble() : 0,
    );
  }
}

class _AccountTrendCard extends StatelessWidget {
  const _AccountTrendCard({
    required this.chart,
    required this.fallbackPoints,
  });

  final MobileChartSeries? chart;
  final List<MobileAccountPerformancePoint> fallbackPoints;

  @override
  Widget build(BuildContext context) {
    final points = chart?.points
            .map((point) => AccountTrendPoint(
                  label: point.label,
                  displayValue: point.displayValue,
                  chartValue: point.value,
                  rawDate: DateTime.tryParse(point.rawDate ?? ""),
                ))
            .toList() ??
        fallbackPoints
            .map((point) => AccountTrendPoint(
                  label: point.label,
                  displayValue: point.displayValue,
                  chartValue: point.chartValue,
                  rawDate: null,
                ))
            .toList();

    if (points.length < 2) {
      return const SizedBox.shrink();
    }

    return LooGlassCard(
      child: LooTrendChart(
        title: chart?.title ?? "账户资产走势",
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

class AccountTrendPoint {
  const AccountTrendPoint({
    required this.label,
    required this.displayValue,
    required this.chartValue,
    required this.rawDate,
  });

  final String label;
  final String displayValue;
  final double chartValue;
  final DateTime? rawDate;
}

class MobileAllocationPoint {
  const MobileAllocationPoint({
    required this.name,
    required this.value,
    required this.rawValue,
  });

  final String name;
  final String value;
  final double rawValue;

  factory MobileAllocationPoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];
    final numericValue = rawValue is num ? rawValue.toDouble() : 0.0;

    return MobileAllocationPoint(
      name: json["name"] as String? ?? "未知配置",
      value: rawValue is num ? "${rawValue.toStringAsFixed(1)}%" : "--",
      rawValue: numericValue,
    );
  }
}

class MobileAccountHealthScore {
  const MobileAccountHealthScore({
    required this.score,
    required this.status,
    required this.radar,
    required this.highlights,
    required this.actions,
  });

  final String score;
  final String status;
  final List<MobileAccountHealthRadarPoint> radar;
  final List<String> highlights;
  final List<String> actions;

  factory MobileAccountHealthScore.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};

    return MobileAccountHealthScore(
      score: "${json["score"] ?? "--"} 分",
      status: json["status"] as String? ?? "待评估",
      radar: readJsonList(json, "radar")
          .map(MobileAccountHealthRadarPoint.fromJson)
          .toList(),
      highlights: (json["highlights"] as List?)?.whereType<String>().toList() ??
          const [],
      actions: (json["actionQueue"] as List?)?.whereType<String>().toList() ??
          const [],
    );
  }
}

class MobileAccountHealthRadarPoint {
  const MobileAccountHealthRadarPoint({
    required this.dimension,
    required this.value,
  });

  final String dimension;
  final double value;

  factory MobileAccountHealthRadarPoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];
    return MobileAccountHealthRadarPoint(
      dimension: json["dimension"] as String? ?? "未知维度",
      value: rawValue is num ? rawValue.toDouble().clamp(0, 100) : 0,
    );
  }
}

String _toMinisterChartFreshness(String? value) {
  return switch (value) {
    "fresh" => "fresh",
    "stale" => "stale",
    "fallback" => "fallback",
    "reference" => "reference",
    _ => "unknown",
  };
}

String _toMinisterSourceMode(String? value) {
  return switch (value) {
    "local" => "local",
    "cached-external" => "cached-external",
    "live-external" => "live-external",
    "reference" => "reference",
    _ => "local",
  };
}

String _slug(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r"[^a-z0-9\u4e00-\u9fa5]+"), "-")
      .replaceAll(RegExp(r"^-+|-+$"), "");
}

class _AccountMetricStrip extends StatelessWidget {
  const _AccountMetricStrip(
    this.data, {
    required this.onOpenShare,
    required this.onOpenHealth,
  });

  final MobileAccountDetailSnapshot data;
  final VoidCallback onOpenShare;
  final VoidCallback onOpenHealth;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final metrics = [
      _MetricDatum("账户盈亏", _shortGainLoss(data.gainLoss)),
      _MetricDatum(
        "组合占比",
        _portfolioShareValue(data.portfolioShare),
        onTap: onOpenShare,
      ),
      _MetricDatum(
        "健康分",
        data.healthScore.score.replaceAll(" 分", ""),
        onTap: onOpenHealth,
      ),
    ].where((item) => item.value.isNotEmpty && item.value != "--").toList();

    if (metrics.isEmpty) return const SizedBox.shrink();

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(tokens.radiusLg),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Padding(
        padding: EdgeInsets.all(tokens.gapMd),
        child: Row(
          children: [
            for (var index = 0; index < metrics.take(3).length; index++) ...[
              if (index > 0) SizedBox(width: tokens.gapSm),
              Expanded(child: _MetricCard(metrics[index])),
            ],
          ],
        ),
      ),
    );
  }

  String _shortGainLoss(String value) {
    final parts = value.split(RegExp(r"\s+"));
    return parts.isEmpty ? value : parts.first.trim();
  }

  String _portfolioShareValue(String value) {
    final percent = RegExp(r"[-+]?\d+(?:\.\d+)?%").firstMatch(value);
    return percent?.group(0) ?? value.replaceAll("大约占整个组合", "").trim();
  }
}

class _MetricDatum {
  const _MetricDatum(this.label, this.value, {this.onTap});

  final String label;
  final String value;
  final VoidCallback? onTap;
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(this.metric);

  final _MetricDatum metric;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                metric.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.mutedText,
                    ),
              ),
            ),
            if (metric.onTap != null)
              Icon(Icons.open_in_new_rounded,
                  size: 14, color: tokens.mutedText),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          metric.value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleMedium,
        ),
      ],
    );

    if (metric.onTap == null) {
      return content;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(tokens.radiusMd),
        onTap: metric.onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
          child: content,
        ),
      ),
    );
  }
}

class _AccountHoldingsPreview extends StatefulWidget {
  const _AccountHoldingsPreview({
    required this.holdings,
    required this.onOpenHolding,
  });

  final List<MobileHoldingCard> holdings;
  final ValueChanged<MobileHoldingCard> onOpenHolding;

  @override
  State<_AccountHoldingsPreview> createState() =>
      _AccountHoldingsPreviewState();
}

class _AccountHoldingsPreviewState extends State<_AccountHoldingsPreview> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final shownHoldings =
        _expanded ? widget.holdings : widget.holdings.take(5).toList();
    final canExpand = widget.holdings.length > 5;

    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            title: "账户内持仓",
            trailing: _expanded || !canExpand
                ? "全部 ${widget.holdings.length} 个"
                : "预览 5/${widget.holdings.length}",
          ),
          SizedBox(height: tokens.gapSm),
          if (canExpand)
            _HoldingsViewToggle(
              expanded: _expanded,
              total: widget.holdings.length,
              onChanged: (expanded) => setState(() => _expanded = expanded),
            )
          else
            Text(
              "点击单项查看这笔仓位详情。",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.mutedText,
                  ),
            ),
          SizedBox(height: tokens.gapMd),
          if (shownHoldings.isEmpty)
            Text(
              "这个账户还没有持仓。",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.mutedText,
                  ),
            )
          else
            ...shownHoldings.map(
              (holding) => _CompactHoldingRow(
                holding,
                onTap: () => widget.onOpenHolding(holding),
              ),
            ),
        ],
      ),
    );
  }
}

class _HoldingsViewToggle extends StatelessWidget {
  const _HoldingsViewToggle({
    required this.expanded,
    required this.total,
    required this.onChanged,
  });

  final bool expanded;
  final int total;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _TogglePill(
            label: "预览 5 个",
            selected: !expanded,
            onTap: () => onChanged(false),
          ),
          _TogglePill(
            label: "全部 $total 个",
            selected: expanded,
            onTap: () => onChanged(true),
          ),
        ],
      ),
    );
  }
}

class _TogglePill extends StatelessWidget {
  const _TogglePill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: selected ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? tokens.accent.withValues(alpha: 0.24)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: selected ? tokens.accent : tokens.mutedText,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              ),
        ),
      ),
    );
  }
}

class _CompactHoldingRow extends StatelessWidget {
  const _CompactHoldingRow(this.holding, {required this.onTap});

  final MobileHoldingCard holding;
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
                    "${holding.symbol} · ${holding.name}",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  if (holding.weight.isNotEmpty) ...[
                    SizedBox(height: tokens.gapXs),
                    Text(
                      holding.weight,
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
                Text(holding.value,
                    style: Theme.of(context).textTheme.titleSmall),
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

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.trailing});

  final String title;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
        if (trailing != null && trailing!.isNotEmpty)
          Text(
            trailing!,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: context.looTokens.accent,
                ),
          ),
      ],
    );
  }
}

class _MiniPill extends StatelessWidget {
  const _MiniPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.38),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelMedium,
        ),
      ),
    );
  }
}

class _AccountPortfolioShareSheet extends StatelessWidget {
  const _AccountPortfolioShareSheet({required this.data});

  final MobileAccountDetailSnapshot data;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    final allocations = data.allocation.take(5).toList();
    final share = _parsePercent(data.portfolioShare);
    final shareSlices = share > 0
        ? [
            _AccountShareSlice(
              label: data.name,
              value: share.clamp(0, 100),
              displayValue: "${share.clamp(0, 100).toStringAsFixed(1)}%",
            ),
            _AccountShareSlice(
              label: "其他账户",
              value: math.max(0, 100 - share),
              displayValue: "${math.max(0, 100 - share).toStringAsFixed(1)}%",
            ),
          ]
        : const <_AccountShareSlice>[];

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
              Text("组合占比", style: theme.textTheme.titleLarge),
              SizedBox(height: tokens.gapSm),
              Text(
                data.portfolioShare.isEmpty ? "暂无组合占比" : data.portfolioShare,
                style: theme.textTheme.displaySmall,
              ),
              SizedBox(height: tokens.gapXs),
              Text(
                "表示这个账户在整个组合中的权重。",
                style: theme.textTheme.bodySmall?.copyWith(
                  color: tokens.mutedText,
                ),
              ),
              if (shareSlices.isNotEmpty) ...[
                SizedBox(height: tokens.gapLg),
                Center(child: _AccountShareDonutChart(slices: shareSlices)),
                SizedBox(height: tokens.gapMd),
                ...shareSlices.map(
                  (slice) => Padding(
                    padding: EdgeInsets.only(bottom: tokens.gapSm),
                    child: _AccountShareLegendRow(slice),
                  ),
                ),
              ],
              if (allocations.isNotEmpty) ...[
                SizedBox(height: tokens.gapLg),
                Text("账户内配置", style: theme.textTheme.titleMedium),
                SizedBox(height: tokens.gapSm),
                ...allocations.map(
                  (item) => Padding(
                    padding: EdgeInsets.only(bottom: tokens.gapSm),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.name,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Text(
                          item.value,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: tokens.mutedText,
                          ),
                        ),
                      ],
                    ),
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

double _parsePercent(String value) {
  final match = RegExp(r"[-+]?\d+(?:\.\d+)?").firstMatch(value);
  return double.tryParse(match?.group(0) ?? "") ?? 0;
}

class _AccountShareSlice {
  const _AccountShareSlice({
    required this.label,
    required this.value,
    required this.displayValue,
  });

  final String label;
  final double value;
  final String displayValue;
}

class _AccountShareDonutChart extends StatelessWidget {
  const _AccountShareDonutChart({required this.slices});

  final List<_AccountShareSlice> slices;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final total = slices.fold<double>(0, (sum, slice) => sum + slice.value);
    return SizedBox(
      width: 172,
      height: 172,
      child: CustomPaint(
        painter: _AccountShareDonutPainter(
          slices: slices,
          total: total <= 0 ? 1 : total,
          tokens: tokens,
        ),
        child: Center(
          child: Text(
            slices.first.displayValue,
            style: Theme.of(context).textTheme.titleLarge,
          ),
        ),
      ),
    );
  }
}

class _AccountShareDonutPainter extends CustomPainter {
  const _AccountShareDonutPainter({
    required this.slices,
    required this.total,
    required this.tokens,
  });

  final List<_AccountShareSlice> slices;
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
      paint.color = _accountShareColor(tokens, index);
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
  bool shouldRepaint(covariant _AccountShareDonutPainter oldDelegate) =>
      oldDelegate.slices != slices ||
      oldDelegate.total != total ||
      oldDelegate.tokens != tokens;
}

class _AccountShareLegendRow extends StatelessWidget {
  const _AccountShareLegendRow(this.slice);

  final _AccountShareSlice slice;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: _accountShareColor(tokens, slice.label == "其他账户" ? 1 : 0),
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
          slice.displayValue,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.mutedText,
              ),
        ),
      ],
    );
  }
}

Color _accountShareColor(LooThemeTokens tokens, int index) {
  final colors = [
    tokens.accent,
    tokens.cardBorder.withValues(alpha: 0.92),
  ];
  return colors[index % colors.length];
}

class _AccountHealthSheet extends StatelessWidget {
  const _AccountHealthSheet({
    required this.data,
    required this.onOpenFullHealth,
  });

  final MobileAccountDetailSnapshot data;
  final VoidCallback onOpenFullHealth;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);

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
              Text("账户健康分", style: theme.textTheme.titleLarge),
              SizedBox(height: tokens.gapSm),
              Text(
                data.healthScore.score,
                style: theme.textTheme.displaySmall,
              ),
              SizedBox(height: tokens.gapXs),
              Text(
                data.healthScore.status,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: tokens.mutedText,
                ),
              ),
              SizedBox(height: tokens.gapMd),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: onOpenFullHealth,
                  icon: const Icon(Icons.chevron_right_rounded),
                  label: const Text("健康分析"),
                ),
              ),
              if (data.healthScore.radar.isNotEmpty) ...[
                SizedBox(height: tokens.gapLg),
                Center(
                  child: SizedBox(
                    width: math.min(MediaQuery.sizeOf(context).width - 48, 320),
                    child: LooRadarChart(
                      height: 230,
                      points: data.healthScore.radar
                          .map(
                            (point) => LooRadarPoint(
                              label: point.dimension,
                              value: point.value,
                            ),
                          )
                          .toList(),
                    ),
                  ),
                ),
              ],
              if (data.healthScore.highlights.isNotEmpty) ...[
                SizedBox(height: tokens.gapLg),
                Text("重点提示", style: theme.textTheme.titleMedium),
                SizedBox(height: tokens.gapSm),
                ...data.healthScore.highlights.take(3).map(
                      (item) => Padding(
                        padding: EdgeInsets.only(bottom: tokens.gapSm),
                        child: Text("• $item"),
                      ),
                    ),
              ],
              if (data.healthScore.actions.isNotEmpty) ...[
                SizedBox(height: tokens.gapLg),
                Text("建议动作", style: theme.textTheme.titleMedium),
                SizedBox(height: tokens.gapSm),
                ...data.healthScore.actions.take(3).map(
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

class _EditAccountSheet extends StatefulWidget {
  const _EditAccountSheet({
    required this.apiClient,
    required this.accountId,
    required this.account,
  });

  final LooApiClient apiClient;
  final String accountId;
  final MobileAccountDetailSnapshot account;

  @override
  State<_EditAccountSheet> createState() => _EditAccountSheetState();
}

class _EditAccountSheetState extends State<_EditAccountSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _nicknameController =
      TextEditingController(text: widget.account.name);
  late final _institutionController =
      TextEditingController(text: widget.account.institution);
  final _roomController = TextEditingController(text: "0");

  late var _accountType = widget.account.typeId;
  late var _currency = widget.account.currency;
  var _submitting = false;
  String? _error;

  @override
  void dispose() {
    _nicknameController.dispose();
    _institutionController.dispose();
    _roomController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await widget.apiClient.updatePortfolioAccount(
        accountId: widget.accountId,
        nickname: _nicknameController.text.trim(),
        institution: _institutionController.text.trim(),
        type: _accountType,
        currency: _currency,
        contributionRoomCad: double.tryParse(_roomController.text.trim()) ?? 0,
      );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, bottomInset + 20),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("编辑账户", style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _accountType,
                decoration: const InputDecoration(labelText: "账户类型"),
                items: const [
                  DropdownMenuItem(value: "TFSA", child: Text("TFSA")),
                  DropdownMenuItem(value: "RRSP", child: Text("RRSP")),
                  DropdownMenuItem(value: "FHSA", child: Text("FHSA")),
                  DropdownMenuItem(value: "Taxable", child: Text("Taxable")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) =>
                        setState(() => _accountType = value ?? _accountType),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nicknameController,
                enabled: !_submitting,
                decoration: const InputDecoration(labelText: "账户昵称"),
                validator: (value) =>
                    (value == null || value.trim().isEmpty) ? "请输入账户昵称" : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _institutionController,
                enabled: !_submitting,
                decoration: const InputDecoration(labelText: "机构"),
                validator: (value) => (value == null || value.trim().length < 2)
                    ? "机构至少 2 个字符"
                    : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _currency,
                decoration: const InputDecoration(labelText: "账户币种"),
                items: const [
                  DropdownMenuItem(value: "CAD", child: Text("CAD")),
                  DropdownMenuItem(value: "USD", child: Text("USD")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _currency = value ?? _currency),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _roomController,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "贡献额度 CAD"),
                validator: _validateMoney,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: Text(_submitting ? "保存中..." : "保存账户"),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String? _validateMoney(String? value) {
    final parsed = double.tryParse((value ?? "").trim());
    if (parsed == null || parsed < 0) {
      return "请输入大于等于 0 的数字";
    }
    return null;
  }
}
