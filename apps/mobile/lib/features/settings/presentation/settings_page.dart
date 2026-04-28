import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "investment_preferences_card.dart";

class SettingsPage extends StatefulWidget {
  const SettingsPage({
    required this.apiClient,
    required this.viewerName,
    required this.baseCurrency,
    required this.onDisplayCurrencyChanged,
    required this.onLogout,
    super.key,
  });

  final LooApiClient apiClient;
  final String viewerName;
  final String baseCurrency;
  final Future<void> Function(String currency) onDisplayCurrencyChanged;
  final VoidCallback onLogout;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late var _currency = widget.baseCurrency;
  var _savingCurrency = false;
  var _refreshingQuotes = false;
  String? _refreshResult;
  String? _error;

  Future<void> _changeCurrency(String currency) async {
    if (currency == _currency || _savingCurrency) {
      return;
    }

    setState(() {
      _savingCurrency = true;
      _error = null;
    });

    try {
      await widget.onDisplayCurrencyChanged(currency);
      if (mounted) {
        setState(() {
          _currency = currency;
          _savingCurrency = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _savingCurrency = false;
        });
      }
    }
  }

  Future<void> _refreshQuotes() async {
    if (_refreshingQuotes) {
      return;
    }

    setState(() {
      _refreshingQuotes = true;
      _refreshResult = null;
      _error = null;
    });

    try {
      final response = await widget.apiClient.refreshPortfolioQuotes();
      final data = response["data"];
      final result =
          data is Map<String, dynamic> ? data : const <String, dynamic>{};
      final refreshed = result["refreshedHoldingCount"] ?? 0;
      final missing = result["missingQuoteCount"] ?? 0;
      final sampled = result["sampledSymbolCount"] ?? 0;
      if (mounted) {
        setState(() {
          _refreshResult =
              "已刷新 $refreshed 笔持仓；检查 $sampled 个标的身份，$missing 个暂未拿到报价。";
          _refreshingQuotes = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _refreshingQuotes = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("设置", style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              title: Text(widget.viewerName),
              subtitle: const Text("Loo国居民档案"),
              leading: const CircleAvatar(child: Icon(Icons.person_outline)),
            ),
          ),
          const SizedBox(height: 16),
          Text("显示币种", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: "CAD", label: Text("CAD")),
              ButtonSegment(value: "USD", label: Text("USD")),
            ],
            selected: {_currency},
            onSelectionChanged: _savingCurrency
                ? null
                : (value) => _changeCurrency(value.first),
          ),
          if (_savingCurrency) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          Text("行情数据", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: const Icon(Icons.sync),
              title: const Text("刷新组合行情"),
              subtitle: Text(
                _refreshResult ?? "按代码 + 交易所 + 币种刷新，避免 CAD 版本和美股正股混淆。",
              ),
              trailing: _refreshingQuotes
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.chevron_right),
              onTap: _refreshingQuotes ? null : _refreshQuotes,
            ),
          ),
          const SizedBox(height: 16),
          _RecentAnalysisCard(apiClient: widget.apiClient),
          const SizedBox(height: 16),
          _ExternalResearchPolicyCard(apiClient: widget.apiClient),
          const SizedBox(height: 16),
          InvestmentPreferencesCard(apiClient: widget.apiClient),
          const SizedBox(height: 24),
          FilledButton.tonalIcon(
            onPressed: widget.onLogout,
            icon: const Icon(Icons.logout),
            label: const Text("退出 Loo国"),
          ),
        ],
      ),
    );
  }
}

class _RecentAnalysisCard extends StatefulWidget {
  const _RecentAnalysisCard({required this.apiClient});

  final LooApiClient apiClient;

  @override
  State<_RecentAnalysisCard> createState() => _RecentAnalysisCardState();
}

class _RecentAnalysisCardState extends State<_RecentAnalysisCard> {
  late Future<List<_RecentAnalysisItem>> _items = _loadItems();

  Future<List<_RecentAnalysisItem>> _loadItems() async {
    final response = await widget.apiClient.getRecentAnalyzerRuns(limit: 5);
    final data = response["data"];
    final payload =
        data is Map<String, dynamic> ? data : const <String, dynamic>{};
    final rawItems = payload["items"];
    return rawItems is List
        ? rawItems
            .whereType<Map<String, dynamic>>()
            .map(_RecentAnalysisItem.fromJson)
            .toList()
        : const [];
  }

  void _refresh() {
    setState(() {
      _items = _loadItems();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FutureBuilder<List<_RecentAnalysisItem>>(
          future: _items,
          builder: (context, snapshot) {
            final items = snapshot.data ?? const <_RecentAnalysisItem>[];
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.history),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "AI 最近分析",
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      onPressed:
                          snapshot.connectionState == ConnectionState.waiting
                              ? null
                              : _refresh,
                      icon: const Icon(Icons.refresh),
                      tooltip: "刷新记录",
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text("展示最近保存的快扫结果；实时新闻/论坛研究仍未接入。"),
                if (snapshot.connectionState == ConnectionState.waiting) ...[
                  const SizedBox(height: 12),
                  const LinearProgressIndicator(),
                ] else if (snapshot.hasError) ...[
                  const SizedBox(height: 12),
                  Text(
                    "分析记录暂时读取失败：${snapshot.error}",
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ] else if (items.isEmpty) ...[
                  const SizedBox(height: 12),
                  const Text("还没有分析记录。先在标的、组合或账户页面生成一次 AI 快扫。"),
                ] else ...[
                  const SizedBox(height: 12),
                  ...items.map(_RecentAnalysisTile.new),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ExternalResearchPolicyCard extends StatefulWidget {
  const _ExternalResearchPolicyCard({required this.apiClient});

  final LooApiClient apiClient;

  @override
  State<_ExternalResearchPolicyCard> createState() =>
      _ExternalResearchPolicyCardState();
}

class _ExternalResearchPolicyCardState
    extends State<_ExternalResearchPolicyCard> {
  late Future<_ExternalResearchPolicy> _policy = _loadPolicy();
  late Future<List<_ExternalResearchJobItem>> _jobs = _loadJobs();

  Future<_ExternalResearchPolicy> _loadPolicy() async {
    final response = await widget.apiClient.getExternalResearchUsage();
    final data = response["data"];
    final payload =
        data is Map<String, dynamic> ? data : const <String, dynamic>{};
    return _ExternalResearchPolicy.fromUsageJson(payload);
  }

  Future<List<_ExternalResearchJobItem>> _loadJobs() async {
    final response = await widget.apiClient.getExternalResearchJobs(limit: 5);
    final data = response["data"];
    final payload =
        data is Map<String, dynamic> ? data : const <String, dynamic>{};
    final rawItems = payload["items"];
    return rawItems is List
        ? rawItems
            .whereType<Map<String, dynamic>>()
            .map(_ExternalResearchJobItem.fromJson)
            .toList()
        : const [];
  }

  void _refresh() {
    setState(() {
      _policy = _loadPolicy();
      _jobs = _loadJobs();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FutureBuilder<_ExternalResearchPolicy>(
          future: _policy,
          builder: (context, snapshot) {
            final policy = snapshot.data;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.shield_outlined),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "AI 外部研究",
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      onPressed:
                          snapshot.connectionState == ConnectionState.waiting
                              ? null
                              : _refresh,
                      icon: const Icon(Icons.refresh),
                      tooltip: "刷新策略",
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                if (snapshot.connectionState == ConnectionState.waiting) ...[
                  const LinearProgressIndicator(),
                ] else if (snapshot.hasError) ...[
                  Text(
                    "外部研究策略暂时读取失败：${snapshot.error}",
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ] else if (policy != null) ...[
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      Chip(
                        avatar: Icon(
                          policy.canRunLiveResearch
                              ? Icons.check_circle_outline
                              : Icons.block,
                          size: 18,
                        ),
                        label: Text(policy.statusLabel),
                      ),
                      if (policy.manualTriggerOnly)
                        const Chip(label: Text("仅手动触发")),
                      Chip(label: Text("TTL >= ${policy.ttlHours} 小时")),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Text("当前不会自动调用新闻、论坛或付费外部研究。后续必须先接入 worker、缓存和来源白名单。"),
                  const SizedBox(height: 10),
                  Text(
                    "今日用量：${policy.usedRuns}/${policy.dailyRunLimit} 次；剩余 ${policy.remainingRuns} 次。",
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  Text(
                    "成本边界：单次最多 ${policy.maxSymbolsPerRun} 个标的。",
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  ...policy.sources.map(
                    (source) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      leading: Icon(
                        source.enabled
                            ? Icons.check_circle_outline
                            : Icons.radio_button_unchecked,
                      ),
                      title: Text(source.label),
                      subtitle: Text(source.reason),
                    ),
                  ),
                  const Divider(),
                  FutureBuilder<List<_ExternalResearchJobItem>>(
                    future: _jobs,
                    builder: (context, jobsSnapshot) {
                      if (jobsSnapshot.connectionState ==
                          ConnectionState.waiting) {
                        return const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: LinearProgressIndicator(),
                        );
                      }
                      if (jobsSnapshot.hasError) {
                        return Text(
                          "最近任务暂时读取失败：${jobsSnapshot.error}",
                          style: TextStyle(
                              color: Theme.of(context).colorScheme.error),
                        );
                      }
                      final jobs = jobsSnapshot.data ??
                          const <_ExternalResearchJobItem>[];
                      if (jobs.isEmpty) {
                        return const Text("最近没有外部研究任务。");
                      }
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "最近任务",
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 6),
                          ...jobs.map(_ExternalResearchJobTile.new),
                        ],
                      );
                    },
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ExternalResearchJobTile extends StatelessWidget {
  const _ExternalResearchJobTile(this.item);

  final _ExternalResearchJobItem item;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: Icon(item.statusIcon),
      title: Text("${item.scopeLabel} · ${item.statusLabel}"),
      subtitle: Text(item.subtitle),
    );
  }
}

class _ExternalResearchJobItem {
  const _ExternalResearchJobItem({
    required this.scopeLabel,
    required this.status,
    required this.statusLabel,
    required this.targetKey,
    required this.targetLabel,
    required this.attemptCount,
    required this.maxAttempts,
    required this.createdAt,
    required this.errorMessage,
  });

  final String scopeLabel;
  final String status;
  final String statusLabel;
  final String targetKey;
  final String targetLabel;
  final int attemptCount;
  final int maxAttempts;
  final DateTime? createdAt;
  final String? errorMessage;

  IconData get statusIcon {
    switch (status) {
      case "queued":
        return Icons.schedule;
      case "running":
        return Icons.sync;
      case "succeeded":
        return Icons.check_circle_outline;
      case "failed":
        return Icons.error_outline;
      default:
        return Icons.info_outline;
    }
  }

  String get createdAtLabel {
    final value = createdAt;
    if (value == null) {
      return "时间未知";
    }
    final local = value.toLocal();
    String two(int number) => number.toString().padLeft(2, "0");
    return "${local.month}/${local.day} ${two(local.hour)}:${two(local.minute)}";
  }

  String get subtitle {
    final details = [
      targetLabel,
      "$createdAtLabel · 尝试 $attemptCount/$maxAttempts",
      if (errorMessage != null && errorMessage!.isNotEmpty) errorMessage!,
    ];
    return details.join("\n");
  }

  factory _ExternalResearchJobItem.fromJson(Map<String, dynamic> json) {
    final rawCreatedAt = json["createdAt"];
    return _ExternalResearchJobItem(
      scopeLabel: json["scopeLabel"] as String? ?? "外部研究",
      status: json["status"] as String? ?? "unknown",
      statusLabel: json["statusLabel"] as String? ?? "状态未知",
      targetKey: json["targetKey"] as String? ?? "目标未知",
      targetLabel: json["targetLabel"] as String? ??
          json["targetKey"] as String? ??
          "目标未知",
      attemptCount: json["attemptCount"] as int? ?? 0,
      maxAttempts: json["maxAttempts"] as int? ?? 3,
      createdAt:
          rawCreatedAt is String ? DateTime.tryParse(rawCreatedAt) : null,
      errorMessage: json["errorMessage"] as String?,
    );
  }
}

class _ExternalResearchPolicy {
  const _ExternalResearchPolicy({
    required this.statusLabel,
    required this.canRunLiveResearch,
    required this.manualTriggerOnly,
    required this.minTtlSeconds,
    required this.dailyRunLimit,
    required this.maxSymbolsPerRun,
    required this.usedRuns,
    required this.remainingRuns,
    required this.sources,
  });

  final String statusLabel;
  final bool canRunLiveResearch;
  final bool manualTriggerOnly;
  final int minTtlSeconds;
  final int dailyRunLimit;
  final int maxSymbolsPerRun;
  final int usedRuns;
  final int remainingRuns;
  final List<_ExternalResearchSource> sources;

  int get ttlHours => (minTtlSeconds / 3600).ceil();

  factory _ExternalResearchPolicy.fromUsageJson(Map<String, dynamic> json) {
    final policyJson = json["policy"] is Map<String, dynamic>
        ? json["policy"] as Map<String, dynamic>
        : const <String, dynamic>{};
    final usageJson = json["usage"] is Map<String, dynamic>
        ? json["usage"] as Map<String, dynamic>
        : const <String, dynamic>{};
    return _ExternalResearchPolicy.fromJson(policyJson, usageJson: usageJson);
  }

  factory _ExternalResearchPolicy.fromJson(
    Map<String, dynamic> json, {
    Map<String, dynamic> usageJson = const <String, dynamic>{},
  }) {
    final rawSources = json["sources"];
    return _ExternalResearchPolicy(
      statusLabel: json["statusLabel"] as String? ?? "未启用",
      canRunLiveResearch: json["canRunLiveResearch"] == true,
      manualTriggerOnly: json["manualTriggerOnly"] != false,
      minTtlSeconds: json["minTtlSeconds"] as int? ?? 21600,
      dailyRunLimit: usageJson["dailyRunLimit"] as int? ??
          json["dailyRunLimit"] as int? ??
          20,
      maxSymbolsPerRun: usageJson["maxSymbolsPerRun"] as int? ??
          json["maxSymbolsPerRun"] as int? ??
          12,
      usedRuns: usageJson["usedRuns"] as int? ?? 0,
      remainingRuns: usageJson["remainingRuns"] as int? ??
          json["dailyRunLimit"] as int? ??
          20,
      sources: rawSources is List
          ? rawSources
              .whereType<Map<String, dynamic>>()
              .map(_ExternalResearchSource.fromJson)
              .toList()
          : const [],
    );
  }
}

class _ExternalResearchSource {
  const _ExternalResearchSource({
    required this.label,
    required this.enabled,
    required this.reason,
  });

  final String label;
  final bool enabled;
  final String reason;

  factory _ExternalResearchSource.fromJson(Map<String, dynamic> json) {
    return _ExternalResearchSource(
      label: json["label"] as String? ?? "外部来源",
      enabled: json["enabled"] == true,
      reason: json["reason"] as String? ?? "暂未启用。",
    );
  }
}

class _RecentAnalysisTile extends StatelessWidget {
  const _RecentAnalysisTile(this.item);

  final _RecentAnalysisItem item;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.auto_awesome),
      title: Text(item.title),
      subtitle:
          Text("${item.scopeLabel} · ${item.generatedAtLabel}\n${item.detail}"),
      isThreeLine: true,
    );
  }
}

class _RecentAnalysisItem {
  const _RecentAnalysisItem({
    required this.scopeLabel,
    required this.title,
    required this.detail,
    required this.generatedAt,
  });

  final String scopeLabel;
  final String title;
  final String detail;
  final DateTime? generatedAt;

  String get generatedAtLabel {
    final value = generatedAt;
    if (value == null) {
      return "时间未知";
    }
    final local = value.toLocal();
    String two(int number) => number.toString().padLeft(2, "0");
    return "${local.month}/${local.day} ${two(local.hour)}:${two(local.minute)}";
  }

  factory _RecentAnalysisItem.fromJson(Map<String, dynamic> json) {
    final rawGeneratedAt = json["generatedAt"];
    return _RecentAnalysisItem(
      scopeLabel: json["scopeLabel"] as String? ?? "AI 快扫",
      title: json["title"] as String? ?? "AI 快扫记录",
      detail: json["detail"] as String? ?? "",
      generatedAt:
          rawGeneratedAt is String ? DateTime.tryParse(rawGeneratedAt) : null,
    );
  }
}
