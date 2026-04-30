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

String _formatNullableNumber(double? value) {
  if (value == null) {
    return "";
  }
  return value == value.roundToDouble()
      ? value.toStringAsFixed(0)
      : value.toStringAsFixed(2);
}

double? _parseNullableDouble(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) {
    return null;
  }
  return double.tryParse(trimmed);
}

List<String> _parseTextList(String value, {int max = 20}) {
  return value
      .split(RegExp(r"[,，\n]+"))
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toSet()
      .take(max)
      .toList();
}

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

  Future<void> _openFactorEditor(MobilePreferenceProfile profile) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _PreferenceFactorsSheet(
        apiClient: widget.apiClient,
        profile: profile,
      ),
    );
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("进阶偏好已保存，V2.1 推荐会读取这些参数。")),
      );
      _refresh();
    }
  }

  Future<void> _openManualAdvancedEditor(MobilePreferenceProfile profile) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => const _ManualPreferenceHubSheet(),
    );
    if (!mounted || choice == null) {
      return;
    }
    if (choice == "basic") {
      await _openEditor(profile);
    } else if (choice == "rules") {
      await _openConstraintEditor(profile);
    } else if (choice == "factors") {
      await _openFactorEditor(profile);
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
                  ],
                ),
                const SizedBox(height: 8),
                Text(profile.summary),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => _openGuidedSetup(profile),
                        icon: const Icon(Icons.auto_awesome),
                        label: const Text("新手引导"),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _openManualAdvancedEditor(profile),
                        icon: const Icon(Icons.tune),
                        label: const Text("手动进阶"),
                      ),
                    ),
                  ],
                ),
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
                const SizedBox(height: 10),
                Text("进阶偏好：${profile.preferenceFactors.summary}"),
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

class _ManualPreferenceHubSheet extends StatelessWidget {
  const _ManualPreferenceHubSheet();

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, bottomInset + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("手动进阶编辑", style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          const Text("适合已经知道自己想怎么配置的用户。你可以分组修改所有参数。"),
          const SizedBox(height: 16),
          _ManualPreferenceChoice(
            icon: Icons.pie_chart_outline,
            title: "基础配置",
            subtitle: "风险档位、目标配置、账户优先级、现金缓冲、再平衡容忍度。",
            onTap: () => Navigator.of(context).pop("basic"),
          ),
          _ManualPreferenceChoice(
            icon: Icons.rule,
            title: "推荐规则",
            subtitle: "观察列表、偏好/排除标的、账户规则、资产区间和允许标的类型。",
            onTap: () => Navigator.of(context).pop("rules"),
          ),
          _ManualPreferenceChoice(
            icon: Icons.psychology_alt_outlined,
            title: "进阶因子",
            subtitle: "行业/风格偏好、买房目标、税务敏感度、USD 路径和外部信息开关。",
            onTap: () => Navigator.of(context).pop("factors"),
          ),
        ],
      ),
    );
  }
}

class _ManualPreferenceChoice extends StatelessWidget {
  const _ManualPreferenceChoice({
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
    return Card(
      child: ListTile(
        leading: Icon(icon),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

class _PreferenceFactorsSheet extends StatefulWidget {
  const _PreferenceFactorsSheet({
    required this.apiClient,
    required this.profile,
  });

  final LooApiClient apiClient;
  final MobilePreferenceProfile profile;

  @override
  State<_PreferenceFactorsSheet> createState() => _PreferenceFactorsSheetState();
}

class _PreferenceFactorsSheetState extends State<_PreferenceFactorsSheet> {
  late var _riskCapacity = widget.profile.preferenceFactors.riskCapacity;
  late var _volatilityComfort =
      widget.profile.preferenceFactors.volatilityComfort;
  late var _concentrationTolerance =
      widget.profile.preferenceFactors.concentrationTolerance;
  late var _homePurchaseEnabled =
      widget.profile.preferenceFactors.homePurchaseEnabled;
  late var _homePurchasePriority =
      widget.profile.preferenceFactors.homePurchasePriority;
  late var _rrspPriority =
      widget.profile.preferenceFactors.rrspDeductionPriority;
  late var _tfsaPriority = widget.profile.preferenceFactors.tfsaGrowthPriority;
  late var _fhsaPriority =
      widget.profile.preferenceFactors.fhsaHomeGoalPriority;
  late var _taxableSensitivity =
      widget.profile.preferenceFactors.taxableTaxSensitivity;
  late var _usdFundingPath = widget.profile.preferenceFactors.usdFundingPath;
  late var _liquidityNeed = widget.profile.preferenceFactors.liquidityNeed;
  late var _cashDuringUncertainty =
      widget.profile.preferenceFactors.cashDuringUncertainty;
  late var _allowNewsSignals =
      widget.profile.preferenceFactors.allowNewsSignals;
  late var _allowInstitutionalSignals =
      widget.profile.preferenceFactors.allowInstitutionalSignals;
  late var _allowCommunitySignals =
      widget.profile.preferenceFactors.allowCommunitySignals;
  late final _preferredSectorsController = TextEditingController(
      text: widget.profile.preferenceFactors.preferredSectors.join(", "));
  late final _avoidedSectorsController = TextEditingController(
      text: widget.profile.preferenceFactors.avoidedSectors.join(", "));
  late final _styleTiltsController = TextEditingController(
      text: widget.profile.preferenceFactors.styleTilts.join(", "));
  late final _themesController = TextEditingController(
      text: widget.profile.preferenceFactors.thematicInterests.join(", "));
  late final _homeHorizonController = TextEditingController(
      text: _formatNullableNumber(
          widget.profile.preferenceFactors.homePurchaseHorizonYears));
  late final _homeDownPaymentController = TextEditingController(
      text: _formatNullableNumber(
          widget.profile.preferenceFactors.homeDownPaymentTargetCad));
  late final _provinceController =
      TextEditingController(text: widget.profile.preferenceFactors.province ?? "ON");
  late final _monthlyContributionController = TextEditingController(
      text: _formatNullableNumber(
          widget.profile.preferenceFactors.monthlyContributionCad));
  late final _minimumTradeController = TextEditingController(
      text: _formatNullableNumber(
          widget.profile.preferenceFactors.minimumTradeSizeCad));
  final _ministerPromptController = TextEditingController();
  var _saving = false;
  var _drafting = false;
  String? _error;
  String? _draftSummary;
  List<String> _draftRationale = const [];

  @override
  void dispose() {
    _preferredSectorsController.dispose();
    _avoidedSectorsController.dispose();
    _styleTiltsController.dispose();
    _themesController.dispose();
    _homeHorizonController.dispose();
    _homeDownPaymentController.dispose();
    _provinceController.dispose();
    _monthlyContributionController.dispose();
    _minimumTradeController.dispose();
    _ministerPromptController.dispose();
    super.dispose();
  }

  void _applyFactorsToForm(MobilePreferenceFactors factors) {
    setState(() {
      _riskCapacity = factors.riskCapacity;
      _volatilityComfort = factors.volatilityComfort;
      _concentrationTolerance = factors.concentrationTolerance;
      _homePurchaseEnabled = factors.homePurchaseEnabled;
      _homePurchasePriority = factors.homePurchasePriority;
      _rrspPriority = factors.rrspDeductionPriority;
      _tfsaPriority = factors.tfsaGrowthPriority;
      _fhsaPriority = factors.fhsaHomeGoalPriority;
      _taxableSensitivity = factors.taxableTaxSensitivity;
      _usdFundingPath = factors.usdFundingPath;
      _liquidityNeed = factors.liquidityNeed;
      _cashDuringUncertainty = factors.cashDuringUncertainty;
      _allowNewsSignals = factors.allowNewsSignals;
      _allowInstitutionalSignals = factors.allowInstitutionalSignals;
      _allowCommunitySignals = factors.allowCommunitySignals;
      _preferredSectorsController.text = factors.preferredSectors.join(", ");
      _avoidedSectorsController.text = factors.avoidedSectors.join(", ");
      _styleTiltsController.text = factors.styleTilts.join(", ");
      _themesController.text = factors.thematicInterests.join(", ");
      _homeHorizonController.text =
          _formatNullableNumber(factors.homePurchaseHorizonYears);
      _homeDownPaymentController.text =
          _formatNullableNumber(factors.homeDownPaymentTargetCad);
      _provinceController.text = factors.province ?? "ON";
      _monthlyContributionController.text =
          _formatNullableNumber(factors.monthlyContributionCad);
      _minimumTradeController.text =
          _formatNullableNumber(factors.minimumTradeSizeCad);
    });
  }

  Future<void> _askMinisterForDraft() async {
    final narrative = _ministerPromptController.text.trim();
    if (narrative.length < 8) {
      setState(() => _error = "请先描述你的目标、风险承受或偏好的行业/税务需求。");
      return;
    }

    setState(() {
      _drafting = true;
      _error = null;
      _draftSummary = null;
      _draftRationale = const [];
    });

    try {
      final response = await widget.apiClient.createPreferenceFactorsDraft({
        "narrative": narrative,
        "currentPreferenceFactors": widget.profile.preferenceFactors.toPayload(),
      });
      final data = response["data"];
      if (data is! Map<String, dynamic>) {
        throw const LooApiException("大臣草稿格式不正确。");
      }
      final factors = MobilePreferenceFactors.fromJson(data["preferenceFactors"]);
      _applyFactorsToForm(factors);
      if (mounted) {
        setState(() {
          _draftSummary = data["summary"] as String? ?? "大臣已生成进阶偏好草稿。";
          _draftRationale =
              (data["rationale"] as List?)?.whereType<String>().toList() ??
                  const [];
          _drafting = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _drafting = false;
        });
      }
    }
  }

  Future<void> _save() async {
    final factors = MobilePreferenceFactors(
      riskCapacity: _riskCapacity,
      volatilityComfort: _volatilityComfort,
      concentrationTolerance: _concentrationTolerance,
      leverageAllowed: false,
      optionsAllowed: false,
      cryptoAllowed: false,
      preferredSectors: _parseTextList(_preferredSectorsController.text),
      avoidedSectors: _parseTextList(_avoidedSectorsController.text),
      styleTilts: _parseTextList(_styleTiltsController.text),
      thematicInterests: _parseTextList(_themesController.text),
      homePurchaseEnabled: _homePurchaseEnabled,
      homePurchaseHorizonYears: _parseNullableDouble(_homeHorizonController.text),
      homeDownPaymentTargetCad:
          _parseNullableDouble(_homeDownPaymentController.text),
      homePurchasePriority: _homePurchasePriority,
      emergencyFundTargetCad: widget.profile.preferenceFactors.emergencyFundTargetCad,
      retirementHorizonYears: widget.profile.preferenceFactors.retirementHorizonYears,
      province: _provinceController.text.trim().isEmpty
          ? null
          : _provinceController.text.trim().toUpperCase(),
      marginalTaxBracket: widget.profile.preferenceFactors.marginalTaxBracket,
      rrspDeductionPriority: _rrspPriority,
      tfsaGrowthPriority: _tfsaPriority,
      fhsaHomeGoalPriority: _fhsaPriority,
      taxableTaxSensitivity: _taxableSensitivity,
      dividendWithholdingSensitivity:
          widget.profile.preferenceFactors.dividendWithholdingSensitivity,
      usdFundingPath: _usdFundingPath,
      monthlyContributionCad:
          _parseNullableDouble(_monthlyContributionController.text),
      minimumTradeSizeCad: _parseNullableDouble(_minimumTradeController.text),
      liquidityNeed: _liquidityNeed,
      cashDuringUncertainty: _cashDuringUncertainty,
      allowNewsSignals: _allowNewsSignals,
      allowInstitutionalSignals: _allowInstitutionalSignals,
      allowCommunitySignals: _allowCommunitySignals,
      preferredFreshnessHours:
          widget.profile.preferenceFactors.preferredFreshnessHours,
      maxDailyExternalCalls: widget.profile.preferenceFactors.maxDailyExternalCalls,
    );

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
        "accountFundingPriority": widget.profile.accountFundingPriority,
        "taxAwarePlacement": widget.profile.taxAwarePlacement,
        "cashBufferTargetCad": widget.profile.cashBufferTargetCad,
        "transitionPreference": widget.profile.transitionPreference,
        "recommendationStrategy": widget.profile.recommendationStrategy,
        "source": "manual",
        "rebalancingTolerancePct": widget.profile.rebalancingTolerancePct,
        "watchlistSymbols": widget.profile.watchlistSymbols,
        "preferenceFactors": factors.toPayload(),
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
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("进阶偏好", style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            const Text("这些参数会影响 V2.1 的候选排序和解释；不会覆盖你的目标配置。"),
            const SizedBox(height: 16),
            TextField(
              controller: _ministerPromptController,
              enabled: !_saving && !_drafting,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: "让大臣草拟参数",
                helperText:
                    "描述你的目标，例如：我更激进，偏科技能源，未来 5 年可能买房，也想做税务优化。",
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _saving || _drafting ? null : _askMinisterForDraft,
                icon: const Icon(Icons.auto_awesome),
                label: Text(_drafting ? "大臣草拟中..." : "请大臣生成草稿"),
              ),
            ),
            if (_draftSummary != null) ...[
              const SizedBox(height: 10),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("大臣草稿已填入表单",
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 6),
                      Text(_draftSummary!),
                      const SizedBox(height: 6),
                      ..._draftRationale.take(3).map((item) => Text("• $item")),
                      const SizedBox(height: 6),
                      const Text("确认无误后点击底部保存；你也可以先手动修改。"),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            _GuidedSelect(
              label: "风险容量",
              value: _riskCapacity,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged:
                  _saving ? null : (value) => setState(() => _riskCapacity = value),
            ),
            _GuidedSelect(
              label: "波动舒适度",
              value: _volatilityComfort,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _volatilityComfort = value),
            ),
            _GuidedSelect(
              label: "集中度容忍",
              value: _concentrationTolerance,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _concentrationTolerance = value),
            ),
            _factorTextField(_preferredSectorsController, "偏好行业",
                "例如 Technology, Energy；V2.1 会轻量加分。"),
            _factorTextField(_avoidedSectorsController, "回避行业",
                "例如 Tobacco；命中后会降低候选分。"),
            _factorTextField(_styleTiltsController, "风格偏好",
                "例如 Growth, Quality, Dividend。"),
            _factorTextField(_themesController, "主题兴趣",
                "例如 AI infrastructure, clean energy。"),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text("有买房/首付目标"),
              value: _homePurchaseEnabled,
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _homePurchaseEnabled = value),
            ),
            if (_homePurchaseEnabled) ...[
              TextField(
                controller: _homeHorizonController,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: "买房时间线 年"),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _homeDownPaymentController,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: "首付目标 CAD"),
              ),
              const SizedBox(height: 10),
              _GuidedSelect(
                label: "买房目标优先级",
                value: _homePurchasePriority,
                items: const {"low": "低", "medium": "中", "high": "高"},
                onChanged: _saving
                    ? null
                    : (value) => setState(() => _homePurchasePriority = value),
              ),
            ],
            TextField(
              controller: _provinceController,
              enabled: !_saving,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(labelText: "税务省份"),
            ),
            const SizedBox(height: 10),
            _GuidedSelect(
              label: "RRSP 抵税优先级",
              value: _rrspPriority,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged:
                  _saving ? null : (value) => setState(() => _rrspPriority = value),
            ),
            _GuidedSelect(
              label: "TFSA 成长优先级",
              value: _tfsaPriority,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged:
                  _saving ? null : (value) => setState(() => _tfsaPriority = value),
            ),
            _GuidedSelect(
              label: "FHSA 买房优先级",
              value: _fhsaPriority,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged:
                  _saving ? null : (value) => setState(() => _fhsaPriority = value),
            ),
            _GuidedSelect(
              label: "Taxable 税务敏感度",
              value: _taxableSensitivity,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _taxableSensitivity = value),
            ),
            _GuidedSelect(
              label: "USD 入金路径",
              value: _usdFundingPath,
              items: const {
                "unknown": "未知",
                "available": "可稳定使用",
                "avoid": "尽量避免",
              },
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _usdFundingPath = value),
            ),
            TextField(
              controller: _monthlyContributionController,
              enabled: !_saving,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: "月度新增资金 CAD"),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _minimumTradeController,
              enabled: !_saving,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: "最小交易金额 CAD"),
            ),
            const SizedBox(height: 10),
            _GuidedSelect(
              label: "流动性需求",
              value: _liquidityNeed,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged:
                  _saving ? null : (value) => setState(() => _liquidityNeed = value),
            ),
            _GuidedSelect(
              label: "不确定时期持现金意愿",
              value: _cashDuringUncertainty,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _cashDuringUncertainty = value),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text("允许新闻信号影响推荐"),
              subtitle: const Text("当前只保存偏好；V3 接入外部信息后读取。"),
              value: _allowNewsSignals,
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _allowNewsSignals = value),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text("允许机构/基本面信号"),
              value: _allowInstitutionalSignals,
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _allowInstitutionalSignals = value),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text("允许社区情绪作为低置信参考"),
              value: _allowCommunitySignals,
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _allowCommunitySignals = value),
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
                child: Text(_saving ? "保存中..." : "保存进阶偏好"),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _factorTextField(
    TextEditingController controller,
    String label,
    String helper,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        enabled: !_saving,
        decoration: InputDecoration(labelText: label, helperText: helper),
      ),
    );
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
                    Text("进阶偏好：${draft.preferenceFactors.summary}"),
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
