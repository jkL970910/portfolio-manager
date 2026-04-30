import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../data/mobile_preference_models.dart";

const _assetClasses = [
  "Canadian Equity",
  "US Equity",
  "International Equity",
  "Fixed Income",
  "Cash",
];

const _accountTypes = ["TFSA", "RRSP", "FHSA", "Taxable"];
const _securityTypes = ["ETF", "Common Stock", "Commodity ETF"];

class InvestmentPreferencesCard extends StatefulWidget {
  const InvestmentPreferencesCard({required this.apiClient, super.key});

  final LooApiClient apiClient;

  @override
  State<InvestmentPreferencesCard> createState() =>
      _InvestmentPreferencesCardState();
}

class _InvestmentPreferencesCardState extends State<InvestmentPreferencesCard> {
  late Future<MobilePreferenceProfile> _profile;

  @override
  void initState() {
    super.initState();
    _profile = _loadProfile();
  }

  Future<MobilePreferenceProfile> _loadProfile() async {
    final response = await widget.apiClient.getInvestmentPreferences();
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("投资偏好格式不正确。");
    }
    final profile = data["profile"];
    if (profile is! Map<String, dynamic>) {
      throw const LooApiException("投资偏好档案不存在。");
    }
    return MobilePreferenceProfile.fromJson(profile);
  }

  void _refresh() {
    setState(() {
      _profile = _loadProfile();
    });
  }

  Future<void> _openEditor(MobilePreferenceProfile profile) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _PreferenceEditorSheet(
        apiClient: widget.apiClient,
        profile: profile,
      ),
    );
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("投资偏好已保存，推荐逻辑会使用新规则。")),
      );
      _refresh();
    }
  }

  Future<void> _openGuidedSetup(MobilePreferenceProfile profile) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _GuidedPreferenceSheet(
        apiClient: widget.apiClient,
        profile: profile,
      ),
    );
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("引导式投资偏好已应用。")),
      );
      _refresh();
    }
  }

  Future<void> _openConstraintEditor(MobilePreferenceProfile profile) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _ConstraintEditorSheet(
        apiClient: widget.apiClient,
        profile: profile,
      ),
    );
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("推荐约束已保存，下一次推荐会读取新规则。")),
      );
      _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MobilePreferenceProfile>(
      future: _profile,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Card(
            child: Padding(
              padding: EdgeInsets.all(18),
              child: LinearProgressIndicator(),
            ),
          );
        }

        if (snapshot.hasError) {
          return Card(
            child: ListTile(
              leading: const Icon(Icons.error_outline),
              title: const Text("投资偏好暂时打不开"),
              subtitle: Text(snapshot.error.toString()),
              trailing: IconButton(
                onPressed: _refresh,
                icon: const Icon(Icons.refresh),
              ),
            ),
          );
        }

        final profile = snapshot.data!;
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.tune),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text("投资偏好",
                          style: Theme.of(context).textTheme.titleLarge),
                    ),
                    TextButton(
                      onPressed: () => _openGuidedSetup(profile),
                      child: const Text("引导"),
                    ),
                    TextButton(
                      onPressed: () => _openConstraintEditor(profile),
                      child: const Text("约束"),
                    ),
                    TextButton(
                      onPressed: () => _openEditor(profile),
                      child: const Text("编辑"),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(profile.summary),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _InfoChip("风险", profile.riskProfileLabel),
                    _InfoChip("再平衡", "${profile.rebalancingTolerancePct}%"),
                    _InfoChip("现金",
                        "\$${profile.cashBufferTargetCad.toStringAsFixed(0)}"),
                    _InfoChip("税务", profile.taxAwarePlacement ? "开启" : "关闭"),
                  ],
                ),
                const SizedBox(height: 12),
                Text("目标配置", style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 6),
                ...profile.targetAllocation.map(
                  (target) => _AllocationRow(target),
                ),
                const SizedBox(height: 10),
                Text("账户优先级：${profile.accountFundingPriority.join(" -> ")}"),
                if (profile.watchlistSymbols.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text("优先观察：${profile.watchlistSymbols.join("、")}"),
                ],
                if (profile
                    .recommendationConstraints.preferredSymbols.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                      "推荐偏好：${profile.recommendationConstraints.preferredSymbols.join("、")}"),
                ],
                if (profile
                    .recommendationConstraints.excludedSymbols.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                      "排除标的：${profile.recommendationConstraints.excludedSymbols.join("、")}"),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ConstraintEditorSheet extends StatefulWidget {
  const _ConstraintEditorSheet({
    required this.apiClient,
    required this.profile,
  });

  final LooApiClient apiClient;
  final MobilePreferenceProfile profile;

  @override
  State<_ConstraintEditorSheet> createState() => _ConstraintEditorSheetState();
}

class _ConstraintEditorSheetState extends State<_ConstraintEditorSheet> {
  late var _recommendationStrategy = widget.profile.recommendationStrategy;
  late var _taxAwarePlacement = widget.profile.taxAwarePlacement;
  late final _priority =
      _normalizePriority(widget.profile.accountFundingPriority);
  late final _watchlistController =
      TextEditingController(text: widget.profile.watchlistSymbols.join(", "));
  late final List<Map<String, dynamic>> _excludedSecurities =
      _initialSecurityIdentities(
    widget.profile.recommendationConstraints.excludedSecurities,
    widget.profile.recommendationConstraints.excludedSymbols,
  );
  late final List<Map<String, dynamic>> _preferredSecurities =
      _initialSecurityIdentities(
    widget.profile.recommendationConstraints.preferredSecurities,
    widget.profile.recommendationConstraints.preferredSymbols,
  );
  late final _avoidAccountsController = TextEditingController(
      text: widget.profile.recommendationConstraints.avoidAccountTypes
          .join(", "));
  late final _preferredAccountsController = TextEditingController(
      text: widget.profile.recommendationConstraints.preferredAccountTypes
          .join(", "));
  late final _assetBandsController = TextEditingController(
      text: _formatAssetClassBands(
          widget.profile.recommendationConstraints.assetClassBands));
  late final _allowedSecurityTypesController = TextEditingController(
      text: widget.profile.recommendationConstraints.allowedSecurityTypes
          .join(", "));
  var _saving = false;
  String? _error;

  @override
  void dispose() {
    _watchlistController.dispose();
    _avoidAccountsController.dispose();
    _preferredAccountsController.dispose();
    _assetBandsController.dispose();
    _allowedSecurityTypesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final watchlist = _parseSymbols(_watchlistController.text, max: 20);
    final excludedSecurities = _dedupeSecurityIdentities(_excludedSecurities);
    final excludedSymbols =
        excludedSecurities.map((item) => item["symbol"] as String).toList();
    final excludedKeys = excludedSecurities.map(_securityIdentityKey).toSet();
    final preferredSecurities = _dedupeSecurityIdentities(_preferredSecurities)
        .where((item) => !excludedKeys.contains(_securityIdentityKey(item)))
        .where((item) => !excludedSymbols.contains(item["symbol"]))
        .toList();
    final preferredSymbols =
        preferredSecurities.map((item) => item["symbol"] as String).toList();
    final avoidAccountTypes = _parseAccountTypes(_avoidAccountsController.text);
    final preferredAccountTypes =
        _parseAccountTypes(_preferredAccountsController.text)
            .where((type) => !avoidAccountTypes.contains(type))
            .toList();
    final assetBandError = _validateAssetClassBands(_assetBandsController.text);
    if (assetBandError != null) {
      setState(() => _error = assetBandError);
      return;
    }
    final assetClassBands = _parseAssetClassBands(_assetBandsController.text);
    final allowedSecurityTypes =
        _parseSecurityTypes(_allowedSecurityTypesController.text);
    if (_priority.toSet().length != _priority.length) {
      setState(() => _error = "账户优先级不能重复。");
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await widget.apiClient.updateInvestmentPreferences({
        "riskProfile": widget.profile.riskProfile,
        "targetAllocation": widget.profile.targetAllocation
            .map((target) => {
                  "assetClass": target.assetClass,
                  "targetPct": target.targetPct,
                })
            .toList(),
        "accountFundingPriority": _priority,
        "taxAwarePlacement": _taxAwarePlacement,
        "cashBufferTargetCad": widget.profile.cashBufferTargetCad,
        "transitionPreference": widget.profile.transitionPreference,
        "recommendationStrategy": _recommendationStrategy,
        "source": "manual",
        "rebalancingTolerancePct": widget.profile.rebalancingTolerancePct,
        "watchlistSymbols": watchlist,
        "recommendationConstraints": {
          "excludedSymbols": excludedSymbols,
          "preferredSymbols": preferredSymbols,
          "excludedSecurities": excludedSecurities,
          "preferredSecurities": preferredSecurities,
          "assetClassBands": assetClassBands,
          "avoidAccountTypes": avoidAccountTypes,
          "preferredAccountTypes": preferredAccountTypes,
          "allowedSecurityTypes": allowedSecurityTypes,
        },
      });
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _saving = false;
        });
      }
    }
  }

  Future<void> _addSecurityIdentity(
    List<Map<String, dynamic>> target,
  ) async {
    final selected = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (context) =>
          _ConstraintSecurityPickerSheet(apiClient: widget.apiClient),
    );
    if (selected == null) {
      return;
    }

    final key = _securityIdentityKey(selected);
    if (target.map(_securityIdentityKey).contains(key)) {
      return;
    }
    setState(() => target.add(selected));
  }

  void _removeSecurityIdentity(
    List<Map<String, dynamic>> target,
    Map<String, dynamic> item,
  ) {
    setState(() {
      target.removeWhere(
          (entry) => _securityIdentityKey(entry) == _securityIdentityKey(item));
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, bottomInset + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("推荐约束", style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            const Text("这些规则会影响候选评分、账户放置和观察标的加分。"),
            const SizedBox(height: 16),
            TextField(
              controller: _watchlistController,
              enabled: !_saving,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: "优先观察标的",
                helperText: "用逗号或空格分隔，例如 VFV, XEQT, XBB；最多 20 个。",
              ),
            ),
            const SizedBox(height: 12),
            _SecurityIdentityChipEditor(
              title: "偏好标的",
              helperText: "通过搜索添加，保存代码、交易所和币种。",
              items: _preferredSecurities,
              onAdd: _saving
                  ? null
                  : () => _addSecurityIdentity(_preferredSecurities),
              onDeleted: _saving
                  ? null
                  : (item) =>
                      _removeSecurityIdentity(_preferredSecurities, item),
            ),
            const SizedBox(height: 12),
            _SecurityIdentityChipEditor(
              title: "排除标的",
              helperText: "排除优先级高于偏好；同一 identity 不会重复添加。",
              items: _excludedSecurities,
              onAdd: _saving
                  ? null
                  : () => _addSecurityIdentity(_excludedSecurities),
              onDeleted: _saving
                  ? null
                  : (item) =>
                      _removeSecurityIdentity(_excludedSecurities, item),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _preferredAccountsController,
              enabled: !_saving,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: "偏好账户类型",
                helperText: "例如 TFSA, RRSP；推荐放置会加权。",
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _avoidAccountsController,
              enabled: !_saving,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: "回避账户类型",
                helperText: "例如 Taxable；回避优先级高于偏好。",
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _assetBandsController,
              enabled: !_saving,
              minLines: 2,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: "资产类别上下限",
                helperText: "每行一个，例如 US Equity:10-45；用于约束推荐目标。",
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _allowedSecurityTypesController,
              enabled: !_saving,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: "允许标的类型",
                helperText: "例如 ETF, Common Stock, Commodity ETF；留空表示不限制。",
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _recommendationStrategy,
              decoration: const InputDecoration(labelText: "推荐策略"),
              items: const [
                DropdownMenuItem(value: "tax-aware", child: Text("税务优先")),
                DropdownMenuItem(value: "target-first", child: Text("目标优先")),
                DropdownMenuItem(value: "balanced", child: Text("平衡")),
              ],
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _recommendationStrategy =
                      value ?? _recommendationStrategy),
            ),
            const SizedBox(height: 10),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text("启用税务感知放置"),
              subtitle: const Text("开启后，推荐会更重视账户类型和税务位置匹配。"),
              value: _taxAwarePlacement,
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _taxAwarePlacement = value),
            ),
            const SizedBox(height: 8),
            Text("账户优先级", style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            for (var index = 0; index < _priority.length; index++)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: DropdownButtonFormField<String>(
                  initialValue: _priority[index],
                  decoration: InputDecoration(labelText: "第 ${index + 1} 顺位"),
                  items: _accountTypes
                      .map((type) =>
                          DropdownMenuItem(value: type, child: Text(type)))
                      .toList(),
                  onChanged: _saving
                      ? null
                      : (value) => setState(
                          () => _priority[index] = value ?? _priority[index]),
                ),
              ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                child: Text(_saving ? "保存中..." : "保存约束"),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<String> _normalizePriority(List<String> value) {
    final normalized = value.where(_accountTypes.contains).toList();
    for (final type in _accountTypes) {
      if (!normalized.contains(type)) {
        normalized.add(type);
      }
    }
    return normalized.take(4).toList();
  }

  List<String> _parseSymbols(String value, {int max = 50}) {
    return value
        .split(RegExp(r"[,，\s]+"))
        .map((item) => item.trim().toUpperCase())
        .where((item) => item.isNotEmpty)
        .toSet()
        .take(max)
        .toList();
  }

  List<Map<String, dynamic>> _initialSecurityIdentities(
    List<Map<String, dynamic>> identities,
    List<String> fallbackSymbols,
  ) {
    return _dedupeSecurityIdentities([
      ...identities,
      ...fallbackSymbols
          .map((symbol) => {"symbol": symbol.trim().toUpperCase()}),
    ]);
  }

  List<Map<String, dynamic>> _dedupeSecurityIdentities(
    List<Map<String, dynamic>> identities,
  ) {
    final byKey = <String, Map<String, dynamic>>{};
    for (final item in identities) {
      final symbol = (item["symbol"] as String? ?? "").trim().toUpperCase();
      if (symbol.isEmpty) {
        continue;
      }
      final exchange = (item["exchange"] as String?)?.trim();
      final currency = (item["currency"] as String?)?.trim().toUpperCase();
      final normalized = {
        ...item,
        "symbol": symbol,
        if (exchange != null && exchange.isNotEmpty) "exchange": exchange,
        if (currency == "CAD" || currency == "USD") "currency": currency,
      };
      byKey[_securityIdentityKey(normalized)] = normalized;
    }
    return byKey.values.toList();
  }

  List<String> _parseAccountTypes(String value) {
    return value
        .split(RegExp(r"[,，\s]+"))
        .map((item) => item.trim().toUpperCase())
        .map((item) => item == "TAXABLE" ? "Taxable" : item)
        .where(_accountTypes.contains)
        .toSet()
        .toList();
  }

  List<Map<String, dynamic>> _parseAssetClassBands(String value) {
    return value
        .split(RegExp(r"[;\n]+"))
        .map((line) => line.trim())
        .where((line) => line.contains(":"))
        .map((line) {
          final parts = line.split(":");
          final assetClass = parts.first.trim();
          final range = parts.sublist(1).join(":").split("-");
          final minPct =
              range.isNotEmpty ? int.tryParse(range[0].trim()) : null;
          final maxPct =
              range.length > 1 ? int.tryParse(range[1].trim()) : null;
          return {
            "assetClass": assetClass,
            if (minPct != null) "minPct": minPct,
            if (maxPct != null) "maxPct": maxPct,
          };
        })
        .where((item) => _assetClasses.contains(item["assetClass"]))
        .toList();
  }

  String? _validateAssetClassBands(String value) {
    final lines = value
        .split(RegExp(r"[;\n]+"))
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList();
    for (var index = 0; index < lines.length; index++) {
      final line = lines[index];
      final lineNumber = index + 1;
      if (!line.contains(":")) {
        return "资产上下限第 $lineNumber 行缺少冒号，例如 US Equity:10-45。";
      }

      final parts = line.split(":");
      final assetClass = parts.first.trim();
      if (!_assetClasses.contains(assetClass)) {
        return "资产上下限第 $lineNumber 行的资产类别不支持：$assetClass。";
      }

      final rangeText = parts.sublist(1).join(":").trim();
      final range = rangeText.split("-").map((part) => part.trim()).toList();
      if (range.length > 2) {
        return "资产上下限第 $lineNumber 行格式不正确，只能写成 10-45。";
      }

      final minPct = range.isNotEmpty && range[0].isNotEmpty
          ? int.tryParse(range[0])
          : null;
      final maxPct = range.length > 1 && range[1].isNotEmpty
          ? int.tryParse(range[1])
          : null;
      if (range.isNotEmpty && range[0].isNotEmpty && minPct == null) {
        return "资产上下限第 $lineNumber 行的下限不是有效数字。";
      }
      if (range.length > 1 && range[1].isNotEmpty && maxPct == null) {
        return "资产上下限第 $lineNumber 行的上限不是有效数字。";
      }
      if (minPct == null && maxPct == null) {
        return "资产上下限第 $lineNumber 行至少需要填写一个上限或下限。";
      }
      if ((minPct != null && (minPct < 0 || minPct > 100)) ||
          (maxPct != null && (maxPct < 0 || maxPct > 100))) {
        return "资产上下限第 $lineNumber 行必须在 0 到 100 之间。";
      }
      if (minPct != null && maxPct != null && minPct > maxPct) {
        return "资产上下限第 $lineNumber 行下限不能大于上限。";
      }
    }
    return null;
  }

  List<String> _parseSecurityTypes(String value) {
    final normalized = {
      for (final type in _securityTypes) type.toLowerCase(): type,
    };
    return value
        .split(RegExp(r"[,，\n]+"))
        .map((item) => item.trim().toLowerCase())
        .map((item) => normalized[item])
        .whereType<String>()
        .toSet()
        .toList();
  }

  String _formatAssetClassBands(List<Map<String, dynamic>> bands) {
    return bands
        .map((item) {
          final assetClass = item["assetClass"] as String? ?? "";
          final minPct = item["minPct"];
          final maxPct = item["maxPct"];
          return "$assetClass:${minPct ?? ""}-${maxPct ?? ""}";
        })
        .where((line) => !line.startsWith(":"))
        .join("\n");
  }

  String _securityIdentityKey(Map<String, dynamic> item) {
    return [
      item["symbol"] as String? ?? "",
      item["exchange"] as String? ?? "",
      item["currency"] as String? ?? "",
    ].join("|");
  }
}

class _SecurityIdentityChipEditor extends StatelessWidget {
  const _SecurityIdentityChipEditor({
    required this.title,
    required this.helperText,
    required this.items,
    required this.onAdd,
    required this.onDeleted,
  });

  final String title;
  final String helperText;
  final List<Map<String, dynamic>> items;
  final VoidCallback? onAdd;
  final void Function(Map<String, dynamic> item)? onDeleted;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(
        labelText: title,
        helperText: helperText,
        border: const OutlineInputBorder(),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (items.isEmpty)
            Text("还没有添加标的。", style: Theme.of(context).textTheme.bodyMedium)
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: items
                  .map(
                    (item) => InputChip(
                      label: Text(_formatSecurityIdentityLabel(item)),
                      onDeleted:
                          onDeleted == null ? null : () => onDeleted!(item),
                    ),
                  )
                  .toList(),
            ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.manage_search),
              label: Text("搜索添加$title"),
            ),
          ),
        ],
      ),
    );
  }

  String _formatSecurityIdentityLabel(Map<String, dynamic> item) {
    final symbol = item["symbol"] as String? ?? "--";
    final exchange = item["exchange"] as String?;
    final currency = item["currency"] as String?;
    final name = item["name"] as String?;
    final identity = [
      symbol,
      if (exchange != null && exchange.isNotEmpty) exchange,
      if (currency != null && currency.isNotEmpty) currency,
    ].join(" · ");
    return name != null && name.isNotEmpty ? "$identity · $name" : identity;
  }
}

class _ConstraintSecurityPickerSheet extends StatefulWidget {
  const _ConstraintSecurityPickerSheet({required this.apiClient});

  final LooApiClient apiClient;

  @override
  State<_ConstraintSecurityPickerSheet> createState() =>
      _ConstraintSecurityPickerSheetState();
}

class _ConstraintSecurityPickerSheetState
    extends State<_ConstraintSecurityPickerSheet> {
  final _queryController = TextEditingController();
  var _searching = false;
  String? _error;
  List<_ConstraintSecurityCandidate> _results = const [];

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final query = _queryController.text.trim();
    if (query.isEmpty) {
      setState(() => _error = "请输入代码或名称。");
      return;
    }

    setState(() {
      _searching = true;
      _error = null;
    });

    try {
      final response = await widget.apiClient.searchSecurities(query);
      final data = response["data"];
      final results = data is Map<String, dynamic> ? data["results"] : null;
      final candidates = results is List
          ? results
              .whereType<Map<String, dynamic>>()
              .map(_ConstraintSecurityCandidate.fromJson)
              .toList()
          : <_ConstraintSecurityCandidate>[];
      if (mounted) {
        setState(() {
          _results = candidates;
          _searching = false;
          _error = candidates.isEmpty ? "没有找到匹配标的，可继续使用手动输入。" : null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _searching = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, bottomInset + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("搜索约束标的", style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            const Text("选择结果会保存代码、交易所和币种，减少 CAD 版本和美股正股混淆。"),
            const SizedBox(height: 12),
            TextField(
              controller: _queryController,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(labelText: "代码或名称"),
              onSubmitted: (_) => _search(),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                onPressed: _searching ? null : _search,
                icon: const Icon(Icons.search),
                label: Text(_searching ? "搜索中..." : "搜索"),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 12),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: _results
                    .map(
                      (candidate) => Card(
                        child: ListTile(
                          onTap: () =>
                              Navigator.of(context).pop(candidate.toIdentity()),
                          title:
                              Text("${candidate.symbol} · ${candidate.name}"),
                          subtitle: Text([
                            candidate.exchange ?? "",
                            candidate.currency ?? "",
                            candidate.country ?? "",
                            candidate.type,
                          ].where((item) => item.isNotEmpty).join(" · ")),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConstraintSecurityCandidate {
  const _ConstraintSecurityCandidate({
    required this.symbol,
    required this.name,
    required this.type,
    this.exchange,
    this.currency,
    this.country,
    this.provider,
  });

  final String symbol;
  final String name;
  final String type;
  final String? exchange;
  final String? currency;
  final String? country;
  final String? provider;

  factory _ConstraintSecurityCandidate.fromJson(Map<String, dynamic> json) {
    return _ConstraintSecurityCandidate(
      symbol: json["symbol"] as String? ?? "--",
      name: json["name"] as String? ?? "未知标的",
      type: json["type"] as String? ?? "Unknown",
      exchange: json["exchange"] as String?,
      currency: json["currency"] as String?,
      country: json["country"] as String?,
      provider: json["provider"] as String?,
    );
  }

  Map<String, dynamic> toIdentity() {
    return {
      "symbol": symbol.trim().toUpperCase(),
      if (exchange != null && exchange!.isNotEmpty) "exchange": exchange,
      if (currency == "CAD" || currency == "USD") "currency": currency,
      "name": name,
      if (provider != null && provider!.isNotEmpty) "provider": provider,
    };
  }
}

class _GuidedPreferenceSheet extends StatefulWidget {
  const _GuidedPreferenceSheet({
    required this.apiClient,
    required this.profile,
  });

  final LooApiClient apiClient;
  final MobilePreferenceProfile profile;

  @override
  State<_GuidedPreferenceSheet> createState() => _GuidedPreferenceSheetState();
}

class _GuidedPreferenceSheetState extends State<_GuidedPreferenceSheet> {
  var _goal = "retirement";
  var _horizon = "medium";
  var _volatility = "medium";
  var _priority = "balanced";
  var _cashNeed = "medium";
  var _saving = false;
  String? _error;

  MobileGuidedDraft get _draft => MobileGuidedDraft.fromAnswers(
        goal: _goal,
        horizon: _horizon,
        volatility: _volatility,
        priority: _priority,
        cashNeed: _cashNeed,
      );

  Future<void> _apply() async {
    final draft = _draft;
    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await widget.apiClient.saveGuidedPreferenceDraft(draft.toDraftPayload());
      await widget.apiClient.updateInvestmentPreferences({
        ...draft.suggestedProfilePayload,
        "source": "guided",
        "watchlistSymbols": widget.profile.watchlistSymbols,
      });
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final draft = _draft;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, bottomInset + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("引导式偏好设置", style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            const Text("回答 5 个问题，Loo皇会生成一套可直接应用的投资规则。"),
            const SizedBox(height: 16),
            _GuidedSelect(
              label: "目标",
              value: _goal,
              items: const {
                "retirement": "退休长期积累",
                "home": "买房/首套房",
                "wealth": "财富增长",
                "capital-preservation": "本金保护",
              },
              onChanged:
                  _saving ? null : (value) => setState(() => _goal = value),
            ),
            _GuidedSelect(
              label: "投资期限",
              value: _horizon,
              items: const {"short": "短期", "medium": "中期", "long": "长期"},
              onChanged:
                  _saving ? null : (value) => setState(() => _horizon = value),
            ),
            _GuidedSelect(
              label: "波动承受",
              value: _volatility,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _volatility = value),
            ),
            _GuidedSelect(
              label: "推荐优先级",
              value: _priority,
              items: const {
                "tax-efficiency": "税务优先",
                "balanced": "平衡",
                "stay-close": "贴近现状",
              },
              onChanged:
                  _saving ? null : (value) => setState(() => _priority = value),
            ),
            _GuidedSelect(
              label: "现金需求",
              value: _cashNeed,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged:
                  _saving ? null : (value) => setState(() => _cashNeed = value),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("生成草稿", style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    Text(draft.summary),
                    const SizedBox(height: 8),
                    ...draft.rationale.take(3).map((item) => Text("• $item")),
                  ],
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _apply,
                child: Text(_saving ? "应用中..." : "应用引导配置"),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GuidedSelect extends StatelessWidget {
  const _GuidedSelect({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final String value;
  final Map<String, String> items;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DropdownButtonFormField<String>(
        initialValue: value,
        decoration: InputDecoration(labelText: label),
        items: items.entries
            .map((entry) =>
                DropdownMenuItem(value: entry.key, child: Text(entry.value)))
            .toList(),
        onChanged: onChanged == null
            ? null
            : (value) => onChanged!(value ?? this.value),
      ),
    );
  }
}

class _PreferenceEditorSheet extends StatefulWidget {
  const _PreferenceEditorSheet({
    required this.apiClient,
    required this.profile,
  });

  final LooApiClient apiClient;
  final MobilePreferenceProfile profile;

  @override
  State<_PreferenceEditorSheet> createState() => _PreferenceEditorSheetState();
}

class _PreferenceEditorSheetState extends State<_PreferenceEditorSheet> {
  final _formKey = GlobalKey<FormState>();
  late var _riskProfile = widget.profile.riskProfile;
  late var _transitionPreference = widget.profile.transitionPreference;
  late var _recommendationStrategy = widget.profile.recommendationStrategy;
  late var _taxAwarePlacement = widget.profile.taxAwarePlacement;
  late final _cashBufferController = TextEditingController(
      text: widget.profile.cashBufferTargetCad.toStringAsFixed(0));
  late final _toleranceController = TextEditingController(
      text: widget.profile.rebalancingTolerancePct.toString());
  late final Map<String, TextEditingController> _allocationControllers = {
    for (final assetClass in _assetClasses)
      assetClass: TextEditingController(
        text: widget.profile.allocationPct(assetClass).toString(),
      ),
  };
  late final _priority =
      _normalizePriority(widget.profile.accountFundingPriority);
  var _saving = false;
  String? _error;

  @override
  void dispose() {
    _cashBufferController.dispose();
    _toleranceController.dispose();
    for (final controller in _allocationControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _applyRiskPreset(String riskProfile) {
    final preset = kPreferenceRiskPresets[riskProfile];
    if (preset == null) {
      return;
    }
    setState(() {
      _riskProfile = riskProfile;
      for (final entry in preset.entries) {
        _allocationControllers[entry.key]?.text = entry.value.toString();
      }
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final allocation = _assetClasses
        .map((assetClass) => MobileTargetAllocation(
              assetClass: assetClass,
              targetPct:
                  int.tryParse(_allocationControllers[assetClass]!.text) ?? 0,
            ))
        .toList();
    final total =
        allocation.fold<int>(0, (sum, target) => sum + target.targetPct);
    if (total != 100) {
      setState(() => _error = "目标配置必须合计 100%，当前是 $total%。");
      return;
    }
    if (_priority.toSet().length != _priority.length) {
      setState(() => _error = "账户优先级不能重复。");
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await widget.apiClient.updateInvestmentPreferences({
        "riskProfile": _riskProfile,
        "targetAllocation": allocation
            .map((target) => {
                  "assetClass": target.assetClass,
                  "targetPct": target.targetPct,
                })
            .toList(),
        "accountFundingPriority": _priority,
        "taxAwarePlacement": _taxAwarePlacement,
        "cashBufferTargetCad":
            double.tryParse(_cashBufferController.text.trim()) ?? 0,
        "transitionPreference": _transitionPreference,
        "recommendationStrategy": _recommendationStrategy,
        "source": "manual",
        "rebalancingTolerancePct":
            int.tryParse(_toleranceController.text.trim()) ?? 10,
        "watchlistSymbols": widget.profile.watchlistSymbols,
      });
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _saving = false;
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
              Text("编辑投资偏好", style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              const Text("这些规则会直接影响推荐页和后续组合健康评分。"),
              const SizedBox(height: 16),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: "Conservative", label: Text("保守")),
                  ButtonSegment(value: "Balanced", label: Text("平衡")),
                  ButtonSegment(value: "Growth", label: Text("成长")),
                ],
                selected: {_riskProfile},
                onSelectionChanged:
                    _saving ? null : (value) => _applyRiskPreset(value.first),
              ),
              const SizedBox(height: 16),
              Text("目标配置", style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              ..._assetClasses.map(
                (assetClass) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: TextFormField(
                    controller: _allocationControllers[assetClass],
                    enabled: !_saving,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(labelText: "$assetClass %"),
                    validator: _validatePercent,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text("账户优先级", style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              for (var index = 0; index < _priority.length; index++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: DropdownButtonFormField<String>(
                    initialValue: _priority[index],
                    decoration: InputDecoration(labelText: "第 ${index + 1} 顺位"),
                    items: _accountTypes
                        .map((type) =>
                            DropdownMenuItem(value: type, child: Text(type)))
                        .toList(),
                    onChanged: _saving
                        ? null
                        : (value) => setState(
                            () => _priority[index] = value ?? _priority[index]),
                  ),
                ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _transitionPreference,
                decoration: const InputDecoration(labelText: "调整节奏"),
                items: const [
                  DropdownMenuItem(value: "stay-close", child: Text("贴近现状")),
                  DropdownMenuItem(value: "gradual", child: Text("渐进调整")),
                  DropdownMenuItem(value: "direct", child: Text("直接调整")),
                ],
                onChanged: _saving
                    ? null
                    : (value) => setState(() =>
                        _transitionPreference = value ?? _transitionPreference),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _recommendationStrategy,
                decoration: const InputDecoration(labelText: "推荐策略"),
                items: const [
                  DropdownMenuItem(value: "tax-aware", child: Text("税务优先")),
                  DropdownMenuItem(value: "target-first", child: Text("目标优先")),
                  DropdownMenuItem(value: "balanced", child: Text("平衡")),
                ],
                onChanged: _saving
                    ? null
                    : (value) => setState(() => _recommendationStrategy =
                        value ?? _recommendationStrategy),
              ),
              const SizedBox(height: 10),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text("启用税务感知放置"),
                value: _taxAwarePlacement,
                onChanged: _saving
                    ? null
                    : (value) => setState(() => _taxAwarePlacement = value),
              ),
              TextFormField(
                controller: _cashBufferController,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: "现金缓冲目标 CAD"),
                validator: _validateMoney,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _toleranceController,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: "再平衡容忍度 %"),
                validator: _validatePercent,
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
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? "保存中..." : "保存偏好"),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String? _validatePercent(String? value) {
    final parsed = int.tryParse((value ?? "").trim());
    if (parsed == null || parsed < 0 || parsed > 100) {
      return "请输入 0 到 100 的整数";
    }
    return null;
  }

  String? _validateMoney(String? value) {
    final parsed = double.tryParse((value ?? "").trim());
    if (parsed == null || parsed < 0 || parsed > 1000000) {
      return "请输入有效金额";
    }
    return null;
  }

  List<String> _normalizePriority(List<String> value) {
    final normalized = value.where(_accountTypes.contains).toList();
    for (final type in _accountTypes) {
      if (!normalized.contains(type)) {
        normalized.add(type);
      }
    }
    return normalized.take(4).toList();
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Chip(label: Text("$label：$value"));
  }
}

class _AllocationRow extends StatelessWidget {
  const _AllocationRow(this.target);

  final MobileTargetAllocation target;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(child: Text(target.assetClass)),
          SizedBox(
            width: 90,
            child: LinearProgressIndicator(value: target.targetPct / 100),
          ),
          const SizedBox(width: 10),
          Text("${target.targetPct}%"),
        ],
      ),
    );
  }
}
