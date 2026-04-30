import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
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
    return FutureBuilder<MobileImportSnapshot>(
      future: _snapshot,
      builder: (context, snapshot) {
        return RefreshIndicator(
          onRefresh: () async => _refresh(),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              const SliverToBoxAdapter(
                child: _PageHeader(
                  title: "手动导入",
                  subtitle: "移动端只保留手动/引导式导入，CSV 暂不迁移。",
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
                      _HeroCard(snapshot.data!),
                      const SizedBox(height: 16),
                      const _SectionTitle("导入入口"),
                      const SizedBox(height: 8),
                      ...snapshot.data!.actionCards.map(
                        (action) => _ActionCard(
                          action,
                          onTap: switch (action.title) {
                            "添加账户" => _openCreateAccountSheet,
                            "添加持仓" => () => _openCreateHoldingSheet(
                                snapshot.data!.accounts),
                            _ => null,
                          },
                        ),
                      ),
                      const SizedBox(height: 16),
                      _SectionTitle("现有账户",
                          actionLabel: "${snapshot.data!.accounts.length} 个"),
                      const SizedBox(height: 8),
                      if (snapshot.data!.accounts.isEmpty)
                        const _EmptyCard("还没有账户。先从“添加账户”开始建立 Loo国资产账本。")
                      else
                        ...snapshot.data!.accounts.map(_AccountCard.new),
                      if (snapshot.data!.notes.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        const _SectionTitle("导入规则"),
                        const SizedBox(height: 8),
                        _TextCard(snapshot.data!.notes.take(4).join("\n")),
                      ],
                    ],
                  ),
                ),
            ],
          ),
        );
      },
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

class _HeroCard extends StatelessWidget {
  const _HeroCard(this.data);

  final MobileImportSnapshot data;

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
              Text("Loo国资产入口", style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              const Text("先用手机完成账户和持仓的手动维护；CSV 批量导入留给桌面高级流程。"),
              const SizedBox(height: 14),
              ...data.manualSteps.take(4).map(
                    (step) => Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.check_circle_outline, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(step.title,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium),
                                Text(step.description),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title, {this.actionLabel});

  final String title;
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        if (actionLabel != null)
          Text(actionLabel!, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard(this.action, {this.onTap});

  final MobileImportAction action;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
            child: Text(
                action.label.isEmpty ? "入" : action.label.substring(0, 1))),
        title: Text(action.title),
        subtitle: Text(action.description),
        trailing: onTap == null
            ? const Icon(Icons.lock_outline)
            : const Icon(Icons.chevron_right),
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
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        title: Text(account.displayName),
        subtitle: Text(account.detail),
        trailing:
            Text(account.value, style: Theme.of(context).textTheme.titleLarge),
      ),
    );
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

class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(message),
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
