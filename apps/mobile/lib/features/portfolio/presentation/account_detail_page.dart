import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../shared/data/mobile_models.dart";

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
  late Future<MobileAccountDetailSnapshot> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  Future<MobileAccountDetailSnapshot> _loadSnapshot() async {
    final response = await widget.apiClient.getPortfolioAccountDetail(widget.accountId);
    final data = response["data"];
    if (data == null) {
      throw const LooApiException("没有找到这个账户。");
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
      appBar: AppBar(title: Text(widget.fallbackTitle)),
      body: FutureBuilder<MobileAccountDetailSnapshot>(
        future: _snapshot,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return _ErrorState(message: snapshot.error.toString(), onRetry: _refresh);
          }

          final data = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                _SummaryCard(title: data.name, value: data.value, subtitle: data.subtitle),
                const SizedBox(height: 16),
                const _SectionTitle("账户事实"),
                const SizedBox(height: 8),
                ...data.facts.map(_FactTile.new),
                const SizedBox(height: 16),
                const _SectionTitle("账户持仓"),
                const SizedBox(height: 8),
                ...data.holdings.map(_HoldingTile.new),
              ],
            ),
          );
        },
      ),
    );
  }
}

class MobileAccountDetailSnapshot {
  const MobileAccountDetailSnapshot({
    required this.name,
    required this.value,
    required this.subtitle,
    required this.facts,
    required this.holdings,
  });

  final String name;
  final String value;
  final String subtitle;
  final List<MobileFact> facts;
  final List<MobileHoldingCard> holdings;

  factory MobileAccountDetailSnapshot.fromJson(Map<String, dynamic> json) {
    final account = json["account"];
    final accountData = account is Map<String, dynamic> ? account : const <String, dynamic>{};

    return MobileAccountDetailSnapshot(
      name: accountData["name"] as String? ?? "未知账户",
      value: accountData["value"] as String? ?? "--",
      subtitle: [
        accountData["typeLabel"] as String? ?? "",
        accountData["institution"] as String? ?? "",
        accountData["portfolioShare"] as String? ?? "",
      ].where((item) => item.isNotEmpty).join(" · "),
      facts: readJsonList(json, "facts").map(MobileFact.fromJson).toList(),
      holdings: readJsonList(json, "holdings").map(MobileHoldingCard.fromJson).toList(),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.title,
    required this.value,
    required this.subtitle,
  });

  final String title;
  final String value;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text(value, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(subtitle),
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

class _FactTile extends StatelessWidget {
  const _FactTile(this.fact);

  final MobileFact fact;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(fact.label),
        subtitle: Text(fact.detail),
        trailing: Text(fact.value, style: Theme.of(context).textTheme.titleLarge),
      ),
    );
  }
}

class _HoldingTile extends StatelessWidget {
  const _HoldingTile(this.holding);

  final MobileHoldingCard holding;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text("${holding.symbol} · ${holding.name}"),
        subtitle: Text(holding.detail),
        trailing: Text(holding.value, style: Theme.of(context).textTheme.titleLarge),
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
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("账户详情暂时打不开", style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text("重新翻阅")),
          ],
        ),
      ),
    );
  }
}
