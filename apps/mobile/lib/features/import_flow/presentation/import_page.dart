import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../../core/platform/external_link_stub.dart"
    if (dart.library.html) "../../../core/platform/external_link_web.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../data/mobile_import_models.dart";

class ImportPage extends StatefulWidget {
  const ImportPage({
    required this.apiClient,
    super.key,
  });

  final LooApiClient apiClient;

  @override
  State<ImportPage> createState() => _ImportPageState();
}

class _ImportPageState extends State<ImportPage> {
  late Future<MobileImportSnapshot> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  Future<MobileImportSnapshot> _loadSnapshot() async {
    final response = await widget.apiClient.getImportGuide();
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("导入数据格式不正确。");
    }

    return MobileImportSnapshot.fromJson(data);
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
    });
  }

  @override
  Widget build(BuildContext context) {
    return LooPageGradient(
      child: FutureBuilder<MobileImportSnapshot>(
        future: _snapshot,
        builder: (context, snapshot) {
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                if (snapshot.connectionState == ConnectionState.waiting)
                  const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (snapshot.hasError)
                  SliverFillRemaining(
                    child: _ErrorState(
                      message: snapshot.error.toString(),
                      onRetry: _refresh,
                    ),
                  )
                else if (snapshot.hasData)
                  SliverPadding(
                    padding: looPagePadding(context, top: 14),
                    sliver: SliverList.list(
                      children: [
                        _HeroCard(snapshot.data!),
                        const SizedBox(height: 14),
                        _EntryWorkbench(
                          data: snapshot.data!,
                          onCreateAccount: _openCreateAccountSheet,
                          onCreateHolding: () =>
                              _openCreateHoldingSheet(snapshot.data!.accounts),
                          onBrokerageSync: () => _openBrokerageImportSheet(
                            snapshot.data!.brokerageProviders,
                          ),
                        ),
                        const SizedBox(height: 14),
                        _AccountVaultCard(snapshot.data!.accounts),
                        if (snapshot.data!.notes.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          _RulesAccordion(snapshot.data!.notes),
                        ],
                      ],
                    ),
                  )
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _openCreateAccountSheet() async {
    final created = await showModalBottomSheet<_ImportResult>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _CreateAccountSheet(apiClient: widget.apiClient),
    );
    if (created != null && mounted) {
      _refresh();
      await _showImportResult(created);
    }
  }

  Future<void> _openCreateHoldingSheet(
      List<MobileImportAccount> accounts) async {
    if (accounts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("请先添加账户，再添加持仓。")),
      );
      return;
    }

    final created = await showModalBottomSheet<_ImportResult>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _CreateHoldingSheet(
        apiClient: widget.apiClient,
        accounts: accounts,
      ),
    );
    if (created != null && mounted) {
      _refresh();
      await _showImportResult(created);
    }
  }

  Future<void> _openBrokerageImportSheet(
      List<MobileBrokerageProvider> providers) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _BrokerageImportSheet(
        apiClient: widget.apiClient,
        providers: providers,
      ),
    );
  }

  Future<void> _showImportResult(_ImportResult result) {
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(result.title),
        content: Text(result.message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text("继续导入"),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text("知道了"),
          ),
        ],
      ),
    );
  }
}

class _ImportResult {
  const _ImportResult({
    required this.title,
    required this.message,
  });

  final String title;
  final String message;
}

class _HeroCard extends StatelessWidget {
  const _HeroCard(this.data);

  final MobileImportSnapshot data;

  @override
  Widget build(BuildContext context) {
    final holdingsCount = data.accounts.fold<int>(
      0,
      (sum, account) => sum + account.holdingCount,
    );
    return LooGlassCard(
      isHero: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("进贡", style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 6),
          Text(
            "把账户、持仓和券商同步先放进预览区；确认身份后再写入 Loo国账本。",
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: context.looTokens.mutedText,
                  height: 1.35,
                ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _HeroMetric(
                  label: "账户",
                  value: "${data.accounts.length}",
                  detail: "已入账",
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _HeroMetric(
                  label: "持仓",
                  value: "$holdingsCount",
                  detail: "已入账",
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroMetric extends StatelessWidget {
  const _HeroMetric({
    required this.label,
    required this.value,
    required this.detail,
  });

  final String label;
  final String value;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.20),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.looTokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.labelMedium),
            const SizedBox(height: 6),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            Text(
              detail,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EntryWorkbench extends StatelessWidget {
  const _EntryWorkbench({
    required this.data,
    required this.onCreateAccount,
    required this.onCreateHolding,
    required this.onBrokerageSync,
  });

  final MobileImportSnapshot data;
  final VoidCallback onCreateAccount;
  final VoidCallback onCreateHolding;
  final VoidCallback onBrokerageSync;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("上贡入口", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _EntryTile(
                  icon: Icons.edit_note_rounded,
                  title: "手动上贡",
                  subtitle: "添加账户 / 添加持仓",
                  onTap: () => _showManualSheet(context),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _EntryTile(
                  icon: Icons.sync_alt_rounded,
                  title: "券商同步",
                  subtitle: _brokerageSummary(data.brokerageProviders),
                  onTap: onBrokerageSync,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _brokerageSummary(List<MobileBrokerageProvider> providers) {
    final ready = providers
        .where((provider) => provider.status == "ready-to-build")
        .length;
    return ready > 0 ? "$ready 个可规划" : "IBKR / WS 预留";
  }

  void _showManualSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("手动上贡", style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(
                "先建账户，再补持仓；标的必须确认交易所和币种。",
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: context.looTokens.mutedText,
                    ),
              ),
              const SizedBox(height: 14),
              _ManualActionRow(
                title: "添加账户",
                subtitle: "TFSA / RRSP / FHSA / 应税账户",
                icon: Icons.account_balance_wallet_outlined,
                onTap: () {
                  Navigator.of(context).pop();
                  onCreateAccount();
                },
              ),
              const SizedBox(height: 10),
              _ManualActionRow(
                title: "添加持仓",
                subtitle: "搜索标的并确认 symbol + exchange + currency",
                icon: Icons.add_chart_rounded,
                onTap: () {
                  Navigator.of(context).pop();
                  onCreateHolding();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EntryTile extends StatelessWidget {
  const _EntryTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: context.looTokens.cardBorder),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: context.looTokens.accent),
              const SizedBox(height: 12),
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(
                subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: context.looTokens.mutedText,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ManualActionRow extends StatelessWidget {
  const _ManualActionRow({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      padding: const EdgeInsets.all(14),
      onTap: onTap,
      child: Row(
        children: [
          Icon(icon, color: context.looTokens.accent),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: context.looTokens.mutedText,
                      ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }
}

class _BrokerageImportSheet extends StatelessWidget {
  const _BrokerageImportSheet({
    required this.apiClient,
    required this.providers,
  });

  final LooApiClient apiClient;
  final List<MobileBrokerageProvider> providers;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, bottomInset + 20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("券商同步", style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              const Text(
                  "统一入口会先生成导入草稿，确认账户、持仓和现金后再写入 Loo国账本。IBKR 连接可保存 90 天，后续手动刷新无需重复输入。"),
              const SizedBox(height: 14),
              ...providers.map(
                (provider) => _BrokerageProviderCard(
                  provider,
                  onTap: switch (provider.id) {
                    "ibkr-flex" => () => _openIbkrFlexPreview(context),
                    "snaptrade" => () => _openSnapTradePreview(context),
                    _ => null,
                  },
                ),
              ),
              const SizedBox(height: 12),
              const _BrokerageFlowCard(),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text("知道了"),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openIbkrFlexPreview(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _IbkrFlexPreviewSheet(apiClient: apiClient),
    );
  }

  Future<void> _openSnapTradePreview(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _SnapTradePreviewSheet(apiClient: apiClient),
    );
  }
}

class _AccountVaultCard extends StatefulWidget {
  const _AccountVaultCard(this.accounts);

  final List<MobileImportAccount> accounts;

  @override
  State<_AccountVaultCard> createState() => _AccountVaultCardState();
}

class _AccountVaultCardState extends State<_AccountVaultCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final accounts = widget.accounts;
    final holdingCount = accounts.fold<int>(
      0,
      (sum, account) => sum + account.holdingCount,
    );

    return LooGlassCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: accounts.isEmpty
                ? null
                : () => setState(() => _expanded = !_expanded),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "已入国库",
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        accounts.isEmpty
                            ? "还没有账户"
                            : "${accounts.length} 个账户 · $holdingCount 个持仓",
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: context.looTokens.mutedText,
                            ),
                      ),
                    ],
                  ),
                ),
                _ImportPill("${accounts.length} 个账户"),
                const SizedBox(width: 8),
                AnimatedRotation(
                  turns: _expanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 180),
                  child: const Icon(Icons.keyboard_arrow_down_rounded),
                ),
              ],
            ),
          ),
          if (accounts.isEmpty) ...[
            const SizedBox(height: 10),
            const _EmptyVaultMessage(),
          ] else if (_expanded) ...[
            const SizedBox(height: 10),
            ...accounts.map(_AccountCard.new),
          ],
        ],
      ),
    );
  }
}

class _EmptyVaultMessage extends StatelessWidget {
  const _EmptyVaultMessage();

  @override
  Widget build(BuildContext context) {
    return Text(
      "还没有账户。先从“手动上贡”建立第一个账户桶。",
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: context.looTokens.mutedText,
          ),
    );
  }
}

class _ImportPill extends StatelessWidget {
  const _ImportPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: context.looTokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: Text(label, style: Theme.of(context).textTheme.labelMedium),
      ),
    );
  }
}

class _RulesAccordion extends StatefulWidget {
  const _RulesAccordion(this.notes);

  final List<String> notes;

  @override
  State<_RulesAccordion> createState() => _RulesAccordionState();
}

class _RulesAccordionState extends State<_RulesAccordion> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    "上贡规矩",
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                AnimatedRotation(
                  turns: _expanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 180),
                  child: const Icon(Icons.keyboard_arrow_down_rounded),
                ),
              ],
            ),
          ),
          if (_expanded) ...[
            const SizedBox(height: 10),
            ...widget.notes.take(5).map(
                  (note) => Padding(
                    padding: const EdgeInsets.only(bottom: 7),
                    child: Text("• $note"),
                  ),
                ),
          ],
        ],
      ),
    );
  }
}

class _BrokerageProviderCard extends StatelessWidget {
  const _BrokerageProviderCard(this.provider, {this.onTap});

  final MobileBrokerageProvider provider;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isReady = provider.status == "ready-to-build";
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: LooGlassCard(
        padding: const EdgeInsets.all(14),
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(provider.name,
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: isReady
                        ? colorScheme.primaryContainer
                        : colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    child: Text(provider.statusLabel),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              provider.id == "ibkr-flex"
                  ? "保存 Flex Token 后可手动刷新草稿"
                  : "打开 SnapTrade 授权后读取 Wealthsimple 草稿",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
            if (onTap != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(
                    "进入设置",
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: context.looTokens.accent,
                        ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    Icons.arrow_forward_rounded,
                    size: 17,
                    color: context.looTokens.accent,
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _IbkrFlexPreviewSheet extends StatefulWidget {
  const _IbkrFlexPreviewSheet({required this.apiClient});

  final LooApiClient apiClient;

  @override
  State<_IbkrFlexPreviewSheet> createState() => _IbkrFlexPreviewSheetState();
}

class _IbkrFlexPreviewSheetState extends State<_IbkrFlexPreviewSheet> {
  final _formKey = GlobalKey<FormState>();
  final _tokenController = TextEditingController();
  final _queryIdController = TextEditingController();
  var _loading = false;
  var _confirming = false;
  var _connectionLoading = true;
  var _savingConnection = false;
  var _syncingConnection = false;
  var _deletingConnection = false;
  String? _error;
  MobileIbkrFlexPreview? _preview;
  MobileBrokerageConnection? _connection;
  final Set<String> _selectedAccountIds = {};
  final Set<String> _reviewingHoldingKeys = {};

  @override
  void initState() {
    super.initState();
    _loadConnection();
  }

  @override
  void dispose() {
    _tokenController.dispose();
    _queryIdController.dispose();
    super.dispose();
  }

  Future<void> _loadConnection() async {
    setState(() {
      _connectionLoading = true;
      _error = null;
    });
    try {
      final response = await widget.apiClient.getIbkrBrokerageConnection();
      final data = response["data"];
      final connectionJson =
          data is Map<String, dynamic> ? data["connection"] : null;
      if (mounted) {
        setState(() {
          _connection = connectionJson is Map<String, dynamic>
              ? MobileBrokerageConnection.fromJson(connectionJson)
              : null;
          _connectionLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _connectionLoading = false;
        });
      }
    }
  }

  Future<void> _saveConnection() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() {
      _savingConnection = true;
      _error = null;
    });
    try {
      final response = await widget.apiClient.saveIbkrBrokerageConnection(
        token: _tokenController.text.trim(),
        queryId: _queryIdController.text.trim(),
        ttlDays: 90,
      );
      final data = response["data"];
      final connectionJson =
          data is Map<String, dynamic> ? data["connection"] : null;
      if (connectionJson is! Map<String, dynamic>) {
        throw const LooApiException("IBKR 连接返回格式不正确。");
      }
      if (mounted) {
        setState(() {
          _connection = MobileBrokerageConnection.fromJson(connectionJson);
          _savingConnection = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("IBKR 连接已保存，90 天内手动同步无需重复输入。")),
        );
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _savingConnection = false;
        });
      }
    }
  }

  Future<void> _syncSavedConnection() async {
    setState(() {
      _syncingConnection = true;
      _error = null;
      _preview = null;
    });
    try {
      final response = await widget.apiClient.syncIbkrBrokerageConnection();
      final data = response["data"];
      final previewJson = data is Map<String, dynamic> ? data["preview"] : null;
      final connectionJson =
          data is Map<String, dynamic> ? data["connection"] : null;
      if (previewJson is! Map<String, dynamic>) {
        throw const LooApiException("IBKR 同步返回格式不正确。");
      }
      if (mounted) {
        setState(() {
          _preview = MobileIbkrFlexPreview.fromJson(previewJson);
          _selectedAccountIds
            ..clear()
            ..addAll(_preview!.readyAccounts.map((account) => account.accountId));
          _connection = connectionJson is Map<String, dynamic>
              ? MobileBrokerageConnection.fromJson(connectionJson)
              : _connection;
          _syncingConnection = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _syncingConnection = false;
        });
      }
    }
  }

  Future<void> _deleteConnection() async {
    setState(() {
      _deletingConnection = true;
      _error = null;
    });
    try {
      await widget.apiClient.deleteIbkrBrokerageConnection();
      if (mounted) {
        setState(() {
          _connection = null;
          _preview = null;
          _deletingConnection = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _deletingConnection = false;
        });
      }
    }
  }

  Future<void> _confirmDraft() async {
    final preview = _preview;
    if (preview == null || preview.draftId.isEmpty) {
      return;
    }
    setState(() {
      _confirming = true;
      _error = null;
    });

    try {
      final response =
          await widget.apiClient.confirmBrokerageImportDraft(
        preview.draftId,
        selectedAccountIds: _selectedAccountIds.toList(),
      );
      final data = response["data"];
      final accountsCreated = data is Map<String, dynamic>
          ? data["accountsCreated"] as int? ?? 0
          : 0;
      final holdingsCreated = data is Map<String, dynamic>
          ? data["holdingsCreated"] as int? ?? 0
          : 0;
      final holdingsUpdated = data is Map<String, dynamic>
          ? data["holdingsUpdated"] as int? ?? 0
          : 0;
      if (mounted) {
        Navigator.of(context).pop();
        await showDialog<void>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text("IBKR 草稿已写入"),
            content: Text(
              "新增 $accountsCreated 个账户，新增 $holdingsCreated 个持仓，更新 $holdingsUpdated 个持仓。回到国库后可继续检查账户和标的详情。",
            ),
            actions: [
              FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text("知道了"),
              ),
            ],
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _confirming = false;
        });
      }
    }
  }

  Future<void> _reviewDraftHolding({
    required MobileIbkrFlexAccount account,
    required MobileIbkrFlexHolding holding,
    required String action,
    String? exchange,
  }) async {
    final preview = _preview;
    if (preview == null || preview.draftId.isEmpty) {
      return;
    }
    final key = _draftHoldingKey(account, holding);
    setState(() {
      _reviewingHoldingKeys.add(key);
      _error = null;
    });
    try {
      final response = await widget.apiClient.reviewBrokerageImportDraftHolding(
        draftId: preview.draftId,
        accountId: account.accountId,
        symbol: holding.symbol,
        currency: holding.currency,
        action: action,
        exchange: exchange,
      );
      final data = response["data"];
      final previewJson = data is Map<String, dynamic> ? data["preview"] : null;
      if (previewJson is! Map<String, dynamic>) {
        throw const LooApiException("草稿确认返回格式不正确。");
      }
      if (mounted) {
        setState(() {
          _preview = MobileIbkrFlexPreview.fromJson(previewJson);
          final readyIds =
              _preview!.readyAccounts.map((item) => item.accountId).toSet();
          _selectedAccountIds
            ..removeWhere((id) => !readyIds.contains(id))
            ..addAll(readyIds);
          _reviewingHoldingKeys.remove(key);
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _reviewingHoldingKeys.remove(key);
        });
      }
    }
  }

  Future<void> _previewFlex() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _preview = null;
    });

    try {
      final response = await widget.apiClient.previewIbkrFlexImport(
        token: _tokenController.text.trim(),
        queryId: _queryIdController.text.trim(),
      );
      final data = response["data"];
      final previewJson = data is Map<String, dynamic> ? data["preview"] : null;
      if (previewJson is! Map<String, dynamic>) {
        throw const LooApiException("IBKR 预览返回格式不正确。");
      }
      if (mounted) {
        setState(() {
          _preview = MobileIbkrFlexPreview.fromJson(previewJson);
          _selectedAccountIds
            ..clear()
            ..addAll(_preview!.readyAccounts.map((account) => account.accountId));
          _loading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 4, 20, bottomInset + 20),
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "IBKR Flex 预览",
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  "先在 IBKR 客户端门户生成授权口令和查询编号。Loo国只用它读取一次预览，不保存授权口令；确认后才写入账本。",
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: context.looTokens.mutedText,
                      ),
                ),
                const SizedBox(height: 12),
                if (_connectionLoading)
                  const Center(child: CircularProgressIndicator())
                else if (_connection != null)
                  _IbkrConnectionCard(
                    _connection!,
                    syncing: _syncingConnection,
                    deleting: _deletingConnection,
                    onSync: _syncingConnection ? null : _syncSavedConnection,
                    onDelete: _deletingConnection ? null : _deleteConnection,
                  ),
                if (_connection != null) const SizedBox(height: 12),
                const _IbkrSetupGuideCard(),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _tokenController,
                  decoration: const InputDecoration(
                    labelText: "授权口令（Flex Token）",
                    helperText: "报告 → Flex 查询 → Flex 网页服务设置",
                  ),
                  obscureText: true,
                  validator: (value) => value == null || value.trim().length < 8
                      ? "请输入有效的授权口令"
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _queryIdController,
                  decoration: const InputDecoration(
                    labelText: "查询编号（Query ID）",
                    helperText: "保存活动 Flex 查询后显示的数字编号",
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) =>
                      value == null || value.trim().isEmpty ? "请输入查询编号" : null,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ],
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _savingConnection ? null : _saveConnection,
                        icon: _savingConnection
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.lock_rounded),
                        label: Text(_savingConnection ? "保存中..." : "保存连接"),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _loading ? null : _previewFlex,
                        icon: _loading
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.search_rounded),
                        label: Text(_loading ? "读取中..." : "一次性预览"),
                      ),
                    ),
                  ],
                ),
                if (_preview != null) ...[
                  const SizedBox(height: 16),
                  _IbkrPreviewResultCard(
                    _preview!,
                    confirming: _confirming,
                    onConfirm: _confirming ? null : _confirmDraft,
                    selectedAccountIds: _selectedAccountIds,
                    reviewingHoldingKeys: _reviewingHoldingKeys,
                    onSelectionChanged: (accountId, selected) {
                      setState(() {
                        if (selected) {
                          _selectedAccountIds.add(accountId);
                        } else {
                          _selectedAccountIds.remove(accountId);
                        }
                      });
                    },
                    onReviewHolding: _reviewDraftHolding,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _IbkrSetupGuideCard extends StatelessWidget {
  const _IbkrSetupGuideCard();

  @override
  Widget build(BuildContext context) {
    const steps = [
      (
        title: "1. 生成授权口令",
        body: "业绩与报告 → 自主查询 → 自主网络服务配置，确认状态为“已启用”，进入齿轮后复制“授权口令 / Token”。",
      ),
      (
        title: "2. 创建活动 Flex 查询",
        body: "在“活动自主查询”右上角点 +，新建查询。格式选 XML，保存后不要填查询名称，要复制数字“查询编号 / Query ID”。",
      ),
      (
        title: "3. 必选报表字段",
        body: "勾选：账户信息、未平仓仓位、现金报告、以基础货币计的实现和未实现业绩总结。交易可选，股息/利息/税务/公司行动先不用。",
      ),
    ];

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.looTokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.key_rounded,
                  size: 18,
                  color: context.looTokens.accent,
                ),
                const SizedBox(width: 7),
                Text(
                  "IBKR 设置指引",
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ],
            ),
            const SizedBox(height: 8),
            ...steps.map(
              (step) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      step.title,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      step.body,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: context.looTokens.mutedText,
                          ),
                    ),
                  ],
                ),
              ),
            ),
            Text(
              "如果预览没有持仓，优先检查“未平仓仓位”；如果没有净值/现金，检查“现金报告”和“基础币种权益总结”。运行查询下载 XML 只用于自查，Loo国会用 Token + Query ID 自动拉取。",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.looTokens.accent,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IbkrConnectionCard extends StatelessWidget {
  const _IbkrConnectionCard(
    this.connection, {
    required this.syncing,
    required this.deleting,
    required this.onSync,
    required this.onDelete,
  });

  final MobileBrokerageConnection connection;
  final bool syncing;
  final bool deleting;
  final VoidCallback? onSync;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final usable = connection.isUsable;
    return LooGlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  usable ? "IBKR 已连接" : "IBKR 连接需处理",
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              _ImportPill(_connectionStatusLabel(connection.status)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            [
              "Query ID ${connection.queryId}",
              if (connection.tokenLast4 != null)
                "Token 尾号 ${connection.tokenLast4}",
              "有效期 ${_formatIsoDate(connection.tokenExpiresAt)}",
            ].join(" · "),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
          if (connection.lastSyncedAt != null) ...[
            const SizedBox(height: 4),
            Text(
              "上次同步 ${_formatIsoDate(connection.lastSyncedAt!)}"
              "${connection.lastSyncStatus == "failed" ? " · 失败" : ""}",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
          ],
          if (connection.lastSyncError != null) ...[
            const SizedBox(height: 6),
            Text(
              connection.lastSyncError!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: usable ? onSync : null,
                  icon: syncing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.sync_rounded),
                  label: Text(syncing ? "同步中..." : "刷新 IBKR 草稿"),
                ),
              ),
              const SizedBox(width: 10),
              IconButton.outlined(
                tooltip: "删除连接",
                onPressed: deleting ? null : onDelete,
                icon: deleting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.delete_outline_rounded),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            "同步只生成导入草稿，不会自动覆盖账本；你确认后才写入。",
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
        ],
      ),
    );
  }
}

class _SnapTradePreviewSheet extends StatefulWidget {
  const _SnapTradePreviewSheet({required this.apiClient});

  final LooApiClient apiClient;

  @override
  State<_SnapTradePreviewSheet> createState() => _SnapTradePreviewSheetState();
}

class _SnapTradePreviewSheetState extends State<_SnapTradePreviewSheet> {
  var _connectionLoading = true;
  var _creatingPortal = false;
  var _syncing = false;
  var _deleting = false;
  var _confirming = false;
  String? _error;
  MobileBrokerageConnection? _connection;
  MobileSnapTradePortal? _portal;
  MobileIbkrFlexPreview? _preview;
  final Set<String> _selectedAccountIds = {};
  final Set<String> _reviewingHoldingKeys = {};

  @override
  void initState() {
    super.initState();
    _loadConnection();
  }

  Future<void> _loadConnection() async {
    setState(() {
      _connectionLoading = true;
      _error = null;
    });
    try {
      final response = await widget.apiClient.getSnapTradeBrokerageConnection();
      final data = response["data"];
      final connectionJson =
          data is Map<String, dynamic> ? data["connection"] : null;
      if (mounted) {
        setState(() {
          _connection = connectionJson is Map<String, dynamic>
              ? MobileBrokerageConnection.fromJson(connectionJson)
              : null;
          _connectionLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _connectionLoading = false;
        });
      }
    }
  }

  Future<void> _createPortal() async {
    setState(() {
      _creatingPortal = true;
      _error = null;
    });
    try {
      final response = await widget.apiClient.createSnapTradeConnectionPortal();
      final data = response["data"];
      final portalJson = data is Map<String, dynamic> ? data["portal"] : null;
      final connectionJson =
          data is Map<String, dynamic> ? data["connection"] : null;
      if (portalJson is! Map<String, dynamic>) {
        throw const LooApiException("SnapTrade 连接入口返回格式不正确。");
      }
      final portal = MobileSnapTradePortal.fromJson(portalJson);
      if (portal.redirectUri.isEmpty) {
        throw const LooApiException("SnapTrade 没有返回连接入口链接。");
      }
      await openExternalLink(portal.redirectUri);
      if (mounted) {
        setState(() {
          _portal = portal;
          _connection = connectionJson is Map<String, dynamic>
              ? MobileBrokerageConnection.fromJson(connectionJson)
              : _connection;
          _creatingPortal = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _creatingPortal = false;
        });
      }
    }
  }

  Future<void> _syncConnection() async {
    setState(() {
      _syncing = true;
      _error = null;
      _preview = null;
    });
    try {
      final response =
          await widget.apiClient.syncSnapTradeBrokerageConnection();
      final data = response["data"];
      final previewJson = data is Map<String, dynamic> ? data["preview"] : null;
      final connectionJson =
          data is Map<String, dynamic> ? data["connection"] : null;
      if (previewJson is! Map<String, dynamic>) {
        throw const LooApiException("SnapTrade 同步返回格式不正确。");
      }
      if (mounted) {
        setState(() {
          _preview = MobileIbkrFlexPreview.fromJson(previewJson);
          _selectedAccountIds
            ..clear()
            ..addAll(
              _preview!.readyAccounts.map((account) => account.accountId),
            );
          _connection = connectionJson is Map<String, dynamic>
              ? MobileBrokerageConnection.fromJson(connectionJson)
              : _connection;
          _syncing = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _syncing = false;
        });
      }
    }
  }

  Future<void> _deleteConnection() async {
    setState(() {
      _deleting = true;
      _error = null;
    });
    try {
      await widget.apiClient.deleteSnapTradeBrokerageConnection();
      if (mounted) {
        setState(() {
          _connection = null;
          _portal = null;
          _preview = null;
          _deleting = false;
        });
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

  Future<void> _confirmDraft() async {
    final preview = _preview;
    if (preview == null || preview.draftId.isEmpty) {
      return;
    }
    setState(() {
      _confirming = true;
      _error = null;
    });

    try {
      final response =
          await widget.apiClient.confirmBrokerageImportDraft(
        preview.draftId,
        selectedAccountIds: _selectedAccountIds.toList(),
      );
      final data = response["data"];
      final accountsCreated = data is Map<String, dynamic>
          ? data["accountsCreated"] as int? ?? 0
          : 0;
      final holdingsCreated = data is Map<String, dynamic>
          ? data["holdingsCreated"] as int? ?? 0
          : 0;
      final holdingsUpdated = data is Map<String, dynamic>
          ? data["holdingsUpdated"] as int? ?? 0
          : 0;
      if (mounted) {
        Navigator.of(context).pop();
        await showDialog<void>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text("Wealthsimple 草稿已写入"),
            content: Text(
              "新增 $accountsCreated 个账户，新增 $holdingsCreated 个持仓，更新 $holdingsUpdated 个持仓。",
            ),
            actions: [
              FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text("知道了"),
              ),
            ],
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _confirming = false;
        });
      }
    }
  }

  Future<void> _reviewDraftHolding({
    required MobileIbkrFlexAccount account,
    required MobileIbkrFlexHolding holding,
    required String action,
    String? exchange,
  }) async {
    final preview = _preview;
    if (preview == null || preview.draftId.isEmpty) {
      return;
    }
    final key = _draftHoldingKey(account, holding);
    setState(() {
      _reviewingHoldingKeys.add(key);
      _error = null;
    });
    try {
      final response = await widget.apiClient.reviewBrokerageImportDraftHolding(
        draftId: preview.draftId,
        accountId: account.accountId,
        symbol: holding.symbol,
        currency: holding.currency,
        action: action,
        exchange: exchange,
      );
      final data = response["data"];
      final previewJson = data is Map<String, dynamic> ? data["preview"] : null;
      if (previewJson is! Map<String, dynamic>) {
        throw const LooApiException("草稿确认返回格式不正确。");
      }
      if (mounted) {
        setState(() {
          _preview = MobileIbkrFlexPreview.fromJson(previewJson);
          final readyIds =
              _preview!.readyAccounts.map((item) => item.accountId).toSet();
          _selectedAccountIds
            ..removeWhere((id) => !readyIds.contains(id))
            ..addAll(readyIds);
          _reviewingHoldingKeys.remove(key);
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _reviewingHoldingKeys.remove(key);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 4, 20, bottomInset + 20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Wealthsimple 同步",
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(
                "通过 SnapTrade 只读授权读取 Wealthsimple 账户和持仓。Loo国会先生成草稿，确认后才写入账本。",
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: context.looTokens.mutedText,
                    ),
              ),
              const SizedBox(height: 12),
              if (_connectionLoading)
                const Center(child: CircularProgressIndicator())
              else
                _SnapTradeConnectionCard(
                  connection: _connection,
                  portal: _portal,
                  creatingPortal: _creatingPortal,
                  syncing: _syncing,
                  deleting: _deleting,
                  onCreatePortal: _creatingPortal ? null : _createPortal,
                  onSync: _syncing ? null : _syncConnection,
                  onDelete: _deleting ? null : _deleteConnection,
                ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              if (_preview != null) ...[
                const SizedBox(height: 16),
                _IbkrPreviewResultCard(
                  _preview!,
                  confirming: _confirming,
                  onConfirm: _confirming ? null : _confirmDraft,
                  selectedAccountIds: _selectedAccountIds,
                  reviewingHoldingKeys: _reviewingHoldingKeys,
                  onSelectionChanged: (accountId, selected) {
                    setState(() {
                      if (selected) {
                        _selectedAccountIds.add(accountId);
                      } else {
                        _selectedAccountIds.remove(accountId);
                      }
                    });
                  },
                  onReviewHolding: _reviewDraftHolding,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SnapTradeConnectionCard extends StatelessWidget {
  const _SnapTradeConnectionCard({
    required this.connection,
    required this.portal,
    required this.creatingPortal,
    required this.syncing,
    required this.deleting,
    required this.onCreatePortal,
    required this.onSync,
    required this.onDelete,
  });

  final MobileBrokerageConnection? connection;
  final MobileSnapTradePortal? portal;
  final bool creatingPortal;
  final bool syncing;
  final bool deleting;
  final VoidCallback? onCreatePortal;
  final VoidCallback? onSync;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final usable = connection?.isUsable ?? false;
    return LooGlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  usable ? "SnapTrade 已准备" : "连接 Wealthsimple",
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              _ImportPill(
                connection == null
                    ? "待授权"
                    : _connectionStatusLabel(connection!.status),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            connection == null
                ? "先打开 SnapTrade 入口，选择 Wealthsimple 完成只读授权。"
                : [
                    "User ${connection!.queryId}",
                    "有效期 ${_formatIsoDate(connection!.tokenExpiresAt)}",
                  ].join(" · "),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
          if (connection?.lastSyncedAt != null) ...[
            const SizedBox(height: 4),
            Text(
              "上次同步 ${_formatIsoDate(connection!.lastSyncedAt!)}"
              "${connection!.lastSyncStatus == "failed" ? " · 失败" : ""}",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
          ],
          if (connection?.lastSyncError != null) ...[
            const SizedBox(height: 6),
            Text(
              connection!.lastSyncError!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (portal != null) ...[
            const SizedBox(height: 8),
            Text(
              "连接入口已打开。授权完成后返回这里点击“读取草稿”。入口链接通常 5 分钟内有效。",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.looTokens.accent,
                  ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onCreatePortal,
                  icon: creatingPortal
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.open_in_new_rounded),
                  label: Text(creatingPortal ? "打开中..." : "打开授权入口"),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: usable ? onSync : null,
                  icon: syncing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.sync_rounded),
                  label: Text(syncing ? "读取中..." : "读取草稿"),
                ),
              ),
            ],
          ),
          if (connection != null) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: deleting ? null : onDelete,
                icon: deleting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.delete_outline_rounded),
                label: const Text("删除连接"),
              ),
            ),
          ],
          const SizedBox(height: 4),
          Text(
            "SnapTrade 返回的是券商缓存快照；确认草稿前仍需检查账户、标的和币种。",
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
        ],
      ),
    );
  }
}

String _connectionStatusLabel(String status) {
  switch (status) {
    case "active":
      return "可用";
    case "expired":
      return "已过期";
    case "error":
      return "需重试";
    case "revoked":
      return "已删除";
    default:
      return status;
  }
}

class _IbkrPreviewResultCard extends StatelessWidget {
  const _IbkrPreviewResultCard(
    this.preview, {
    required this.confirming,
    required this.onConfirm,
    required this.selectedAccountIds,
    required this.reviewingHoldingKeys,
    required this.onSelectionChanged,
    required this.onReviewHolding,
  });

  final MobileIbkrFlexPreview preview;
  final bool confirming;
  final VoidCallback? onConfirm;
  final Set<String> selectedAccountIds;
  final Set<String> reviewingHoldingKeys;
  final void Function(String accountId, bool selected) onSelectionChanged;
  final Future<void> Function({
    required MobileIbkrFlexAccount account,
    required MobileIbkrFlexHolding holding,
    required String action,
    String? exchange,
  }) onReviewHolding;

  @override
  Widget build(BuildContext context) {
    final selectedReadyAccounts = preview.readyAccounts
        .where((account) => selectedAccountIds.contains(account.accountId))
        .toList();
    final disabledConfirm = selectedReadyAccounts.isEmpty || confirming;
    return LooGlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(preview.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(
            preview.subtitle,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _ImportPill("${preview.accountCount} 个账户"),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _ImportPill("${preview.holdingCount} 个持仓"),
              ),
            ],
          ),
          if (preview.accounts.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...preview.accounts.map(
              (account) => _IbkrPreviewAccountCard(
                account,
                selected: selectedAccountIds.contains(account.accountId),
                reviewingHoldingKeys: reviewingHoldingKeys,
                onSelectionChanged: account.isReady
                    ? (value) => onSelectionChanged(account.accountId, value)
                    : null,
                onReviewHolding: onReviewHolding,
              ),
            ),
          ],
          if (preview.warnings.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...preview.warnings.take(3).map(
                  (warning) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      "• $warning",
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: context.looTokens.mutedText,
                          ),
                    ),
                  ),
                ),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: disabledConfirm ? null : onConfirm,
              icon: confirming
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check_circle_rounded),
              label: Text(confirming ? "写入中..." : "确认写入 Loo国账本"),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            preview.reviewAccounts.isNotEmpty
                ? "已自动跳过 ${preview.reviewAccounts.length} 个需要确认的账户；可先写入已勾选账户。"
                : "当前使用安全快照合并：同账户同标的会更新，不会重复新增。",
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
        ],
      ),
    );
  }
}

class _IbkrPreviewAccountCard extends StatelessWidget {
  const _IbkrPreviewAccountCard(
    this.account, {
    required this.selected,
    required this.reviewingHoldingKeys,
    required this.onSelectionChanged,
    required this.onReviewHolding,
  });

  final MobileIbkrFlexAccount account;
  final bool selected;
  final Set<String> reviewingHoldingKeys;
  final ValueChanged<bool>? onSelectionChanged;
  final Future<void> Function({
    required MobileIbkrFlexAccount account,
    required MobileIbkrFlexHolding holding,
    required String action,
    String? exchange,
  }) onReviewHolding;

  @override
  Widget build(BuildContext context) {
    final reviewHoldings = account.holdings
        .where(
          (holding) =>
              holding.identityStatus != "ready" &&
              holding.identityStatus != "skipped",
        )
        .toList();
    final readyHoldings =
        account.holdings.where((holding) => !reviewHoldings.contains(holding));
    final holdings = [
      ...reviewHoldings,
      ...readyHoldings.take(5),
    ];
    final hiddenCount = account.holdings.length - holdings.length;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: context.looTokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    account.accountId,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                if (account.isReady)
                  Checkbox(
                    value: selected,
                    onChanged: onSelectionChanged == null
                        ? null
                        : (value) => onSelectionChanged!(value ?? false),
                  )
                else
                  const _ImportPill("持仓待确认"),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [
                account.accountType,
                account.currency,
                if (account.netLiquidation != null)
                  "净值 ${_formatNumber(account.netLiquidation!)}",
                if (account.cash != null) "现金 ${_formatNumber(account.cash!)}",
                if (!account.isReady) "${account.reviewHoldingCount} 个持仓待确认",
              ].join(" · "),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
            if (holdings.isNotEmpty) ...[
              const SizedBox(height: 10),
              ...holdings.map(
                (holding) => _IbkrPreviewHoldingRow(
                  account: account,
                  holding: holding,
                  reviewing: reviewingHoldingKeys.contains(
                    _draftHoldingKey(account, holding),
                  ),
                  onReviewHolding: onReviewHolding,
                ),
              ),
              if (hiddenCount > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    "已优先显示待确认持仓；还有 $hiddenCount 个可导入持仓未展开",
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: context.looTokens.mutedText,
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

class _IbkrPreviewHoldingRow extends StatelessWidget {
  const _IbkrPreviewHoldingRow({
    required this.account,
    required this.holding,
    required this.reviewing,
    required this.onReviewHolding,
  });

  final MobileIbkrFlexAccount account;
  final MobileIbkrFlexHolding holding;
  final bool reviewing;
  final Future<void> Function({
    required MobileIbkrFlexAccount account,
    required MobileIbkrFlexHolding holding,
    required String action,
    String? exchange,
  }) onReviewHolding;

  @override
  Widget build(BuildContext context) {
    final statusLabel = switch (holding.identityStatus) {
      "ready" => "可导入",
      "skipped" => "已跳过",
      _ => "待确认",
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: context.looTokens.cardBorder),
        ),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      holding.symbol,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ),
                  Text(
                    [
                      _formatNumber(holding.quantity),
                      holding.currency,
                      statusLabel,
                    ].join(" · "),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: context.looTokens.mutedText,
                        ),
                  ),
                ],
              ),
              if (holding.identityStatus != "ready" &&
                  holding.identityStatus != "skipped") ...[
                const SizedBox(height: 6),
                if (holding.warnings.isNotEmpty)
                  Text(
                    holding.warnings.take(2).join("；"),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: context.looTokens.mutedText,
                        ),
                  ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton(
                      onPressed: reviewing
                          ? null
                          : () => _showHoldingExchangeReviewSheet(
                                context: context,
                                account: account,
                                holding: holding,
                                onReviewHolding: onReviewHolding,
                              ),
                      child: Text(reviewing ? "处理中..." : "补交易所确认"),
                    ),
                    TextButton(
                      onPressed: reviewing
                          ? null
                          : () => onReviewHolding(
                                account: account,
                                holding: holding,
                                action: "skip",
                              ),
                      child: const Text("本次跳过"),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

String _draftHoldingKey(
  MobileIbkrFlexAccount account,
  MobileIbkrFlexHolding holding,
) {
  return "${account.accountId}|${holding.symbol}|${holding.currency}";
}

Future<void> _showHoldingExchangeReviewSheet({
  required BuildContext context,
  required MobileIbkrFlexAccount account,
  required MobileIbkrFlexHolding holding,
  required Future<void> Function({
    required MobileIbkrFlexAccount account,
    required MobileIbkrFlexHolding holding,
    required String action,
    String? exchange,
  }) onReviewHolding,
}) async {
  final controller = TextEditingController(
    text: _defaultExchangeForHolding(holding),
  );
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) {
      final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
      return SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(20, 16, 20, bottomInset + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "确认 ${holding.symbol}",
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                "需要确认真实上市交易所，避免把同名美股、加股、CDR 或 ETF 写错到账本。",
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: context.looTokens.mutedText,
                    ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  labelText: "交易所",
                  helperText: "常用：NASDAQ / NYSE / NYSEARCA / TSX / TSXV",
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: ["NASDAQ", "NYSE", "NYSEARCA", "TSX", "TSXV"]
                    .map(
                      (exchange) => ActionChip(
                        label: Text(exchange),
                        onPressed: () => controller.text = exchange,
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async {
                    final exchange = controller.text.trim().toUpperCase();
                    if (exchange.isEmpty) {
                      return;
                    }
                    Navigator.of(context).pop();
                    await onReviewHolding(
                      account: account,
                      holding: holding,
                      action: "mark_ready",
                      exchange: exchange,
                    );
                  },
                  child: const Text("确认该持仓可导入"),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
  controller.dispose();
}

String _defaultExchangeForHolding(MobileIbkrFlexHolding holding) {
  final exchange = holding.exchange?.trim().toUpperCase();
  if (exchange != null && exchange.isNotEmpty && exchange != "SMART") {
    return exchange;
  }
  if (holding.symbol.contains(".")) {
    return "TSX";
  }
  return holding.currency == "CAD" ? "TSX" : "NASDAQ";
}

String _formatNumber(num value) {
  final number = value.toDouble();
  return number % 1 == 0
      ? number.toStringAsFixed(0)
      : number.toStringAsFixed(2);
}

String _formatIsoDate(String value) {
  final parsed = DateTime.tryParse(value);
  if (parsed == null) {
    return value;
  }
  final local = parsed.toLocal();
  return "${local.year}-${local.month.toString().padLeft(2, "0")}-${local.day.toString().padLeft(2, "0")}";
}

class _BrokerageFlowCard extends StatelessWidget {
  const _BrokerageFlowCard();

  @override
  Widget build(BuildContext context) {
    return const LooGlassCard(
      padding: EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("计划流程"),
          SizedBox(height: 8),
          Text(
            "1. 连接券商或填写同步凭证\n"
            "2. 拉取账户、持仓、现金和交易\n"
            "3. 进入导入预览，检查 symbol + exchange + currency\n"
            "4. 用户确认后才写入账本\n\n"
            "当前阶段先展示入口和方案；真实连接会在下一步接入。",
          ),
        ],
      ),
    );
  }
}

class _CreateAccountSheet extends StatefulWidget {
  const _CreateAccountSheet({required this.apiClient});

  final LooApiClient apiClient;

  @override
  State<_CreateAccountSheet> createState() => _CreateAccountSheetState();
}

class _CreateAccountSheetState extends State<_CreateAccountSheet> {
  final _formKey = GlobalKey<FormState>();
  final _institutionController = TextEditingController();
  final _nicknameController = TextEditingController();
  final _roomController = TextEditingController(text: "0");
  final _marketValueController = TextEditingController(text: "0");

  var _accountType = "TFSA";
  var _currency = "CAD";
  var _submitting = false;
  String? _error;

  @override
  void dispose() {
    _institutionController.dispose();
    _nicknameController.dispose();
    _roomController.dispose();
    _marketValueController.dispose();
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
      final response = await widget.apiClient.createManualAccount(
        accountType: _accountType,
        institution: _institutionController.text.trim(),
        nickname: _nicknameController.text.trim(),
        currency: _currency,
        contributionRoomCad: double.tryParse(_roomController.text.trim()) ?? 0,
        initialMarketValueAmount:
            double.tryParse(_marketValueController.text.trim()) ?? 0,
      );
      if (mounted) {
        final data = response["data"];
        final account = data is Map<String, dynamic> ? data["account"] : null;
        final accountId = account is Map<String, dynamic>
            ? account["id"] as String? ?? ""
            : "";
        Navigator.of(context).pop(_ImportResult(
          title: "账户已加入 Loo国账本",
          message: [
            "${_nicknameController.text.trim()} 已创建。",
            if (accountId.isNotEmpty) "账户 ID：$accountId",
            "下一步可以继续添加持仓，或回到组合页检查账户总览。",
          ].join("\n"),
        ));
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
              Text("添加账户", style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              const Text("先建立账户桶；持仓可以下一步再补。"),
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
                controller: _institutionController,
                enabled: !_submitting,
                decoration: const InputDecoration(labelText: "机构"),
                validator: (value) => (value == null || value.trim().length < 2)
                    ? "机构至少 2 个字符"
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nicknameController,
                enabled: !_submitting,
                decoration: const InputDecoration(labelText: "账户昵称"),
                validator: (value) => (value == null || value.trim().length < 2)
                    ? "昵称至少 2 个字符"
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
              const SizedBox(height: 12),
              TextFormField(
                controller: _marketValueController,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "初始市值"),
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

class _CreateHoldingSheet extends StatefulWidget {
  const _CreateHoldingSheet({
    required this.apiClient,
    required this.accounts,
  });

  final LooApiClient apiClient;
  final List<MobileImportAccount> accounts;

  @override
  State<_CreateHoldingSheet> createState() => _CreateHoldingSheetState();
}

class _CreateHoldingSheetState extends State<_CreateHoldingSheet> {
  final _formKey = GlobalKey<FormState>();
  final _symbolController = TextEditingController();
  final _nameController = TextEditingController();
  final _sectorController = TextEditingController();
  final _quantityController = TextEditingController(text: "0");
  final _avgCostController = TextEditingController(text: "0");
  final _lastPriceController = TextEditingController(text: "0");
  final _marketValueController = TextEditingController(text: "0");

  late String _accountId = widget.accounts.first.id;
  var _currency = "CAD";
  var _assetClass = "Canadian Equity";
  var _securityType = "Common Stock";
  var _exchange = "TSX";
  var _submitting = false;
  var _resolving = false;
  String? _error;

  @override
  void dispose() {
    _symbolController.dispose();
    _nameController.dispose();
    _sectorController.dispose();
    _quantityController.dispose();
    _avgCostController.dispose();
    _lastPriceController.dispose();
    _marketValueController.dispose();
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
      final response = await widget.apiClient.createManualHolding(
        accountId: _accountId,
        symbol: _symbolController.text.trim().toUpperCase(),
        name: _nameController.text.trim(),
        currency: _currency,
        assetClass: _assetClass,
        sector: _sectorController.text.trim(),
        securityType: _securityType,
        exchange: _exchange,
        quantity: double.tryParse(_quantityController.text.trim()) ?? 0,
        avgCostPerShareAmount:
            double.tryParse(_avgCostController.text.trim()) ?? 0,
        lastPriceAmount: double.tryParse(_lastPriceController.text.trim()) ?? 0,
        marketValueAmount:
            double.tryParse(_marketValueController.text.trim()) ?? 0,
      );
      if (mounted) {
        final data = response["data"];
        final holdingId = data is Map<String, dynamic>
            ? data["holdingId"] as String? ?? ""
            : "";
        Navigator.of(context).pop(_ImportResult(
          title: "持仓已加入 Loo国账本",
          message: [
            "${_symbolController.text.trim().toUpperCase()} 已保存。",
            "身份：$_exchange · $_currency",
            if (holdingId.isNotEmpty) "持仓 ID：$holdingId",
            "后续刷新行情时会按代码 + 交易所 + 币种匹配报价。",
          ].join("\n"),
        ));
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

  Future<void> _searchSymbol() async {
    final query = _symbolController.text.trim();
    if (query.isEmpty) {
      setState(() => _error = "请先输入代码或名称。");
      return;
    }

    setState(() {
      _resolving = true;
      _error = null;
    });

    try {
      final response = await widget.apiClient.searchSecurities(query);
      final data = response["data"];
      final results = data is Map<String, dynamic> ? data["results"] : null;
      final candidates = results is List
          ? results
              .whereType<Map<String, dynamic>>()
              .map(MobileSecurityCandidate.fromJson)
              .toList()
          : <MobileSecurityCandidate>[];

      if (!mounted) {
        return;
      }

      if (candidates.isEmpty) {
        await _resolveSymbolFallback(query);
        return;
      }

      setState(() => _resolving = false);
      final selected = await showModalBottomSheet<MobileSecurityCandidate>(
        context: context,
        builder: (context) => _SecurityCandidateSheet(candidates: candidates),
      );
      if (selected != null && mounted) {
        _applyCandidate(selected);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _resolving = false;
        });
      }
    }
  }

  Future<void> _resolveSymbolFallback(String symbol) async {
    try {
      final response = await widget.apiClient.resolveSecurity(symbol);
      final data = response["data"];
      final result = data is Map<String, dynamic> ? data["result"] : null;
      final resultData =
          result is Map<String, dynamic> ? result : const <String, dynamic>{};
      if (mounted) {
        setState(() {
          _symbolController.text =
              resultData["symbol"] as String? ?? symbol.toUpperCase();
          _nameController.text =
              resultData["name"] as String? ?? _nameController.text;
          _securityType =
              _normalizeSecurityType(resultData["securityType"] as String?);
          _exchange = _normalizeExchange(resultData["exchange"] as String?);
          _resolving = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _resolving = false;
        });
      }
    }
  }

  void _applyCandidate(MobileSecurityCandidate candidate) {
    setState(() {
      _symbolController.text = candidate.symbol;
      _nameController.text = candidate.name;
      if (candidate.currency != null && candidate.currency!.isNotEmpty) {
        _currency = candidate.currency!;
      }
      _securityType = _normalizeSecurityType(candidate.type);
      _exchange = _normalizeExchange(candidate.exchange);
      _error = null;
    });
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
              Text("添加持仓", style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              const Text("录入标的、币种、市场和成本；CSV 不进入移动端流程。"),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _accountId,
                decoration: const InputDecoration(labelText: "账户"),
                items: widget.accounts
                    .map(
                      (account) => DropdownMenuItem(
                        value: account.id,
                        child: Text(account.displayName),
                      ),
                    )
                    .toList(),
                onChanged: _submitting
                    ? null
                    : (value) =>
                        setState(() => _accountId = value ?? _accountId),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _symbolController,
                enabled: !_submitting,
                decoration: const InputDecoration(labelText: "代码"),
                textCapitalization: TextCapitalization.characters,
                validator: (value) =>
                    (value == null || value.trim().isEmpty) ? "请输入代码" : null,
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: _submitting || _resolving ? null : _searchSymbol,
                  icon: const Icon(Icons.manage_search),
                  label: Text(_resolving ? "搜索中..." : "搜索/解析标的"),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nameController,
                enabled: !_submitting,
                decoration: const InputDecoration(labelText: "名称"),
                validator: (value) =>
                    (value == null || value.trim().isEmpty) ? "请输入名称" : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _currency,
                decoration: const InputDecoration(labelText: "交易币种"),
                items: const [
                  DropdownMenuItem(value: "CAD", child: Text("CAD")),
                  DropdownMenuItem(value: "USD", child: Text("USD")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _currency = value ?? _currency),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _assetClass,
                decoration: const InputDecoration(labelText: "资产类别"),
                items: const [
                  DropdownMenuItem(
                      value: "Canadian Equity", child: Text("Canadian Equity")),
                  DropdownMenuItem(
                      value: "US Equity", child: Text("US Equity")),
                  DropdownMenuItem(
                      value: "International Equity",
                      child: Text("International Equity")),
                  DropdownMenuItem(
                      value: "Fixed Income", child: Text("Fixed Income")),
                  DropdownMenuItem(value: "Cash", child: Text("Cash")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) =>
                        setState(() => _assetClass = value ?? _assetClass),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _sectorController,
                enabled: !_submitting,
                decoration: const InputDecoration(labelText: "行业"),
                validator: (value) =>
                    (value == null || value.trim().isEmpty) ? "请输入行业" : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _securityType,
                decoration: const InputDecoration(labelText: "证券类型"),
                items: const [
                  DropdownMenuItem(
                      value: "Common Stock", child: Text("Common Stock")),
                  DropdownMenuItem(value: "ETF", child: Text("ETF")),
                  DropdownMenuItem(
                      value: "Commodity ETF", child: Text("Commodity ETF")),
                  DropdownMenuItem(
                      value: "Mutual Fund", child: Text("Mutual Fund")),
                  DropdownMenuItem(value: "REIT", child: Text("REIT")),
                  DropdownMenuItem(value: "Unknown", child: Text("Unknown")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) =>
                        setState(() => _securityType = value ?? _securityType),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _exchange,
                decoration: const InputDecoration(labelText: "交易所"),
                items: const [
                  DropdownMenuItem(value: "TSX", child: Text("TSX")),
                  DropdownMenuItem(value: "TSXV", child: Text("TSXV")),
                  DropdownMenuItem(
                      value: "Cboe Canada", child: Text("Cboe Canada")),
                  DropdownMenuItem(value: "NYSE", child: Text("NYSE")),
                  DropdownMenuItem(value: "NASDAQ", child: Text("NASDAQ")),
                  DropdownMenuItem(
                      value: "NYSE Arca", child: Text("NYSE Arca")),
                  DropdownMenuItem(value: "OTC", child: Text("OTC")),
                  DropdownMenuItem(value: "LSE", child: Text("LSE")),
                  DropdownMenuItem(value: "TSE", child: Text("TSE")),
                  DropdownMenuItem(
                      value: "Other / Manual", child: Text("Other / Manual")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _exchange = value ?? _exchange),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _quantityController,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "数量"),
                validator: _validateMoney,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _avgCostController,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "平均成本"),
                validator: _validateMoney,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _lastPriceController,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "最新价格"),
                validator: _validateMoney,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _marketValueController,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "当前市值"),
                validator: _validatePositiveMoney,
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
                  child: Text(_submitting ? "保存中..." : "保存持仓"),
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

  String? _validatePositiveMoney(String? value) {
    final parsed = double.tryParse((value ?? "").trim());
    if (parsed == null || parsed <= 0) {
      return "请输入大于 0 的数字";
    }
    return null;
  }

  String _normalizeSecurityType(String? value) {
    const allowed = {
      "Common Stock",
      "ETF",
      "Commodity ETF",
      "Mutual Fund",
      "REIT",
      "Unknown",
    };
    return allowed.contains(value) ? value! : "Common Stock";
  }

  String _normalizeExchange(String? value) {
    final normalized = (value ?? "").trim();
    final upper = normalized.toUpperCase();
    if (upper == "TSX" || upper.contains("TORONTO STOCK EXCHANGE")) {
      return "TSX";
    }
    if (upper == "TSXV" || upper.contains("TSX VENTURE")) {
      return "TSXV";
    }
    if (upper.contains("CBOE CANADA") ||
        upper == "NEO" ||
        upper.contains("NEO EXCHANGE")) {
      return "Cboe Canada";
    }
    if (upper == "NYSE" || upper.contains("NEW YORK STOCK EXCHANGE")) {
      return "NYSE";
    }
    if (upper == "NASDAQ" || upper.contains("NASDAQ")) {
      return "NASDAQ";
    }
    if (upper == "NYSE ARCA" || upper.contains("ARCA")) {
      return "NYSE Arca";
    }
    if (upper == "OTC" || upper.contains("OTC")) {
      return "OTC";
    }
    if (upper == "LSE" || upper.contains("LONDON STOCK EXCHANGE")) {
      return "LSE";
    }
    if (upper == "TSE" || upper.contains("TOKYO STOCK EXCHANGE")) {
      return "TSE";
    }

    const allowed = {
      "TSX",
      "TSXV",
      "Cboe Canada",
      "NYSE",
      "NASDAQ",
      "NYSE Arca",
      "OTC",
      "LSE",
      "TSE",
      "Other / Manual",
    };
    return allowed.contains(normalized) ? normalized : "Other / Manual";
  }
}

class _SecurityCandidateSheet extends StatelessWidget {
  const _SecurityCandidateSheet({required this.candidates});

  final List<MobileSecurityCandidate> candidates;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Text("选择标的", style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          const Text("请确认交易所和币种，避免美股正股与 CAD 对冲/加股版本混淆。"),
          const SizedBox(height: 12),
          ...candidates.map(
            (candidate) => Card(
              child: ListTile(
                onTap: () => Navigator.of(context).pop(candidate),
                title: Text("${candidate.symbol} · ${candidate.name}"),
                subtitle: Text([
                  candidate.exchange ?? "",
                  candidate.currency ?? "",
                  candidate.country ?? "",
                  candidate.type,
                ].where((item) => item.isNotEmpty).join(" · ")),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AccountCard extends StatelessWidget {
  const _AccountCard(this.account);

  final MobileImportAccount account;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: context.looTokens.cardBorder),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      account.displayName,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        account.detail,
                        "${account.holdingCount} 个持仓",
                      ].where((item) => item.isNotEmpty).join(" · "),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: context.looTokens.mutedText,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                account.value,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ],
          ),
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
          Text("手动导入暂时打不开", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text("重新读取")),
        ],
      ),
    );
  }
}
