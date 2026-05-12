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
                          eyebrow: "Holdings",
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
                          (holding) => LooTappableRow(
                            margin: const EdgeInsets.only(bottom: 10),
                            title: _holdingTitle(holding),
                            subtitle: holding.detail,
                            value: holding.value,
                            valueDetail: holding.gainLoss,
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
    return LooHeroHeader(
      eyebrow: "Holdings",
      title: "持仓列表",
      subtitle: "点击标的查看跨账户汇总仓位",
      trailing: SizedBox(
        width: 160,
        child: Wrap(
          spacing: tokens.gapSm,
          runSpacing: tokens.gapSm,
          alignment: WrapAlignment.end,
          children: [
            _SummaryMetric(
              label: "标的",
              value: "${snapshot.securityHoldings.length}",
            ),
            _SummaryMetric(
              label: "账户",
              value: "${snapshot.accounts.length}",
              onTap: onOpenAccounts,
            ),
            _SummaryMetric(
              label: "健康",
              value: snapshot.healthScore,
              onTap: onOpenHealth,
            ),
            _SummaryMetric(
              label: "总盈亏",
              value: totalGainLoss,
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({
    required this.label,
    required this.value,
    this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final content = DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(tokens.radiusMd),
        border: Border.all(
          color: onTap == null ? tokens.cardBorder : tokens.accent,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: SizedBox(
          width: 56,
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
                  if (onTap != null)
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 14,
                      color: tokens.accent,
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ],
          ),
        ),
      ),
    );
    if (onTap == null) {
      return content;
    }
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(tokens.radiusMd),
      child: InkWell(
        borderRadius: BorderRadius.circular(tokens.radiusMd),
        onTap: onTap,
        child: content,
      ),
    );
  }
}

String _sumGainLoss(List<MobileAccountCard> accounts) {
  var total = 0.0;
  var hasValue = false;
  for (final account in accounts) {
    final parsed = _parseMoney(account.gainLoss);
    if (parsed == null) {
      continue;
    }
    total += parsed;
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
  final compact = total.abs() >= 1000
      ? "${(total.abs() / 1000).toStringAsFixed(1)}k"
      : total.abs().toStringAsFixed(0);
  return "$sign\$$compact";
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
