import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";

const _assetClasses = [
  "Canadian Equity",
  "US Equity",
  "International Equity",
  "Fixed Income",
  "Cash",
];

const _accountTypes = ["TFSA", "RRSP", "FHSA", "Taxable"];

const _riskPresets = {
  "Conservative": {
    "Canadian Equity": 18,
    "US Equity": 22,
    "International Equity": 10,
    "Fixed Income": 35,
    "Cash": 15,
  },
  "Balanced": {
    "Canadian Equity": 22,
    "US Equity": 32,
    "International Equity": 16,
    "Fixed Income": 20,
    "Cash": 10,
  },
  "Growth": {
    "Canadian Equity": 16,
    "US Equity": 42,
    "International Equity": 22,
    "Fixed Income": 10,
    "Cash": 10,
  },
};

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
  late final _excludedController = TextEditingController(
      text: _formatSecurityIdentities(
          widget.profile.recommendationConstraints.excludedSecurities,
          widget.profile.recommendationConstraints.excludedSymbols));
  late final _preferredController = TextEditingController(
      text: _formatSecurityIdentities(
          widget.profile.recommendationConstraints.preferredSecurities,
          widget.profile.recommendationConstraints.preferredSymbols));
  late final _avoidAccountsController = TextEditingController(
      text: widget.profile.recommendationConstraints.avoidAccountTypes
          .join(", "));
  late final _preferredAccountsController = TextEditingController(
      text: widget.profile.recommendationConstraints.preferredAccountTypes
          .join(", "));
  late final _assetBandsController = TextEditingController(
      text: _formatAssetClassBands(
          widget.profile.recommendationConstraints.assetClassBands));
  var _saving = false;
  String? _error;

  @override
  void dispose() {
    _watchlistController.dispose();
    _excludedController.dispose();
    _preferredController.dispose();
    _avoidAccountsController.dispose();
    _preferredAccountsController.dispose();
    _assetBandsController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final watchlist = _parseSymbols(_watchlistController.text, max: 20);
    final excludedSecurities =
        _parseSecurityIdentities(_excludedController.text);
    final excludedSymbols =
        excludedSecurities.map((item) => item["symbol"] as String).toList();
    final preferredSecurities =
        _parseSecurityIdentities(_preferredController.text)
            .where((item) => !excludedSymbols.contains(item["symbol"]))
            .toList();
    final preferredSymbols =
        preferredSecurities.map((item) => item["symbol"] as String).toList();
    final avoidAccountTypes = _parseAccountTypes(_avoidAccountsController.text);
    final preferredAccountTypes =
        _parseAccountTypes(_preferredAccountsController.text)
            .where((type) => !avoidAccountTypes.contains(type))
            .toList();
    final assetClassBands = _parseAssetClassBands(_assetBandsController.text);
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
          "allowedSecurityTypes":
              widget.profile.recommendationConstraints.allowedSecurityTypes,
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
            TextField(
              controller: _preferredController,
              enabled: !_saving,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: "偏好标的",
                helperText: "格式：VFV|TSX|CAD；也可只写 VFV。用逗号或空格分隔。",
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _excludedController,
              enabled: !_saving,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: "排除标的",
                helperText: "格式：AMZN|NASDAQ|USD；排除优先级高于偏好。",
              ),
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

  List<Map<String, dynamic>> _parseSecurityIdentities(String value) {
    return value
        .split(RegExp(r"[,，\s]+"))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .map((item) {
          final parts = item.split("|").map((part) => part.trim()).toList();
          final symbol = parts.isNotEmpty ? parts[0].toUpperCase() : "";
          final exchange = parts.length > 1 && parts[1].isNotEmpty
              ? parts[1].toUpperCase()
              : null;
          final currency = parts.length > 2 && parts[2].isNotEmpty
              ? parts[2].toUpperCase()
              : null;
          return {
            "symbol": symbol,
            if (exchange != null) "exchange": exchange,
            if (currency == "CAD" || currency == "USD") "currency": currency,
          };
        })
        .where((item) => (item["symbol"] as String).isNotEmpty)
        .toList();
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

  String _formatSecurityIdentities(
    List<Map<String, dynamic>> identities,
    List<String> fallbackSymbols,
  ) {
    final source = identities.isNotEmpty
        ? identities
        : fallbackSymbols.map((symbol) => {"symbol": symbol}).toList();
    return source.map((item) {
      final symbol = item["symbol"] as String? ?? "";
      final exchange = item["exchange"] as String?;
      final currency = item["currency"] as String?;
      return [
        symbol,
        if (exchange != null && exchange.isNotEmpty) exchange,
        if (currency != null && currency.isNotEmpty) currency,
      ].join("|");
    }).join(", ");
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
    final preset = _riskPresets[riskProfile];
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

class MobilePreferenceProfile {
  const MobilePreferenceProfile({
    required this.riskProfile,
    required this.targetAllocation,
    required this.accountFundingPriority,
    required this.taxAwarePlacement,
    required this.cashBufferTargetCad,
    required this.transitionPreference,
    required this.recommendationStrategy,
    required this.rebalancingTolerancePct,
    required this.watchlistSymbols,
    required this.recommendationConstraints,
  });

  final String riskProfile;
  final List<MobileTargetAllocation> targetAllocation;
  final List<String> accountFundingPriority;
  final bool taxAwarePlacement;
  final double cashBufferTargetCad;
  final String transitionPreference;
  final String recommendationStrategy;
  final int rebalancingTolerancePct;
  final List<String> watchlistSymbols;
  final MobileRecommendationConstraints recommendationConstraints;

  String get riskProfileLabel => switch (riskProfile) {
        "Conservative" => "保守",
        "Growth" => "成长",
        _ => "平衡",
      };

  String get summary {
    final equity = targetAllocation
        .where((target) =>
            target.assetClass != "Fixed Income" && target.assetClass != "Cash")
        .fold<int>(0, (sum, target) => sum + target.targetPct);
    final fixedIncome = allocationPct("Fixed Income");
    final cash = allocationPct("Cash");
    return "$riskProfileLabel · 股/债/现金 $equity/$fixedIncome/$cash";
  }

  int allocationPct(String assetClass) {
    return targetAllocation
        .firstWhere(
          (target) => target.assetClass == assetClass,
          orElse: () =>
              MobileTargetAllocation(assetClass: assetClass, targetPct: 0),
        )
        .targetPct;
  }

  factory MobilePreferenceProfile.fromJson(Map<String, dynamic> json) {
    return MobilePreferenceProfile(
      riskProfile: json["riskProfile"] as String? ?? "Balanced",
      targetAllocation: (json["targetAllocation"] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(MobileTargetAllocation.fromJson)
              .toList() ??
          const [],
      accountFundingPriority: (json["accountFundingPriority"] as List?)
              ?.whereType<String>()
              .toList() ??
          const ["TFSA", "RRSP", "Taxable"],
      taxAwarePlacement: json["taxAwarePlacement"] as bool? ?? true,
      cashBufferTargetCad:
          (json["cashBufferTargetCad"] as num?)?.toDouble() ?? 0,
      transitionPreference:
          json["transitionPreference"] as String? ?? "gradual",
      recommendationStrategy:
          json["recommendationStrategy"] as String? ?? "balanced",
      rebalancingTolerancePct:
          (json["rebalancingTolerancePct"] as num?)?.toInt() ?? 10,
      watchlistSymbols:
          (json["watchlistSymbols"] as List?)?.whereType<String>().toList() ??
              const [],
      recommendationConstraints: MobileRecommendationConstraints.fromJson(
          json["recommendationConstraints"]),
    );
  }
}

class MobileRecommendationConstraints {
  const MobileRecommendationConstraints({
    required this.excludedSymbols,
    required this.preferredSymbols,
    required this.excludedSecurities,
    required this.preferredSecurities,
    required this.assetClassBands,
    required this.avoidAccountTypes,
    required this.preferredAccountTypes,
    required this.allowedSecurityTypes,
  });

  final List<String> excludedSymbols;
  final List<String> preferredSymbols;
  final List<Map<String, dynamic>> excludedSecurities;
  final List<Map<String, dynamic>> preferredSecurities;
  final List<Map<String, dynamic>> assetClassBands;
  final List<String> avoidAccountTypes;
  final List<String> preferredAccountTypes;
  final List<String> allowedSecurityTypes;

  factory MobileRecommendationConstraints.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileRecommendationConstraints(
      excludedSymbols:
          (json["excludedSymbols"] as List?)?.whereType<String>().toList() ??
              const [],
      preferredSymbols:
          (json["preferredSymbols"] as List?)?.whereType<String>().toList() ??
              const [],
      excludedSecurities: (json["excludedSecurities"] as List?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [],
      preferredSecurities: (json["preferredSecurities"] as List?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [],
      assetClassBands: (json["assetClassBands"] as List?)
              ?.whereType<Map<String, dynamic>>()
              .toList() ??
          const [],
      avoidAccountTypes:
          (json["avoidAccountTypes"] as List?)?.whereType<String>().toList() ??
              const [],
      preferredAccountTypes: (json["preferredAccountTypes"] as List?)
              ?.whereType<String>()
              .toList() ??
          const [],
      allowedSecurityTypes: (json["allowedSecurityTypes"] as List?)
              ?.whereType<String>()
              .toList() ??
          const [],
    );
  }
}

class MobileGuidedDraft {
  const MobileGuidedDraft({
    required this.answers,
    required this.riskProfile,
    required this.targetAllocation,
    required this.accountFundingPriority,
    required this.taxAwarePlacement,
    required this.cashBufferTargetCad,
    required this.transitionPreference,
    required this.recommendationStrategy,
    required this.rebalancingTolerancePct,
    required this.assumptions,
    required this.rationale,
  });

  final Map<String, String> answers;
  final String riskProfile;
  final List<MobileTargetAllocation> targetAllocation;
  final List<String> accountFundingPriority;
  final bool taxAwarePlacement;
  final double cashBufferTargetCad;
  final String transitionPreference;
  final String recommendationStrategy;
  final int rebalancingTolerancePct;
  final List<String> assumptions;
  final List<String> rationale;

  String get riskLabel => switch (riskProfile) {
        "Conservative" => "保守",
        "Growth" => "成长",
        _ => "平衡",
      };

  String get summary {
    final equity = targetAllocation
        .where((target) =>
            target.assetClass != "Fixed Income" && target.assetClass != "Cash")
        .fold<int>(0, (sum, target) => sum + target.targetPct);
    final fixedIncome = targetAllocation
        .firstWhere((target) => target.assetClass == "Fixed Income")
        .targetPct;
    final cash = targetAllocation
        .firstWhere((target) => target.assetClass == "Cash")
        .targetPct;
    return "$riskLabel · 股/债/现金 $equity/$fixedIncome/$cash · ${accountFundingPriority.join(" -> ")}";
  }

  Map<String, dynamic> get suggestedProfilePayload => {
        "riskProfile": riskProfile,
        "targetAllocation": targetAllocation
            .map((target) => {
                  "assetClass": target.assetClass,
                  "targetPct": target.targetPct,
                })
            .toList(),
        "accountFundingPriority": accountFundingPriority,
        "taxAwarePlacement": taxAwarePlacement,
        "cashBufferTargetCad": cashBufferTargetCad,
        "transitionPreference": transitionPreference,
        "recommendationStrategy": recommendationStrategy,
        "rebalancingTolerancePct": rebalancingTolerancePct,
      };

  Map<String, dynamic> toDraftPayload() {
    return {
      "answers": answers,
      "suggestedProfile": suggestedProfilePayload,
      "assumptions": assumptions,
      "rationale": rationale,
    };
  }

  factory MobileGuidedDraft.fromAnswers({
    required String goal,
    required String horizon,
    required String volatility,
    required String priority,
    required String cashNeed,
  }) {
    var score = 0;
    if (horizon == "long") score += 1;
    if (volatility == "high") score += 1;
    if (goal == "wealth" || goal == "retirement") score += 1;
    if (cashNeed == "high") score -= 1;
    if (goal == "capital-preservation") score -= 2;
    if (goal == "home" && horizon == "short") score -= 2;

    final riskProfile = score >= 2
        ? "Growth"
        : score <= 0
            ? "Conservative"
            : "Balanced";
    final allocation = _riskPresets[riskProfile]!
        .entries
        .map((entry) => MobileTargetAllocation(
              assetClass: entry.key,
              targetPct: entry.value,
            ))
        .toList();

    int indexOf(String assetClass) =>
        allocation.indexWhere((target) => target.assetClass == assetClass);
    void adjust(String assetClass, int delta) {
      final index = indexOf(assetClass);
      if (index < 0) return;
      final current = allocation[index];
      allocation[index] = MobileTargetAllocation(
        assetClass: current.assetClass,
        targetPct: current.targetPct + delta,
      );
    }

    if (goal == "home" || cashNeed == "high") {
      adjust("Fixed Income", 5);
      adjust("Cash", 5);
      adjust("US Equity", -10);
    } else if (volatility == "high" && horizon == "long") {
      adjust("International Equity", 4);
      adjust("Fixed Income", -2);
      adjust("Cash", -2);
    }

    final transitionPreference = priority == "stay-close"
        ? "stay-close"
        : horizon == "short"
            ? "gradual"
            : "direct";
    final recommendationStrategy = priority == "tax-efficiency"
        ? "tax-aware"
        : priority == "stay-close"
            ? "balanced"
            : "target-first";
    final taxAwarePlacement = priority == "tax-efficiency";
    final cashBufferTargetCad = cashNeed == "high"
        ? 15000.0
        : cashNeed == "medium"
            ? 8000.0
            : 4000.0;
    final rebalancingTolerancePct = horizon == "short"
        ? 8
        : volatility == "high"
            ? 14
            : 10;
    final accountFundingPriority = goal == "home"
        ? ["FHSA", "TFSA", "RRSP"]
        : goal == "retirement"
            ? ["RRSP", "TFSA", "Taxable"]
            : priority == "tax-efficiency"
                ? ["TFSA", "RRSP", "Taxable"]
                : ["TFSA", "Taxable", "RRSP"];

    return MobileGuidedDraft(
      answers: {
        "goal": goal,
        "horizon": horizon,
        "volatility": volatility,
        "priority": priority,
        "cashNeed": cashNeed,
      },
      riskProfile: riskProfile,
      targetAllocation: allocation,
      accountFundingPriority: accountFundingPriority,
      taxAwarePlacement: taxAwarePlacement,
      cashBufferTargetCad: cashBufferTargetCad,
      transitionPreference: transitionPreference,
      recommendationStrategy: recommendationStrategy,
      rebalancingTolerancePct: rebalancingTolerancePct,
      assumptions: [
        "目标：$goal",
        "期限：$horizon",
        "波动承受：$volatility",
        "现金需求：$cashNeed",
      ],
      rationale: [
        "根据期限、目标和波动承受度，将风险档位设为 $riskProfile。",
        taxAwarePlacement ? "启用税务感知放置，优先使用更合适的账户桶。" : "使用较简洁的账户匹配规则。",
        "调整节奏设为 $transitionPreference，推荐策略设为 $recommendationStrategy。",
      ],
    );
  }
}

class MobileTargetAllocation {
  const MobileTargetAllocation({
    required this.assetClass,
    required this.targetPct,
  });

  final String assetClass;
  final int targetPct;

  factory MobileTargetAllocation.fromJson(Map<String, dynamic> json) {
    return MobileTargetAllocation(
      assetClass: json["assetClass"] as String? ?? "Unknown",
      targetPct: (json["targetPct"] as num?)?.toInt() ?? 0,
    );
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
