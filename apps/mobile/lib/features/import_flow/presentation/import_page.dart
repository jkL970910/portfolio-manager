import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
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
              const Text("统一入口会先导入到预览区，确认账户、持仓、现金和交易后再写入 Loo国账本。"),
              const SizedBox(height: 14),
              ...providers.map(
                (provider) => _BrokerageProviderCard(
                  provider,
                  onTap: provider.id == "ibkr-flex"
                      ? () => _openIbkrFlexPreview(context)
                      : null,
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
            const SizedBox(height: 8),
            Text(provider.description),
            if (provider.primaryUse.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text("用途：${provider.primaryUse}",
                  style: Theme.of(context).textTheme.bodyMedium),
            ],
            if (provider.setupItems.isNotEmpty) ...[
              const SizedBox(height: 10),
              ...provider.setupItems.take(3).map(
                    (item) => _BrokerageBullet(text: item),
                  ),
            ],
            if (provider.limitations.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text("注意：${provider.limitations.first}",
                  style: Theme.of(context).textTheme.bodySmall),
            ],
            if (onTap != null) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Text(
                    "打开预览",
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
  String? _error;
  MobileIbkrFlexPreview? _preview;

  @override
  void dispose() {
    _tokenController.dispose();
    _queryIdController.dispose();
    super.dispose();
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
                  "填入 IBKR Flex Token 和 Query ID，只拉取预览；当前不会保存 token，也不会写入账本。",
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: context.looTokens.mutedText,
                      ),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _tokenController,
                  decoration: const InputDecoration(
                    labelText: "Flex Token",
                    helperText:
                        "来自 IBKR Client Portal 的 Flex Web Service token",
                  ),
                  obscureText: true,
                  validator: (value) => value == null || value.trim().length < 8
                      ? "请输入有效的 Flex Token"
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _queryIdController,
                  decoration: const InputDecoration(
                    labelText: "Query ID",
                    helperText: "Activity Flex Query 的 Query ID",
                  ),
                  keyboardType: TextInputType.number,
                  validator: (value) => value == null || value.trim().isEmpty
                      ? "请输入 Query ID"
                      : null,
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
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _loading ? null : _previewFlex,
                    icon: _loading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.search_rounded),
                    label: Text(_loading ? "读取 IBKR..." : "读取预览"),
                  ),
                ),
                if (_preview != null) ...[
                  const SizedBox(height: 16),
                  _IbkrPreviewResultCard(_preview!),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _IbkrPreviewResultCard extends StatelessWidget {
  const _IbkrPreviewResultCard(this.preview);

  final MobileIbkrFlexPreview preview;

  @override
  Widget build(BuildContext context) {
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
            ...preview.accounts.map(_IbkrPreviewAccountCard.new),
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
        ],
      ),
    );
  }
}

class _IbkrPreviewAccountCard extends StatelessWidget {
  const _IbkrPreviewAccountCard(this.account);

  final MobileIbkrFlexAccount account;

  @override
  Widget build(BuildContext context) {
    final holdings = account.holdings.take(5).toList();
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
                _ImportPill("${account.holdings.length} 持仓"),
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
              ].join(" · "),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
            if (holdings.isNotEmpty) ...[
              const SizedBox(height: 10),
              ...holdings.map(_IbkrPreviewHoldingRow.new),
              if (account.holdings.length > holdings.length)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    "还有 ${account.holdings.length - holdings.length} 个持仓未展开",
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
  const _IbkrPreviewHoldingRow(this.holding);

  final MobileIbkrFlexHolding holding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        children: [
          Expanded(
            child: Text(
              holding.symbol,
              style: Theme.of(context).textTheme.labelLarge,
            ),
          ),
          Text(
            "${_formatNumber(holding.quantity)} · ${holding.currency}",
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
        ],
      ),
    );
  }
}

String _formatNumber(num value) {
  final number = value.toDouble();
  return number % 1 == 0
      ? number.toStringAsFixed(0)
      : number.toStringAsFixed(2);
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

class _BrokerageBullet extends StatelessWidget {
  const _BrokerageBullet({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.check_circle_outline, size: 17),
          const SizedBox(width: 8),
          Expanded(child: Text(text)),
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
