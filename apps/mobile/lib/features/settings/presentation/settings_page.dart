import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../data/market_data_refresh_models.dart";
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
      final historyPoints = result["historyPointCount"] ?? 0;
      final snapshotRecorded = result["snapshotRecorded"] == true;
      final fxRateLabel = result["fxRateLabel"] as String? ?? "";
      if (mounted) {
        setState(() {
          _refreshResult = [
            "已刷新 $refreshed 笔持仓",
            "检查 $sampled 个标的身份",
            "$missing 个暂未拿到报价",
            "写入 $historyPoints 条价格历史",
            snapshotRecorded ? "已记录今日组合快照" : "未记录新快照",
            if (fxRateLabel.isNotEmpty) "FX：$fxRateLabel",
          ].join("；");
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
          _WorkerStatusCenterCard(apiClient: widget.apiClient),
          const SizedBox(height: 16),
          _SecurityMetadataReviewCard(apiClient: widget.apiClient),
          const SizedBox(height: 16),
          _MarketDataStatusCard(apiClient: widget.apiClient),
          const SizedBox(height: 16),
          _RecentAnalysisCard(apiClient: widget.apiClient),
          const SizedBox(height: 16),
          _ExternalResearchPolicyCard(apiClient: widget.apiClient),
          const SizedBox(height: 16),
          _AiMinisterSettingsCard(apiClient: widget.apiClient),
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

class _AiMinisterSettingsCard extends StatefulWidget {
  const _AiMinisterSettingsCard({required this.apiClient});

  final LooApiClient apiClient;

  @override
  State<_AiMinisterSettingsCard> createState() =>
      _AiMinisterSettingsCardState();
}

class _AiMinisterSettingsCardState extends State<_AiMinisterSettingsCard> {
  late Future<_AiMinisterSettings> _settings = _loadSettings();
  final _apiKeyController = TextEditingController();
  final _modelController = TextEditingController();
  final _baseUrlController = TextEditingController();
  var _saving = false;
  String? _message;

  @override
  void dispose() {
    _apiKeyController.dispose();
    _modelController.dispose();
    _baseUrlController.dispose();
    super.dispose();
  }

  Future<_AiMinisterSettings> _loadSettings() async {
    final response = await widget.apiClient.getAiMinisterSettings();
    final data = response["data"];
    final payload =
        data is Map<String, dynamic> ? data : const <String, dynamic>{};
    return _AiMinisterSettings.fromJson(payload);
  }

  void _refresh() {
    setState(() {
      _settings = _loadSettings();
    });
  }

  Future<void> _save({
    String? mode,
    String? provider,
    String? reasoningEffort,
    bool clearApiKey = false,
  }) async {
    if (_saving) return;
    final current = await _settings;
    final apiKey = _apiKeyController.text.trim();
    final model = _modelController.text.trim();
    final baseUrl = _baseUrlController.text.trim();
    setState(() {
      _saving = true;
      _message = null;
    });

    try {
      final response = await widget.apiClient.updateAiMinisterSettings({
        "mode": mode ?? current.mode,
        "provider": provider ?? current.provider,
        "reasoningEffort": reasoningEffort ?? current.reasoningEffort,
        if (model.isNotEmpty) "model": model,
        if (baseUrl.isNotEmpty) "baseUrl": baseUrl,
        if (apiKey.isNotEmpty) "apiKey": apiKey,
        if (clearApiKey) "clearApiKey": true,
      });
      final data = response["data"];
      final payload =
          data is Map<String, dynamic> ? data : const <String, dynamic>{};
      if (mounted) {
        setState(() {
          _apiKeyController.clear();
          _modelController.clear();
          _baseUrlController.clear();
          _settings = Future.value(_AiMinisterSettings.fromJson(payload));
          _message = "AI 大臣设置已保存。";
          _saving = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _message = error.toString();
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FutureBuilder<_AiMinisterSettings>(
          future: _settings,
          builder: (context, snapshot) {
            final settings = snapshot.data;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.smart_toy_outlined),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "AI 大臣设置",
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      onPressed:
                          snapshot.connectionState == ConnectionState.waiting
                              ? null
                              : _refresh,
                      icon: const Icon(Icons.refresh),
                      tooltip: "刷新设置",
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text("默认本地大臣不产生 OpenAI 费用；开启 GPT-5.5 后会发送当前页面结构化摘要。"),
                if (snapshot.connectionState == ConnectionState.waiting) ...[
                  const SizedBox(height: 12),
                  const LinearProgressIndicator(),
                ] else if (snapshot.hasError) ...[
                  const SizedBox(height: 12),
                  Text(
                    "AI 大臣设置暂时读取失败：${snapshot.error}",
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ] else if (settings != null) ...[
                  const SizedBox(height: 12),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: "local", label: Text("本地")),
                      ButtonSegment(value: "gpt-5.5", label: Text("外部 GPT")),
                    ],
                    selected: {settings.mode},
                    onSelectionChanged:
                        _saving ? null : (value) => _save(mode: value.first),
                  ),
                  const SizedBox(height: 10),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: "official-openai",
                        label: Text("OpenAI 官方"),
                      ),
                      ButtonSegment(
                        value: "openrouter-compatible",
                        label: Text("Router"),
                      ),
                    ],
                    selected: {settings.provider},
                    onSelectionChanged: _saving
                        ? null
                        : (value) => _save(provider: value.first),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      Chip(label: Text(settings.effectiveModeLabel)),
                      Chip(label: Text(settings.providerLabel)),
                      Chip(label: Text("模型：${settings.model}")),
                      Chip(label: Text("推理：${settings.reasoningEffortLabel}")),
                      Chip(label: Text(settings.apiKeyLabel)),
                      Chip(label: Text(settings.providerEnabledLabel)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(settings.privacyNote),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _modelController,
                    decoration: InputDecoration(
                      labelText: "模型",
                      helperText: "留空保持当前；Router 模式填写对应平台的 model slug。",
                      hintText: settings.model,
                    ),
                  ),
                  const SizedBox(height: 10),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: "low", label: Text("低")),
                      ButtonSegment(value: "medium", label: Text("中")),
                      ButtonSegment(value: "high", label: Text("高")),
                      ButtonSegment(value: "xhigh", label: Text("极高")),
                    ],
                    selected: {settings.reasoningEffort},
                    onSelectionChanged: _saving
                        ? null
                        : (value) => _save(reasoningEffort: value.first),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "推理强度越高通常越慢、越贵；默认中档适合当前大臣问答。",
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _baseUrlController,
                    enabled: settings.provider == "openrouter-compatible",
                    decoration: InputDecoration(
                      labelText: "Router Base URL",
                      helperText:
                          "留空使用默认；自定义兼容域名通常填 https://openrouter.icu，官方 OpenRouter 可填完整 /api/v1/responses。",
                      hintText: settings.baseUrl ??
                          "https://openrouter.ai/api/v1/responses",
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _apiKeyController,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: settings.provider == "openrouter-compatible"
                          ? "Router API Key"
                          : "OpenAI API Key",
                      helperText: "只保存到后端加密存储；不会写入 Flutter 客户端。",
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _saving ? null : () => _save(),
                          icon: const Icon(Icons.save_outlined),
                          label: Text(_saving ? "保存中..." : "保存设置"),
                        ),
                      ),
                      const SizedBox(width: 10),
                      OutlinedButton(
                        onPressed: _saving || !settings.apiKeyConfigured
                            ? null
                            : () => _save(clearApiKey: true),
                        child: const Text("清除 Key"),
                      ),
                    ],
                  ),
                  if (_message != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _message!,
                      style: TextStyle(
                        color: _message!.contains("失败") ||
                                _message!.contains("requires")
                            ? Theme.of(context).colorScheme.error
                            : Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ],
                  if (settings.recentUsage.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Text("最近使用记录",
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 6),
                    ...settings.recentUsage.map(_AiMinisterUsageTile.new),
                  ],
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _WorkerStatusCenterCard extends StatefulWidget {
  const _WorkerStatusCenterCard({required this.apiClient});

  final LooApiClient apiClient;

  @override
  State<_WorkerStatusCenterCard> createState() =>
      _WorkerStatusCenterCardState();
}

class _WorkerStatusCenterCardState extends State<_WorkerStatusCenterCard> {
  late Future<WorkerStatusCenter> _status = _loadStatus();

  Future<WorkerStatusCenter> _loadStatus() async {
    final response = await widget.apiClient.getWorkerStatusCenter();
    return WorkerStatusCenter.fromApiResponse(response);
  }

  void _refresh() {
    setState(() {
      _status = _loadStatus();
    });
  }

  IconData _iconForStatus(String status) {
    return switch (status) {
      "success" => Icons.check_circle_outline,
      "partial" => Icons.warning_amber_outlined,
      "failed" => Icons.error_outline,
      "running" => Icons.sync,
      "skipped" || "disabled" || "empty" => Icons.info_outline,
      _ => Icons.pending_outlined,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FutureBuilder<WorkerStatusCenter>(
          future: _status,
          builder: (context, snapshot) {
            final status = snapshot.data;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.cloud_sync_outlined),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        status?.title ?? "云端后台任务中心",
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      onPressed:
                          snapshot.connectionState == ConnectionState.waiting
                              ? null
                              : _refresh,
                      icon: const Icon(Icons.refresh),
                      tooltip: "刷新后台任务状态",
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                if (snapshot.connectionState == ConnectionState.waiting) ...[
                  const LinearProgressIndicator(),
                ] else if (snapshot.hasError) ...[
                  Text(
                    "后台任务状态暂时读取失败：${snapshot.error}",
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ] else if (status == null) ...[
                  const Text("后台任务状态暂时不可用。"),
                ] else ...[
                  Text(status.statusLabel),
                  const SizedBox(height: 6),
                  Text(
                    status.nextRunLabel,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  ...status.tasks.map(
                    (task) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      leading: Icon(_iconForStatus(task.status)),
                      title: Text("${task.title} · ${task.statusLabel}"),
                      subtitle: Text(
                        [
                          task.metricsLabel,
                          task.lastFinishedAtLabel,
                          task.note,
                        ].join("\n"),
                      ),
                      isThreeLine: true,
                    ),
                  ),
                  if (status.providerUsage.isNotEmpty) ...[
                    const Divider(),
                    Text(
                      "最近外部接口用量",
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 6),
                    ...status.providerUsage.map(
                      (item) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                        leading: const Icon(Icons.speed_outlined),
                        title: Text("${item.provider} · ${item.usageDate}"),
                        subtitle: Text(item.compactLabel),
                      ),
                    ),
                  ],
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _SecurityMetadataReviewCard extends StatefulWidget {
  const _SecurityMetadataReviewCard({required this.apiClient});

  final LooApiClient apiClient;

  @override
  State<_SecurityMetadataReviewCard> createState() =>
      _SecurityMetadataReviewCardState();
}

class _SecurityMetadataReviewCardState
    extends State<_SecurityMetadataReviewCard> {
  late Future<SecurityMetadataReviewSnapshot> _snapshot = _loadSnapshot();
  var _refreshingProvider = false;
  var _showAllItems = false;
  String? _message;

  Future<SecurityMetadataReviewSnapshot> _loadSnapshot() async {
    final response = await widget.apiClient.getSecurityMetadataReview();
    return SecurityMetadataReviewSnapshot.fromApiResponse(response);
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
    });
  }

  Future<void> _refreshProvider() async {
    if (_refreshingProvider) return;
    setState(() {
      _refreshingProvider = true;
      _message = null;
    });

    try {
      final response =
          await widget.apiClient.refreshSecurityMetadata(maxSecurities: 12);
      final data = response["data"];
      final payload =
          data is Map<String, dynamic> ? data : const <String, dynamic>{};
      final sampled = payload["sampledSecurityCount"] as int? ?? 0;
      final updated = payload["updatedCount"] as int? ?? 0;
      final skipped = payload["skippedCount"] as int? ?? 0;
      final failed = payload["failedCount"] as int? ?? 0;
      if (!mounted) return;
      setState(() {
        _message = "已检查 $sampled 个标的；更新 $updated，跳过 $skipped，失败 $failed。";
        _refreshingProvider = false;
        _snapshot = _loadSnapshot();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _message = error.toString();
        _refreshingProvider = false;
      });
    }
  }

  Future<void> _openManualEditor(SecurityMetadataItem item) async {
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _SecurityMetadataEditorSheet(
        apiClient: widget.apiClient,
        item: item,
      ),
    );
    if (updated == true && mounted) {
      setState(() {
        _message = "${item.symbol} 已确认分类口径。";
        _snapshot = _loadSnapshot();
      });
    }
  }

  Color _confidenceColor(BuildContext context, SecurityMetadataItem item) {
    if (item.locked) return Theme.of(context).colorScheme.primary;
    if (item.metadataConfidence >= 70) return Colors.teal;
    if (item.metadataConfidence >= 50) return Colors.orange;
    return Theme.of(context).colorScheme.error;
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FutureBuilder<SecurityMetadataReviewSnapshot>(
          future: _snapshot,
          builder: (context, snapshot) {
            final data = snapshot.data;
            final visibleItems = data == null
                ? const <SecurityMetadataItem>[]
                : _showAllItems
                    ? data.allItems
                    : data.items;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.verified_outlined),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        data?.title ?? "高级：标的资料可信度",
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      onPressed:
                          snapshot.connectionState == ConnectionState.waiting
                              ? null
                              : _refresh,
                      icon: const Icon(Icons.refresh),
                      tooltip: "刷新资料列表",
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                if (snapshot.connectionState == ConnectionState.waiting) ...[
                  const LinearProgressIndicator(),
                ] else if (snapshot.hasError) ...[
                  Text(
                    "标的资料暂时读取失败：${snapshot.error}",
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ] else if (data != null) ...[
                  Text(data.statusLabel),
                  const SizedBox(height: 6),
                  Text(
                    data.actionLabel,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      Chip(label: Text("共 ${data.totalCount} 个")),
                      Chip(label: Text("已确认 ${data.manualCount} 个")),
                      Chip(label: Text("建议复核 ${data.reviewCount} 个")),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      FilledButton.tonalIcon(
                        onPressed:
                            _refreshingProvider ? null : _refreshProvider,
                        icon: _refreshingProvider
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.manage_search_outlined),
                        label: Text(_refreshingProvider ? "刷新中" : "复核低可信资料"),
                      ),
                      if (data.allItems.length > data.items.length)
                        TextButton.icon(
                          onPressed: () =>
                              setState(() => _showAllItems = !_showAllItems),
                          icon: Icon(
                            _showAllItems
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                          ),
                          label: Text(_showAllItems ? "只看需复核" : "查看全部"),
                        ),
                    ],
                  ),
                  if (_message != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _message!,
                      style: TextStyle(
                        color: _message!.contains("失败") ||
                                _message!.contains("Exception")
                            ? Theme.of(context).colorScheme.error
                            : Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ],
                  const Divider(),
                  if (visibleItems.isEmpty)
                    const Text("当前资料可信，无需手动维护。")
                  else
                    ...visibleItems.take(12).map(
                          (item) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            leading: CircleAvatar(
                              backgroundColor: _confidenceColor(context, item),
                              child: Text(
                                item.metadataConfidence.toString(),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            title: Text(item.identityLabel),
                            subtitle: Text(
                              [
                                item.name,
                                item.detailLabel,
                                item.statusLabel,
                              ].join("\n"),
                            ),
                            isThreeLine: true,
                            trailing: const Icon(Icons.edit_outlined),
                            onTap: () => _openManualEditor(item),
                          ),
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

class _SecurityMetadataEditorSheet extends StatefulWidget {
  const _SecurityMetadataEditorSheet({
    required this.apiClient,
    required this.item,
  });

  final LooApiClient apiClient;
  final SecurityMetadataItem item;

  @override
  State<_SecurityMetadataEditorSheet> createState() =>
      _SecurityMetadataEditorSheetState();
}

class _SecurityMetadataEditorSheetState
    extends State<_SecurityMetadataEditorSheet> {
  late var _assetClass = _assetClassOptions.contains(
    widget.item.economicAssetClass,
  )
      ? widget.item.economicAssetClass
      : _assetClassOptions.first;
  late final _sectorController =
      TextEditingController(text: widget.item.economicSector);
  late final _regionController =
      TextEditingController(text: widget.item.exposureRegion);
  late final _notesController = TextEditingController(
    text: widget.item.metadataNotes.isNotEmpty
        ? widget.item.metadataNotes
        : "用户确认分类口径。",
  );
  var _saving = false;
  String? _error;

  static const _assetClassOptions = [
    "US Equity",
    "Canadian Equity",
    "International Equity",
    "Fixed Income",
    "Commodity",
    "Cash",
  ];

  @override
  void dispose() {
    _sectorController.dispose();
    _regionController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await widget.apiClient.updateSecurityMetadata(
        securityId: widget.item.securityId,
        economicAssetClass: _assetClass,
        economicSector: _sectorController.text.trim().isEmpty
            ? null
            : _sectorController.text.trim(),
        exposureRegion: _regionController.text.trim().isEmpty
            ? null
            : _regionController.text.trim(),
        notes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "确认 ${widget.item.identityLabel}",
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(
              "仅在分类明显异常时使用。保存后会锁定这条标的的资产类别、行业和地区口径。",
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _assetClass,
              decoration: const InputDecoration(labelText: "经济资产类别"),
              items: _assetClassOptions
                  .map(
                    (value) =>
                        DropdownMenuItem(value: value, child: Text(value)),
                  )
                  .toList(),
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _assetClass = value!),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _sectorController,
              decoration: const InputDecoration(
                labelText: "行业/主题",
                hintText: "例如 Precious Metals、Technology",
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _regionController,
              decoration: const InputDecoration(
                labelText: "暴露地区",
                hintText: "例如 United States、Canada、International",
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _notesController,
              maxLines: 2,
              decoration: const InputDecoration(labelText: "备注"),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.lock_outline),
                    label: Text(_saving ? "保存中" : "确认并锁定"),
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

class _AiMinisterSettings {
  const _AiMinisterSettings({
    required this.mode,
    required this.provider,
    required this.providerLabel,
    required this.model,
    required this.reasoningEffort,
    required this.baseUrl,
    required this.apiKeyConfigured,
    required this.apiKeyLast4,
    required this.serverKeyAvailable,
    required this.providerEnabled,
    required this.effectiveMode,
    required this.privacyNote,
    required this.recentUsage,
  });

  final String mode;
  final String provider;
  final String providerLabel;
  final String model;
  final String reasoningEffort;
  final String? baseUrl;
  final bool apiKeyConfigured;
  final String? apiKeyLast4;
  final bool serverKeyAvailable;
  final bool providerEnabled;
  final String effectiveMode;
  final String privacyNote;
  final List<_AiMinisterUsage> recentUsage;

  String get effectiveModeLabel {
    return switch (effectiveMode) {
      "gpt-5.5" => "实际使用外部 GPT",
      "gpt-5.5-pending-key" => "外部 GPT 待配置",
      _ => "实际使用本地大臣",
    };
  }

  String get apiKeyLabel {
    if (apiKeyConfigured) {
      return "用户 Key：****$apiKeyLast4";
    }
    if (serverKeyAvailable) {
      return "可用服务器 Key";
    }
    return "未配置 API Key";
  }

  String get providerEnabledLabel {
    return providerEnabled ? "外部 AI 已启用" : "外部 AI 未启用";
  }

  String get reasoningEffortLabel {
    return switch (reasoningEffort) {
      "minimal" => "最低",
      "low" => "低",
      "medium" => "中",
      "high" => "高",
      "xhigh" => "极高",
      _ => reasoningEffort,
    };
  }

  factory _AiMinisterSettings.fromJson(Map<String, dynamic> json) {
    final rawUsage = json["recentUsage"];
    return _AiMinisterSettings(
      mode: json["mode"] as String? ?? "local",
      provider: json["provider"] as String? ?? "official-openai",
      providerLabel: json["providerLabel"] as String? ?? "OpenAI 官方",
      model: json["model"] as String? ?? "gpt-5.5",
      reasoningEffort: json["reasoningEffort"] as String? ?? "medium",
      baseUrl: json["baseUrl"] as String?,
      apiKeyConfigured: json["apiKeyConfigured"] == true,
      apiKeyLast4: json["apiKeyLast4"] as String?,
      serverKeyAvailable: json["serverKeyAvailable"] == true,
      providerEnabled: json["providerEnabled"] == true,
      effectiveMode: json["effectiveMode"] as String? ?? "local",
      privacyNote: json["privacyNote"] as String? ?? "仅发送当前页面结构化摘要。",
      recentUsage: rawUsage is List
          ? rawUsage
              .whereType<Map<String, dynamic>>()
              .map(_AiMinisterUsage.fromJson)
              .toList()
          : const [],
    );
  }
}

class _AiMinisterUsage {
  const _AiMinisterUsage({
    required this.page,
    required this.provider,
    required this.status,
    required this.model,
    required this.tokenLabel,
    required this.retryLabel,
    required this.createdAt,
    this.failureKind,
    this.errorMessage,
  });

  final String page;
  final String provider;
  final String status;
  final String model;
  final String tokenLabel;
  final String retryLabel;
  final String createdAt;
  final String? failureKind;
  final String? errorMessage;

  factory _AiMinisterUsage.fromJson(Map<String, dynamic> json) {
    return _AiMinisterUsage(
      page: json["page"] as String? ?? "unknown",
      provider: json["provider"] as String? ?? "local",
      status: json["status"] as String? ?? "unknown",
      model: json["model"] as String? ?? "gpt-5.5",
      tokenLabel: json["tokenLabel"] as String? ?? "token 未返回",
      retryLabel: json["retryLabel"] as String? ?? "未重试",
      createdAt: json["createdAt"] as String? ?? "",
      failureKind: json["failureKind"] as String?,
      errorMessage: json["errorMessage"] as String?,
    );
  }
}

class _AiMinisterUsageTile extends StatelessWidget {
  const _AiMinisterUsageTile(this.item);

  final _AiMinisterUsage item;

  String get _statusLabel {
    switch (item.status) {
      case "success":
        return "成功";
      case "fallback":
        return "已用本地答复";
      case "failed":
        return "失败";
      default:
        return item.status;
    }
  }

  String get _providerLabel {
    switch (item.provider) {
      case "local":
        return "本地大臣";
      case "official-openai":
        return "OpenAI";
      case "openrouter-compatible":
        return "自定义 AI";
      default:
        return item.provider;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: Icon(
        item.status == "success"
            ? Icons.check_circle_outline
            : Icons.info_outline,
      ),
      title: Text("${item.page} · $_providerLabel · $_statusLabel"),
      subtitle: Text(
        [
          item.model,
          item.tokenLabel,
          item.retryLabel,
          if (item.failureKind != null) item.failureKind!,
          if (item.errorMessage != null) item.errorMessage!,
        ].join(" · "),
      ),
    );
  }
}

class _MarketDataStatusCard extends StatefulWidget {
  const _MarketDataStatusCard({required this.apiClient});

  final LooApiClient apiClient;

  @override
  State<_MarketDataStatusCard> createState() => _MarketDataStatusCardState();
}

class _MarketDataStatusCardState extends State<_MarketDataStatusCard> {
  late Future<MarketDataRefreshStatus> _status = _loadStatus();

  Future<MarketDataRefreshStatus> _loadStatus() async {
    final response = await widget.apiClient.getMarketDataRefreshRuns(limit: 5);
    return MarketDataRefreshStatus.fromApiResponse(response);
  }

  void _refresh() {
    setState(() {
      _status = _loadStatus();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FutureBuilder<MarketDataRefreshStatus>(
          future: _status,
          builder: (context, snapshot) {
            final status = snapshot.data;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.data_usage),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "行情刷新状态",
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      onPressed:
                          snapshot.connectionState == ConnectionState.waiting
                              ? null
                              : _refresh,
                      icon: const Icon(Icons.refresh),
                      tooltip: "刷新状态",
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  "顶部优先显示最近手动刷新；下方历史包含后台 worker 的预算保护记录。",
                ),
                if (snapshot.connectionState == ConnectionState.waiting) ...[
                  const SizedBox(height: 12),
                  const LinearProgressIndicator(),
                ] else if (snapshot.hasError) ...[
                  const SizedBox(height: 12),
                  Text(
                    "行情状态暂时读取失败：${snapshot.error}",
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ] else if (status == null || status.items.isEmpty) ...[
                  const SizedBox(height: 12),
                  const Text("还没有行情刷新记录。可以先点击上方“刷新组合行情”。"),
                ] else ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      Chip(label: Text(status.latestStatusLabel)),
                      Chip(label: Text("手动：${status.latestManualStatusLabel}")),
                      if (status.latestManualFxLabel != null)
                        Chip(label: Text(status.latestManualFxLabel!)),
                      if (status.latestManualFxFreshnessLabel != null)
                        Chip(label: Text(status.latestManualFxFreshnessLabel!)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    status.latestManualProviderStatusLabel,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "最近刷新：${status.latestStatusLabel} · ${status.latestProviderStatusLabel}",
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  _FreshnessPolicySummary(status.freshnessPolicy),
                  const Divider(),
                  ...status.items.map(_MarketDataRefreshRunTile.new),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _FreshnessPolicySummary extends StatelessWidget {
  const _FreshnessPolicySummary(this.policy);

  final MobileFreshnessPolicy policy;

  @override
  Widget build(BuildContext context) {
    final importantItems = policy.items
        .where((item) =>
            item.id == "quote" ||
            item.id == "fx" ||
            item.id == "history" ||
            item.id == "external-intelligence")
        .toList();
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("数据新鲜度策略", style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 6),
            Text(policy.workerBoundaryLabel),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Chip(label: Text("报价 ${policy.quoteTtlLabel}")),
                Chip(label: Text("FX ${policy.fxTtlLabel}")),
                Chip(label: Text("历史 ${policy.historyTtlLabel}")),
                Chip(label: Text("秘闻 ${policy.externalIntelligenceTtlLabel}")),
              ],
            ),
            if (importantItems.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...importantItems.take(4).map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        "${item.label}：${item.sourceLabel}；${item.staleBehaviorLabel}",
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MarketDataRefreshRunTile extends StatelessWidget {
  const _MarketDataRefreshRunTile(this.item);

  final MarketDataRefreshRunItem item;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: Icon(_statusIcon(item.status)),
      title: Text(item.titleLabel),
      subtitle: Text(item.subtitle),
      isThreeLine: true,
    );
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case "success":
        return Icons.check_circle_outline;
      case "partial":
        return Icons.warning_amber_outlined;
      case "failed":
        return Icons.error_outline;
      case "skipped":
        return Icons.do_not_disturb_on_outlined;
      case "running":
        return Icons.sync;
      default:
        return Icons.info_outline;
    }
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
  late Future<_ExternalResearchJobsStatus> _jobs = _loadJobs();

  Future<_ExternalResearchPolicy> _loadPolicy() async {
    final response = await widget.apiClient.getExternalResearchUsage();
    final data = response["data"];
    final payload =
        data is Map<String, dynamic> ? data : const <String, dynamic>{};
    return _ExternalResearchPolicy.fromUsageJson(payload);
  }

  Future<_ExternalResearchJobsStatus> _loadJobs() async {
    final response = await widget.apiClient.getExternalResearchJobs(limit: 5);
    final data = response["data"];
    final payload =
        data is Map<String, dynamic> ? data : const <String, dynamic>{};
    return _ExternalResearchJobsStatus.fromJson(payload);
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
                      if (policy.scheduledOverviewEnabled)
                        const Chip(label: Text("每日总览缓存"))
                      else
                        const Chip(label: Text("总览自动缓存未启用")),
                      if (policy.securityManualRefreshEnabled)
                        const Chip(label: Text("单标的限额刷新")),
                      Chip(label: Text("TTL >= ${policy.ttlHours} 小时")),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Text("总览秘闻只由后台 worker 每日缓存；单个标的可显式刷新且受次数和 TTL 限制。页面加载不会抓取新闻、论坛或付费外部 API。"),
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
                  _ExternalIntelligenceFreshnessNote(policy.freshnessPolicy),
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
                  FutureBuilder<_ExternalResearchJobsStatus>(
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
                      final jobStatus = jobsSnapshot.data;
                      final jobs = jobStatus?.items ??
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
                          if (jobStatus != null) ...[
                            Text(
                              jobStatus.summaryLine,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 6),
                          ],
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

class _ExternalIntelligenceFreshnessNote extends StatelessWidget {
  const _ExternalIntelligenceFreshnessNote(this.policy);

  final MobileFreshnessPolicy policy;

  @override
  Widget build(BuildContext context) {
    MobileFreshnessPolicyItem? externalItem;
    for (final item in policy.items) {
      if (item.id == "external-intelligence") {
        externalItem = item;
        break;
      }
    }
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Text(
          externalItem == null
              ? "外部情报 TTL：${policy.externalIntelligenceTtlLabel}。${policy.workerBoundaryLabel}"
              : "外部情报 TTL：${externalItem.ttlLabel}。${externalItem.staleBehaviorLabel} ${externalItem.userActionLabel}",
          style: Theme.of(context).textTheme.bodySmall,
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
      isThreeLine: true,
    );
  }
}

class _ExternalResearchJobsStatus {
  const _ExternalResearchJobsStatus({
    required this.latestStatusLabel,
    required this.latestStatusNote,
    required this.workerBoundaryLabel,
    required this.runningCount,
    required this.queuedCount,
    required this.failedCount,
    required this.skippedCount,
    required this.items,
  });

  final String latestStatusLabel;
  final String latestStatusNote;
  final String workerBoundaryLabel;
  final int runningCount;
  final int queuedCount;
  final int failedCount;
  final int skippedCount;
  final List<_ExternalResearchJobItem> items;

  String get summaryLine {
    return [
      latestStatusLabel,
      latestStatusNote,
      "运行 $runningCount / 排队 $queuedCount / 跳过 $skippedCount / 失败 $failedCount",
      workerBoundaryLabel,
    ].where((item) => item.isNotEmpty).join("\n");
  }

  factory _ExternalResearchJobsStatus.fromJson(Map<String, dynamic> json) {
    final summary = json["summary"] is Map<String, dynamic>
        ? json["summary"] as Map<String, dynamic>
        : const <String, dynamic>{};
    final rawItems = json["items"];
    return _ExternalResearchJobsStatus(
      latestStatusLabel: summary["latestStatusLabel"] as String? ?? "还没有外部研究任务",
      latestStatusNote:
          summary["latestStatusNote"] as String? ?? "最近没有外部研究任务；页面不会自动抓新闻或论坛。",
      workerBoundaryLabel: summary["workerBoundaryLabel"] as String? ??
          "外部研究只能由手动入队或后台 worker 执行。",
      runningCount: summary["runningCount"] as int? ?? 0,
      queuedCount: summary["queuedCount"] as int? ?? 0,
      failedCount: summary["failedCount"] as int? ?? 0,
      skippedCount: summary["skippedCount"] as int? ?? 0,
      items: rawItems is List
          ? rawItems
              .whereType<Map<String, dynamic>>()
              .map(_ExternalResearchJobItem.fromJson)
              .toList()
          : const [],
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
    required this.statusNote,
    required this.nextRetryLabel,
    required this.freshnessLabel,
    required this.resultExpiresAtLabel,
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
  final String statusNote;
  final String? nextRetryLabel;
  final String freshnessLabel;
  final String? resultExpiresAtLabel;
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
      case "skipped":
        return Icons.info_outline;
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
      statusNote,
      freshnessLabel,
      if (nextRetryLabel != null && nextRetryLabel!.isNotEmpty) nextRetryLabel!,
      if (resultExpiresAtLabel != null && resultExpiresAtLabel!.isNotEmpty)
        "有效至 $resultExpiresAtLabel",
      if (errorMessage != null && errorMessage!.isNotEmpty) errorMessage!,
    ];
    return details.join("\n");
  }

  factory _ExternalResearchJobItem.fromJson(Map<String, dynamic> json) {
    final rawCreatedAt = json["createdAt"];
    final freshness = json["freshness"] is Map<String, dynamic>
        ? json["freshness"] as Map<String, dynamic>
        : const <String, dynamic>{};
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
      statusNote: json["statusNote"] as String? ?? "状态待确认。",
      nextRetryLabel: json["nextRetryLabel"] as String?,
      freshnessLabel: freshness["freshnessLabel"] as String? ?? "缓存状态未知",
      resultExpiresAtLabel: freshness["resultExpiresAtLabel"] as String?,
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
    required this.scheduledOverviewEnabled,
    required this.securityManualRefreshEnabled,
    required this.minTtlSeconds,
    required this.dailyRunLimit,
    required this.maxSymbolsPerRun,
    required this.usedRuns,
    required this.remainingRuns,
    required this.freshnessPolicy,
    required this.sources,
  });

  final String statusLabel;
  final bool canRunLiveResearch;
  final bool scheduledOverviewEnabled;
  final bool securityManualRefreshEnabled;
  final int minTtlSeconds;
  final int dailyRunLimit;
  final int maxSymbolsPerRun;
  final int usedRuns;
  final int remainingRuns;
  final MobileFreshnessPolicy freshnessPolicy;
  final List<_ExternalResearchSource> sources;

  int get ttlHours => (minTtlSeconds / 3600).ceil();

  factory _ExternalResearchPolicy.fromUsageJson(Map<String, dynamic> json) {
    final policyJson = json["policy"] is Map<String, dynamic>
        ? json["policy"] as Map<String, dynamic>
        : const <String, dynamic>{};
    final usageJson = json["usage"] is Map<String, dynamic>
        ? json["usage"] as Map<String, dynamic>
        : const <String, dynamic>{};
    final freshnessPolicyJson = json["freshnessPolicy"] is Map<String, dynamic>
        ? json["freshnessPolicy"] as Map<String, dynamic>
        : const <String, dynamic>{};
    return _ExternalResearchPolicy.fromJson(
      policyJson,
      usageJson: usageJson,
      freshnessPolicyJson: freshnessPolicyJson,
    );
  }

  factory _ExternalResearchPolicy.fromJson(
    Map<String, dynamic> json, {
    Map<String, dynamic> usageJson = const <String, dynamic>{},
    Map<String, dynamic> freshnessPolicyJson = const <String, dynamic>{},
  }) {
    final rawSources = json["sources"];
    return _ExternalResearchPolicy(
      statusLabel: json["statusLabel"] as String? ?? "未启用",
      canRunLiveResearch: json["canRunLiveResearch"] == true,
      scheduledOverviewEnabled: json["scheduledOverviewEnabled"] == true,
      securityManualRefreshEnabled:
          json["securityManualRefreshEnabled"] != false,
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
      freshnessPolicy: MobileFreshnessPolicy.fromJson(freshnessPolicyJson),
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
      subtitle: Text(
          "${item.scopeLabel} · ${item.sourceLabel} · ${item.generatedAtLabel}\n${item.detail}"),
      trailing: const Icon(Icons.chevron_right),
      isThreeLine: true,
      onTap: () => _showRecentAnalysisDetail(context, item),
    );
  }

  void _showRecentAnalysisDetail(
    BuildContext context,
    _RecentAnalysisItem item,
  ) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.82,
        minChildSize: 0.45,
        maxChildSize: 0.95,
        builder: (context, scrollController) {
          return ListView(
            controller: scrollController,
            padding: const EdgeInsets.all(20),
            children: [
              Text(item.title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 6),
              Text("${item.scopeLabel} · ${item.sourceLabel}"),
              const SizedBox(height: 12),
              Text(item.detail),
              const SizedBox(height: 18),
              if (item.scorecards.isNotEmpty) ...[
                Text("评分卡", style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ...item.scorecards.map(
                  (scorecard) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      child: Text(scorecard.score.round().toString()),
                    ),
                    title: Text(scorecard.label),
                    subtitle: Text(scorecard.rationale),
                  ),
                ),
                const Divider(),
              ],
              if (item.risks.isNotEmpty) ...[
                Text("风险提示", style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ...item.risks.map(
                  (risk) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.warning_amber_outlined),
                    title: Text(risk.title),
                    subtitle: Text("${risk.severityLabel} · ${risk.detail}"),
                  ),
                ),
                const Divider(),
              ],
              if (item.actionItems.isNotEmpty) ...[
                Text("后续动作", style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ...item.actionItems.map(
                  (action) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Chip(label: Text(action.priority)),
                    title: Text(action.title),
                    subtitle: Text(action.detail),
                  ),
                ),
                const Divider(),
              ],
              if (item.sources.isNotEmpty) ...[
                Text("来源", style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ...item.sources.map(
                  (source) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.source_outlined),
                    title: Text(source.title),
                    subtitle: Text(source.subtitle),
                  ),
                ),
                const Divider(),
              ],
              Text(
                item.disclaimer,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _RecentAnalysisItem {
  const _RecentAnalysisItem({
    required this.scopeLabel,
    required this.sourceLabel,
    required this.title,
    required this.detail,
    required this.generatedAt,
    required this.scorecards,
    required this.risks,
    required this.actionItems,
    required this.sources,
    required this.disclaimer,
  });

  final String scopeLabel;
  final String sourceLabel;
  final String title;
  final String detail;
  final DateTime? generatedAt;
  final List<_AnalysisScorecard> scorecards;
  final List<_AnalysisRisk> risks;
  final List<_AnalysisActionItem> actionItems;
  final List<_AnalysisSource> sources;
  final String disclaimer;

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
      sourceLabel: json["sourceLabel"] as String? ?? "本地快扫",
      title: json["title"] as String? ?? "AI 快扫记录",
      detail: json["detail"] as String? ?? "",
      generatedAt:
          rawGeneratedAt is String ? DateTime.tryParse(rawGeneratedAt) : null,
      scorecards:
          _readJsonList(json["scorecards"], _AnalysisScorecard.fromJson),
      risks: _readJsonList(json["risks"], _AnalysisRisk.fromJson),
      actionItems:
          _readJsonList(json["actionItems"], _AnalysisActionItem.fromJson),
      sources: _readJsonList(json["sources"], _AnalysisSource.fromJson),
      disclaimer: json["disclaimer"] as String? ?? "仅用于研究学习，不构成投资建议。",
    );
  }
}

List<T> _readJsonList<T>(
  Object? value,
  T Function(Map<String, dynamic> json) fromJson,
) {
  return value is List
      ? value.whereType<Map<String, dynamic>>().map(fromJson).toList()
      : const [];
}

class _AnalysisScorecard {
  const _AnalysisScorecard({
    required this.label,
    required this.score,
    required this.rationale,
  });

  final String label;
  final double score;
  final String rationale;

  factory _AnalysisScorecard.fromJson(Map<String, dynamic> json) {
    final score = json["score"];
    return _AnalysisScorecard(
      label: json["label"] as String? ?? "评分",
      score: score is num ? score.toDouble() : 0,
      rationale: json["rationale"] as String? ?? "",
    );
  }
}

class _AnalysisRisk {
  const _AnalysisRisk({
    required this.severity,
    required this.title,
    required this.detail,
  });

  final String severity;
  final String title;
  final String detail;

  String get severityLabel {
    switch (severity) {
      case "high":
        return "高";
      case "medium":
        return "中";
      case "low":
        return "低";
      default:
        return "提示";
    }
  }

  factory _AnalysisRisk.fromJson(Map<String, dynamic> json) {
    return _AnalysisRisk(
      severity: json["severity"] as String? ?? "info",
      title: json["title"] as String? ?? "风险提示",
      detail: json["detail"] as String? ?? "",
    );
  }
}

class _AnalysisActionItem {
  const _AnalysisActionItem({
    required this.priority,
    required this.title,
    required this.detail,
  });

  final String priority;
  final String title;
  final String detail;

  factory _AnalysisActionItem.fromJson(Map<String, dynamic> json) {
    return _AnalysisActionItem(
      priority: json["priority"] as String? ?? "P2",
      title: json["title"] as String? ?? "后续动作",
      detail: json["detail"] as String? ?? "",
    );
  }
}

class _AnalysisSource {
  const _AnalysisSource({
    required this.title,
    required this.sourceType,
    required this.date,
  });

  final String title;
  final String sourceType;
  final String? date;

  String get subtitle {
    final parts = [
      sourceType,
      if (date != null && date!.isNotEmpty) date!,
    ];
    return parts.join(" · ");
  }

  factory _AnalysisSource.fromJson(Map<String, dynamic> json) {
    return _AnalysisSource(
      title: json["title"] as String? ?? "来源",
      sourceType: json["sourceType"] as String? ?? "portfolio-data",
      date: json["date"] as String?,
    );
  }
}
