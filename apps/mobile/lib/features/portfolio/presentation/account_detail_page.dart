import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/loo_minister_context_models.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "../../shared/presentation/loo_minister_scope.dart";
import "detail_state_widgets.dart";
import "health_score_page.dart";
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
              onPressed: _confirmDeleteAccount,
              icon: const Icon(Icons.delete_outline)),
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
                if (data.accountValueChart != null ||
                    data.performance.isNotEmpty) ...[
                  _AccountTrendCard(
                    chart: data.accountValueChart,
                    fallbackPoints: data.performance,
                  ),
                  const SizedBox(height: 12),
                ],
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
                _HealthCard(
                  data.healthScore,
                  onTap: () => _openHealthScore(data),
                ),
                if (data.allocation.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const _SectionTitle("账户配置"),
                  const SizedBox(height: 8),
                  _AllocationChartCard(data.allocation),
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

  void _openHealthScore(MobileAccountDetailSnapshot data) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => HealthScorePage(
          apiClient: widget.apiClient,
          accountId: widget.accountId,
          fallbackTitle: "${data.name}健康巡查",
        ),
      ),
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
          label: "运行 AI 账户快扫",
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
        accountData["portfolioShare"] as String? ?? "",
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

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(chart?.title ?? "账户资产走势",
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
      ),
    );
  }
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
  const _HealthCard(this.health, {required this.onTap});

  final MobileAccountHealthScore health;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text("${health.score} · ${health.status}",
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
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

class _AllocationChartCard extends StatelessWidget {
  const _AllocationChartCard(this.points);

  final List<MobileAllocationPoint> points;

  @override
  Widget build(BuildContext context) {
    final shownPoints =
        points.where((point) => point.rawValue > 0).take(6).toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: LooDistributionBar(
          segments: shownPoints
              .map(
                (point) => LooDistributionSegment(
                  label: point.name,
                  value: point.rawValue,
                ),
              )
              .toList(),
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
