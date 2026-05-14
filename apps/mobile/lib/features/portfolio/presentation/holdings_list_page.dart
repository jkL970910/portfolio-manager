import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../app/mobile_routes.dart";
import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../../shared/data/mobile_models.dart";
import "../data/mobile_portfolio_models.dart";

class HoldingsListPage extends StatefulWidget {
  const HoldingsListPage({required this.apiClient, super.key});

  final LooApiClient apiClient;

  @override
  State<HoldingsListPage> createState() => _HoldingsListPageState();
}

class _HoldingsListPageState extends State<HoldingsListPage> {
  late Future<MobilePortfolioSnapshot> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  Future<MobilePortfolioSnapshot> _loadSnapshot() async {
    final response = await widget.apiClient.getPortfolioOverview();
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("持仓列表格式不正确。");
    }
    return MobilePortfolioSnapshot.fromJson(data);
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
    });
  }

  void _openSecurityPosition(MobileHoldingCard holding) {
    context.push(
      MobileRoutes.securityDetail(
        symbol: holding.symbol,
        securityId: holding.securityId.isEmpty ? null : holding.securityId,
        exchange: holding.exchange.isEmpty ? null : holding.exchange,
        currency: holding.currency.isEmpty ? null : holding.currency,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MobilePortfolioSnapshot>(
      future: _snapshot,
      builder: (context, snapshot) {
        return RefreshIndicator(
          onRefresh: () async => _refresh(),
          child: LooPageGradient(
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: snapshot.hasData
                      ? _HoldingsHero(
                          snapshot.data!,
                          onOpenAccounts: () =>
                              context.push(MobileRoutes.portfolioAccounts),
                          onOpenHealth: () =>
                              context.push(MobileRoutes.portfolioHealth),
                        )
                      : const LooHeroHeader(
                          title: "持仓列表",
                          subtitle: "正在整理持仓账本...",
                        ),
                ),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (snapshot.hasError)
                  SliverFillRemaining(
                    child: LooStatePanel(
                      title: "持仓列表暂时打不开",
                      message: snapshot.error.toString(),
                      actionLabel: "重新加载",
                      onAction: _refresh,
                    ),
                  )
                else if (snapshot.hasData)
                  SliverPadding(
                    padding: looPagePadding(context),
                    sliver: SliverList.list(
                      children: [
                        ...snapshot.data!.securityHoldings.map(
                          (holding) => _HoldingWorkspaceRow(
                            holding: holding,
                            onTap: () => _openSecurityPosition(holding),
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

class _HoldingsHero extends StatelessWidget {
  const _HoldingsHero(
    this.snapshot, {
    required this.onOpenAccounts,
    required this.onOpenHealth,
  });

  final MobilePortfolioSnapshot snapshot;
  final VoidCallback onOpenAccounts;
  final VoidCallback onOpenHealth;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final totalGainLoss = _sumGainLoss(snapshot.accounts);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        tokens.gapLg,
        tokens.gapLg,
        tokens.gapLg,
        tokens.gapMd,
      ),
      child: LooGlassCard(
        isHero: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("持仓列表", style: Theme.of(context).textTheme.headlineMedium),
            SizedBox(height: tokens.gapXs),
            Text(
              "点击标的查看跨账户汇总仓位",
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: tokens.mutedText,
                  ),
            ),
            SizedBox(height: tokens.gapLg),
            _SummaryMetric(
              label: "总盈亏",
              value: totalGainLoss,
              expandedValue: true,
            ),
            SizedBox(height: tokens.gapMd),
            Row(
              children: [
                Expanded(
                  child: _SummaryActionChip(
                    label: "${snapshot.securityHoldings.length} 个标的",
                    icon: Icons.inventory_2_outlined,
                  ),
                ),
                SizedBox(width: tokens.gapSm),
                Expanded(
                  child: _SummaryActionChip(
                    label: "${snapshot.accounts.length} 个账户",
                    icon: Icons.account_balance_wallet_outlined,
                    onTap: onOpenAccounts,
                  ),
                ),
                SizedBox(width: tokens.gapSm),
                Expanded(
                  child: _SummaryActionChip(
                    label: "健康 ${snapshot.healthScore}",
                    icon: Icons.radar_rounded,
                    onTap: onOpenHealth,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HoldingWorkspaceRow extends StatelessWidget {
  const _HoldingWorkspaceRow({required this.holding, required this.onTap});

  final MobileHoldingCard holding;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final identity = [holding.exchange, holding.currency]
        .where((item) => item.trim().isNotEmpty)
        .join(" · ");
    final chips = [
      if (holding.accountCount.isNotEmpty) "${holding.accountCount} 个账户",
      if (holding.lotCount.isNotEmpty) "${holding.lotCount} 笔仓位",
      if (holding.weight.isNotEmpty) holding.weight,
      if (identity.isNotEmpty) identity,
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: LooGlassCard(
        onTap: onTap,
        padding: EdgeInsets.all(tokens.gapMd),
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
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (chips.isNotEmpty) ...[
                    SizedBox(height: tokens.gapSm),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: chips
                          .map((chip) => _InlineChip(label: chip))
                          .toList(growable: false),
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
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (holding.gainLoss.isNotEmpty) ...[
                  SizedBox(height: tokens.gapXs),
                  Text(
                    holding.gainLoss,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: holding.gainLoss.trim().startsWith("-")
                              ? tokens.danger
                              : tokens.success,
                          fontWeight: FontWeight.w800,
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

class _InlineChip extends StatelessWidget {
  const _InlineChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.accent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: tokens.mutedText,
                fontWeight: FontWeight.w700,
              ),
        ),
      ),
    );
  }
}

class _SummaryActionChip extends StatelessWidget {
  const _SummaryActionChip({
    required this.label,
    required this.icon,
    this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final child = DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: onTap == null ? tokens.cardBorder : tokens.accent,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
                size: 14,
                color: onTap == null ? tokens.mutedText : tokens.accent),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: onTap == null ? tokens.mutedText : tokens.accent,
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
    if (onTap == null) {
      return child;
    }
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: child,
      ),
    );
  }
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({
    required this.label,
    required this.value,
    this.expandedValue = false,
  });

  final String label;
  final String value;
  final bool expandedValue;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(tokens.radiusMd),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
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
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: tokens.mutedText,
                        ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: expandedValue ? 2 : 1,
              overflow: TextOverflow.ellipsis,
              style: (expandedValue
                      ? Theme.of(context).textTheme.titleLarge
                      : Theme.of(context).textTheme.titleMedium)
                  ?.copyWith(
                color: value.trim().startsWith("-")
                    ? Theme.of(context).colorScheme.error
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _sumGainLoss(List<MobileAccountCard> accounts) {
  var total = 0.0;
  var totalValue = 0.0;
  var hasValue = false;
  for (final account in accounts) {
    final parsed = _parseMoney(account.gainLoss);
    if (parsed == null) {
      continue;
    }
    total += parsed;
    totalValue += _parseMoney(account.value) ?? 0;
    hasValue = true;
  }
  if (!hasValue) {
    return "--";
  }
  final sign = total > 0
      ? "+"
      : total < 0
          ? "-"
          : "";
  final formattedAmount = _formatMoney(total.abs());
  final costBasis = totalValue - total;
  final pct = costBasis > 0 ? total / costBasis * 100 : null;
  final pctLabel =
      pct == null ? "" : " · $sign${pct.abs().toStringAsFixed(1)}%";
  return "$sign\$$formattedAmount$pctLabel";
}

String _formatMoney(double value) {
  final fixed = value.toStringAsFixed(0);
  final buffer = StringBuffer();
  for (var index = 0; index < fixed.length; index += 1) {
    final remaining = fixed.length - index;
    buffer.write(fixed[index]);
    if (remaining > 1 && remaining % 3 == 1) {
      buffer.write(",");
    }
  }
  return buffer.toString();
}

double? _parseMoney(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty || trimmed == "--") {
    return null;
  }
  final amountMatch = RegExp(
    r'[-+]?\s*(?:CA\$|C\$|US\$|\$)?\s*[\d,]+(?:\.\d+)?',
    caseSensitive: false,
  ).firstMatch(trimmed);
  if (amountMatch == null) {
    return null;
  }
  final matched = amountMatch.group(0) ?? "";
  final isNegative =
      matched.trimLeft().startsWith("-") || trimmed.contains("(");
  final numeric = matched
      .replaceAll(RegExp(r'(CA\$|C\$|US\$|\$)', caseSensitive: false), "")
      .replaceAll(",", "")
      .replaceAll("+", "")
      .replaceAll("-", "")
      .trim();
  final parsed = double.tryParse(numeric);
  if (parsed == null) {
    return null;
  }
  return isNegative ? -parsed : parsed;
}
