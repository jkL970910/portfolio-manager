import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "account_detail_page.dart";
import "health_score_page.dart";
import "holding_detail_page.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";

class PortfolioPage extends StatefulWidget {
  const PortfolioPage({
    required this.apiClient,
    this.accountTypeFilter,
    this.title,
    super.key,
  });

  final LooApiClient apiClient;
  final String? accountTypeFilter;
  final String? title;

  @override
  State<PortfolioPage> createState() => _PortfolioPageState();
}

class _PortfolioPageState extends State<PortfolioPage> {
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
      throw const LooApiException("组合数据格式不正确。");
    }

    final snapshot = MobilePortfolioSnapshot.fromJson(data);
    final accountTypeFilter = widget.accountTypeFilter;
    if (accountTypeFilter == null || accountTypeFilter.isEmpty) {
      return snapshot;
    }

    return snapshot.filteredByAccountType(accountTypeFilter);
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
        return RefreshIndicator(
          onRefresh: () async => _refresh(),
          child: CustomScrollView(
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
                          snapshot.data!.accountTypeAllocation.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        _AllocationCard(
                          title: "账户类型分布",
                          points: snapshot.data!.accountTypeAllocation,
                        ),
                      ],
                      if (!_isFiltered &&
                          snapshot
                              .data!.accountInstanceAllocation.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        _AllocationCard(
                          title: "账户实例分布",
                          points: snapshot.data!.accountInstanceAllocation,
                        ),
                      ],
                      const SizedBox(height: 18),
                      _SectionTitle(
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
                          title: "持仓",
                          actionLabel: "${snapshot.data!.holdings.length} 个"),
                      const SizedBox(height: 10),
                      ...snapshot.data!.holdings.take(12).map(
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
        );
      },
    );
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

  bool get _isFiltered =>
      widget.accountTypeFilter != null && widget.accountTypeFilter!.isNotEmpty;
}

class MobilePortfolioSnapshot {
  const MobilePortfolioSnapshot({
    required this.accounts,
    required this.holdings,
    required this.quoteStatus,
    required this.healthScore,
    required this.summaryPoints,
    required this.accountTypeAllocation,
    required this.accountInstanceAllocation,
  });

  final List<MobileAccountCard> accounts;
  final List<MobileHoldingCard> holdings;
  final String quoteStatus;
  final String healthScore;
  final List<String> summaryPoints;
  final List<MobilePortfolioAllocationPoint> accountTypeAllocation;
  final List<MobilePortfolioAllocationPoint> accountInstanceAllocation;

  factory MobilePortfolioSnapshot.fromJson(Map<String, dynamic> json) {
    final quoteStatus = json["quoteStatus"];
    final healthScore = json["healthScore"];

    return MobilePortfolioSnapshot(
      accounts: readJsonList(json, "accountCards")
          .map(MobileAccountCard.fromJson)
          .toList(),
      holdings: readJsonList(json, "holdings")
          .map(MobileHoldingCard.fromJson)
          .toList(),
      quoteStatus: quoteStatus is Map<String, dynamic>
          ? quoteStatus["lastRefreshed"] as String? ?? "报价状态待刷新"
          : "报价状态待刷新",
      healthScore: healthScore is Map<String, dynamic>
          ? "${healthScore["score"] ?? "--"} 分"
          : "-- 分",
      summaryPoints:
          (json["summaryPoints"] as List?)?.whereType<String>().toList() ??
              const [],
      accountTypeAllocation: readJsonList(json, "accountTypeAllocation")
          .map(MobilePortfolioAllocationPoint.fromJson)
          .toList(),
      accountInstanceAllocation: readJsonList(json, "accountInstanceAllocation")
          .map(MobilePortfolioAllocationPoint.fromJson)
          .toList(),
    );
  }

  MobilePortfolioSnapshot filteredByAccountType(String accountType) {
    return MobilePortfolioSnapshot(
      accounts:
          accounts.where((account) => account.typeId == accountType).toList(),
      holdings: holdings
          .where((holding) => holding.accountType == accountType)
          .toList(),
      quoteStatus: "已筛选 $accountType 账户类型 · $quoteStatus",
      healthScore: healthScore,
      summaryPoints: summaryPoints,
      accountTypeAllocation: accountTypeAllocation,
      accountInstanceAllocation: accountInstanceAllocation,
    );
  }
}

class MobilePortfolioAllocationPoint {
  const MobilePortfolioAllocationPoint({
    required this.name,
    required this.value,
    required this.displayValue,
    required this.detail,
  });

  final String name;
  final double value;
  final String displayValue;
  final String detail;

  factory MobilePortfolioAllocationPoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];
    final value = rawValue is num ? rawValue.toDouble() : 0.0;
    return MobilePortfolioAllocationPoint(
      name: json["name"] as String? ?? "未知配置",
      value: value,
      displayValue: "${value.toStringAsFixed(1)}%",
      detail: json["detail"] as String? ?? "",
    );
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
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
    return _LooCard(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(2),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text("国库健康度",
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
              const SizedBox(height: 8),
              Text(score, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              ...summaryPoints.take(3).map((point) => Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text("• $point"),
                  )),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterSummaryCard extends StatelessWidget {
  const _FilterSummaryCard(this.data);

  final MobilePortfolioSnapshot data;

  @override
  Widget build(BuildContext context) {
    return _LooCard(
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

class _AllocationCard extends StatelessWidget {
  const _AllocationCard({required this.title, required this.points});

  final String title;
  final List<MobilePortfolioAllocationPoint> points;

  @override
  Widget build(BuildContext context) {
    final shownPoints =
        points.where((point) => point.value > 0).take(6).toList();
    return _LooCard(
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.actionLabel});

  final String title;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        Text(actionLabel, style: Theme.of(context).textTheme.bodyMedium),
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
    return _LooCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        onTap: onTap,
        title: Text(account.name),
        subtitle: Text(account.detail),
        trailing: Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          children: [
            Text(account.value, style: Theme.of(context).textTheme.titleLarge),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}

class _HoldingTile extends StatelessWidget {
  const _HoldingTile(this.holding, {required this.onTap});

  final MobileHoldingCard holding;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _LooCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        onTap: onTap,
        title: Text("${holding.symbol} · ${holding.name}"),
        subtitle: Text(holding.detail),
        trailing: Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          children: [
            Text(holding.value, style: Theme.of(context).textTheme.titleLarge),
            const Icon(Icons.chevron_right),
          ],
        ),
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
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text("Loo国资产账本暂时打不开", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text("重新翻阅")),
        ],
      ),
    );
  }
}

class _LooCard extends StatelessWidget {
  const _LooCard({required this.child, this.margin});

  final Widget child;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: margin,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: child,
      ),
    );
  }
}
