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
              ],
            ),
          ),
        );
      },
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
