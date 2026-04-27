import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../shared/data/mobile_models.dart";
import "detail_state_widgets.dart";
import "holding_detail_page.dart";

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

    return MobileAccountDetailSnapshot.fromJson(data);
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
            tooltip: "删除账户",
            onPressed: _confirmDeleteAccount,
            icon: const Icon(Icons.delete_outline),
          ),
        ],
      ),
      body: FutureBuilder<MobileAccountDetailSnapshot?>(
        future: _snapshot,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return DetailErrorState(
              title: "账户详情暂时打不开",
              message: snapshot.error.toString(),
              onRetry: _refresh,
            );
          }

          if (!snapshot.hasData) {
            return DetailNotFoundState(
              title: "没有找到这个账户",
              message: "这个账户可能已被删除、合并，或当前登录身份没有访问权限。",
              onRetry: _refresh,
            );
          }

          final data = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                _SummaryCard(data),
                const SizedBox(height: 12),
                _MetricGrid(data),
                if (data.summaryPoints.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const _SectionTitle("Loo皇摘要"),
                  const SizedBox(height: 8),
                  _TextCard(data.summaryPoints.take(4).join("\n")),
                ],
                const SizedBox(height: 16),
                const _SectionTitle("账户健康度"),
                const SizedBox(height: 8),
                _HealthCard(data.healthScore),
                if (data.allocation.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const _SectionTitle("账户配置"),
                  const SizedBox(height: 8),
                  ...data.allocation.take(6).map(_AllocationTile.new),
                ],
                const SizedBox(height: 16),
                const _SectionTitle("账户事实"),
                const SizedBox(height: 8),
                ...data.facts.map(_FactTile.new),
                const SizedBox(height: 16),
                const _SectionTitle("账户持仓"),
                const SizedBox(height: 8),
                ...data.holdings.map(
                  (holding) => _HoldingTile(
                    holding,
                    onTap: () => _openHoldingDetail(holding),
                  ),
                ),
              ],
            ),
          );
        },
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

  Future<void> _confirmDeleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("删除账户？"),
        content: const Text("删除账户会移除这个账户及其相关持仓。这个操作不能撤销。"),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text("取消")),
          FilledButton.tonal(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text("删除")),
        ],
      ),
    );

    if (confirmed != true) {
      return;
    }

    try {
      await widget.apiClient.deletePortfolioAccount(widget.accountId);
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }
}

class MobileAccountDetailSnapshot {
  const MobileAccountDetailSnapshot({
    required this.name,
    required this.value,
    required this.gainLoss,
    required this.portfolioShare,
    required this.room,
    required this.subtitle,
    required this.summaryPoints,
    required this.allocation,
    required this.healthScore,
    required this.facts,
    required this.holdings,
  });

  final String name;
  final String value;
  final String gainLoss;
  final String portfolioShare;
  final String room;
  final String subtitle;
  final List<String> summaryPoints;
  final List<MobileAllocationPoint> allocation;
  final MobileAccountHealthScore healthScore;
  final List<MobileFact> facts;
  final List<MobileHoldingCard> holdings;

  factory MobileAccountDetailSnapshot.fromJson(Map<String, dynamic> json) {
    final account = json["account"];
    final accountData =
        account is Map<String, dynamic> ? account : const <String, dynamic>{};

    return MobileAccountDetailSnapshot(
      name: accountData["name"] as String? ?? "未知账户",
      value: accountData["value"] as String? ?? "--",
      gainLoss: accountData["gainLoss"] as String? ?? "",
      portfolioShare: accountData["portfolioShare"] as String? ?? "",
      room: accountData["room"] as String? ?? "",
      subtitle: [
        accountData["typeLabel"] as String? ?? "",
        accountData["institution"] as String? ?? "",
        accountData["portfolioShare"] as String? ?? "",
      ].where((item) => item.isNotEmpty).join(" · "),
      summaryPoints: (accountData["summaryPoints"] as List?)
              ?.whereType<String>()
              .toList() ??
          const [],
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
  const _SummaryCard(this.data);

  final MobileAccountDetailSnapshot data;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Theme.of(context).colorScheme.primaryContainer,
              Theme.of(context).colorScheme.surface,
            ],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(data.name,
                  style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 10),
              Text(data.value, style: Theme.of(context).textTheme.displaySmall),
              const SizedBox(height: 8),
              Text(data.subtitle),
              if (data.room.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(data.room, style: Theme.of(context).textTheme.bodySmall),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class MobileAllocationPoint {
  const MobileAllocationPoint({
    required this.name,
    required this.value,
  });

  final String name;
  final String value;

  factory MobileAllocationPoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];

    return MobileAllocationPoint(
      name: json["name"] as String? ?? "未知配置",
      value: rawValue is num
          ? "${rawValue.toStringAsFixed(1)}%"
          : rawValue?.toString() ?? "--",
    );
  }
}

class MobileAccountHealthScore {
  const MobileAccountHealthScore({
    required this.score,
    required this.status,
    required this.highlights,
    required this.actions,
  });

  final String score;
  final String status;
  final List<String> highlights;
  final List<String> actions;

  factory MobileAccountHealthScore.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};

    return MobileAccountHealthScore(
      score: "${json["score"] ?? "--"} 分",
      status: json["status"] as String? ?? "待评估",
      highlights: (json["highlights"] as List?)?.whereType<String>().toList() ??
          const [],
      actions: (json["actionQueue"] as List?)?.whereType<String>().toList() ??
          const [],
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid(this.data);

  final MobileAccountDetailSnapshot data;

  @override
  Widget build(BuildContext context) {
    final metrics = [
      _MetricDatum("账户盈亏", data.gainLoss),
      _MetricDatum("组合占比", data.portfolioShare),
      _MetricDatum("持仓数量", "${data.holdings.length} 个"),
      _MetricDatum("健康度", data.healthScore.score),
    ].where((item) => item.value.isNotEmpty && item.value != "--").toList();

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: metrics.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.8,
      ),
      itemBuilder: (context, index) => _MetricCard(metrics[index]),
    );
  }
}

class _MetricDatum {
  const _MetricDatum(this.label, this.value);

  final String label;
  final String value;
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(this.metric);

  final _MetricDatum metric;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(metric.label, style: Theme.of(context).textTheme.bodyMedium),
            const Spacer(),
            Text(metric.value, style: Theme.of(context).textTheme.titleLarge),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(title, style: Theme.of(context).textTheme.titleLarge);
  }
}

class _TextCard extends StatelessWidget {
  const _TextCard(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(text),
      ),
    );
  }
}

class _HealthCard extends StatelessWidget {
  const _HealthCard(this.health);

  final MobileAccountHealthScore health;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("${health.score} · ${health.status}",
                style: Theme.of(context).textTheme.titleLarge),
            ...health.highlights.take(3).map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text("• $item"),
                  ),
                ),
            ...health.actions.take(3).map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text("行动：$item"),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _AllocationTile extends StatelessWidget {
  const _AllocationTile(this.point);

  final MobileAllocationPoint point;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(point.name),
        trailing:
            Text(point.value, style: Theme.of(context).textTheme.titleLarge),
      ),
    );
  }
}

class _FactTile extends StatelessWidget {
  const _FactTile(this.fact);

  final MobileFact fact;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(fact.label),
        subtitle: Text(fact.detail),
        trailing:
            Text(fact.value, style: Theme.of(context).textTheme.titleLarge),
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
    return Card(
      child: ListTile(
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
