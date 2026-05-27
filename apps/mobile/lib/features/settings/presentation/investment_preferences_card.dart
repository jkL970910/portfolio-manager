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
const _candidateRoles = {
  "core": "核心池",
  "satellite": "卫星标的",
  "cash_parking": "现金停泊",
  "defensive": "防守候选",
};

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
  const InvestmentPreferencesCard({
    required this.apiClient,
    this.preferencesGuideKey,
    this.registeredRoomGuideKey,
    super.key,
  });

  final LooApiClient apiClient;
  final GlobalKey? preferencesGuideKey;
  final GlobalKey? registeredRoomGuideKey;

  @override
  State<InvestmentPreferencesCard> createState() =>
      _InvestmentPreferencesCardState();
}

class _PreferenceSettingsSnapshot {
  const _PreferenceSettingsSnapshot({
    required this.profile,
    required this.registeredRooms,
  });

  final MobilePreferenceProfile profile;
  final MobileRegisteredRooms registeredRooms;
}

class _InvestmentPreferencesCardState extends State<InvestmentPreferencesCard> {
  late Future<_PreferenceSettingsSnapshot> _settings;

  @override
  void initState() {
    super.initState();
    _settings = _loadSettings();
  }

  Future<_PreferenceSettingsSnapshot> _loadSettings() async {
    final response = await widget.apiClient.getInvestmentPreferences();
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("投资偏好格式不正确。");
    }
    final profile = data["profile"];
    if (profile is! Map<String, dynamic>) {
      throw const LooApiException("投资偏好档案不存在。");
    }
    return _PreferenceSettingsSnapshot(
      profile: MobilePreferenceProfile.fromJson(profile),
      registeredRooms: MobileRegisteredRooms.fromJson(data["registeredRooms"]),
    );
  }

  void _refresh() {
    setState(() {
      _settings = _loadSettings();
    });
  }

  Future<void> _markPreferencesOnboardingCompleted() async {
    try {
      await widget.apiClient.updateOnboarding({
        "checklist": {"preferences": "completed"},
      });
    } catch (_) {
      // Preference saving remains valid; onboarding progress can refresh later.
    }
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
      await _markPreferencesOnboardingCompleted();
      if (!mounted) return;
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
      await _markPreferencesOnboardingCompleted();
      if (!mounted) return;
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
      await _markPreferencesOnboardingCompleted();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("候选池治理已保存，下一次 Loo皇推荐会读取新边界。")),
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
      await _markPreferencesOnboardingCompleted();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("进阶偏好已保存，推荐 V4 会读取这些参数。")),
      );
      _refresh();
    }
  }

  Future<void> _openManualAdvancedEditor(
      MobilePreferenceProfile profile) async {
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

  Future<void> _openRegisteredRoomEditor(
      MobileRegisteredRooms registeredRooms) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _RegisteredRoomEditorSheet(
        apiClient: widget.apiClient,
        registeredRooms: registeredRooms,
      ),
    );
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("注册额度已保存。")),
      );
      _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_PreferenceSettingsSnapshot>(
      future: _settings,
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

        final settings = snapshot.data!;
        final profile = settings.profile;
        final registeredRooms = settings.registeredRooms;
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
                KeyedSubtree(
                  key: widget.preferencesGuideKey,
                  child: Row(
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
                ),
                const SizedBox(height: 10),
                Text("已应用参数摘要", style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                const Text("这些不是单独的输入框，而是由新手引导或手动进阶保存后的推导结果。"),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _InfoChip("风险档位", profile.riskProfileLabel),
                    _InfoChip("再平衡阈值", "${profile.rebalancingTolerancePct}%"),
                    _InfoChip("现金缓冲",
                        "\$${profile.cashBufferTargetCad.toStringAsFixed(0)}"),
                    _InfoChip("税务放置", profile.taxAwarePlacement ? "开启" : "关闭"),
                  ],
                ),
                const SizedBox(height: 12),
                KeyedSubtree(
                  key: widget.registeredRoomGuideKey,
                  child: _RegisteredRoomSummaryCard(
                    registeredRooms: registeredRooms,
                    onEdit: () => _openRegisteredRoomEditor(registeredRooms),
                  ),
                ),
                const SizedBox(height: 10),
                Text("进阶偏好：${profile.preferenceFactors.summary}"),
                if (profile.preferenceFactors.preferredSectors.isNotEmpty ||
                    profile.preferenceFactors.styleTilts.isNotEmpty ||
                    profile.preferenceFactors.thematicInterests.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    [
                      if (profile.preferenceFactors.preferredSectors.isNotEmpty)
                        "偏好行业：${profile.preferenceFactors.preferredSectors.join("、")}",
                      if (profile.preferenceFactors.styleTilts.isNotEmpty)
                        "风格：${profile.preferenceFactors.styleTilts.join("、")}",
                      if (profile
                          .preferenceFactors.thematicInterests.isNotEmpty)
                        "主题：${profile.preferenceFactors.thematicInterests.join("、")}",
                    ].join("；"),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
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
                      "候选偏好：${profile.recommendationConstraints.preferredSymbols.join("、")}"),
                ],
                if (profile
                    .recommendationConstraints.excludedSymbols.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                      "不进候选池：${profile.recommendationConstraints.excludedSymbols.join("、")}"),
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
  late final List<String> _includedCandidateRoles = _normalizeCandidateRoles(
      widget.profile.recommendationConstraints.includedCandidateRoles);
  late final List<String> _excludedCandidateRoles = _normalizeCandidateRoles(
      widget.profile.recommendationConstraints.excludedCandidateRoles);
  late var _allowRelaxedCoreFallback =
      widget.profile.recommendationConstraints.allowRelaxedCoreFallback;
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
          "includedCandidateRoles": _includedCandidateRoles,
          "excludedCandidateRoles": _excludedCandidateRoles,
          "allowRelaxedCoreFallback": _allowRelaxedCoreFallback,
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
            Text("候选池治理", style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            const Text(
              "这里管理 Loo皇能看哪些标的：观察、偏好、排除、账户和候选角色。它不等于手动指定最终推荐，最终仍由组合缺口、税务放置和护栏决定。",
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _watchlistController,
              enabled: !_saving,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: "近期观察/自选候选",
                helperText: "会进入 raw pool 接受规则检查；用逗号或空格分隔，最多 20 个。",
              ),
            ),
            const SizedBox(height: 12),
            _SecurityIdentityChipEditor(
              title: "偏好候选",
              helperText: "通过搜索添加，保存代码、交易所和币种；只加权，不保证入选。",
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
              title: "不进候选池",
              helperText: "排除优先级高于偏好；被排除后不会被核心池兜底强塞。",
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
                labelText: "偏好放置账户",
                helperText: "例如 TFSA, RRSP；只影响账户放置评分。",
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _avoidAccountsController,
              enabled: !_saving,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: "回避放置账户",
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
                labelText: "资产类别候选边界",
                helperText: "每行一个，例如 US Equity:10-45；用于约束推荐目标。",
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _allowedSecurityTypesController,
              enabled: !_saving,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: "允许候选类型",
                helperText: "例如 ETF, Common Stock, Commodity ETF；留空表示不限制。",
              ),
            ),
            const SizedBox(height: 12),
            _buildCandidateRoleControls(context),
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
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text("允许手动启用核心池兜底"),
              subtitle: const Text("候选池为空时不会自动强塞；开启后只能手动放宽到高置信核心池，仍不会覆盖明确排除。"),
              value: _allowRelaxedCoreFallback,
              onChanged: _saving
                  ? null
                  : (value) =>
                      setState(() => _allowRelaxedCoreFallback = value),
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

  List<String> _normalizeCandidateRoles(List<String> roles) {
    return roles
        .where(_candidateRoles.containsKey)
        .toSet()
        .toList(growable: true);
  }

  void _toggleIncludedRole(String role, bool selected) {
    setState(() {
      if (selected) {
        if (!_includedCandidateRoles.contains(role)) {
          _includedCandidateRoles.add(role);
        }
        _excludedCandidateRoles.remove(role);
      } else {
        _includedCandidateRoles.remove(role);
      }
    });
  }

  void _toggleExcludedRole(String role, bool selected) {
    setState(() {
      if (selected) {
        if (!_excludedCandidateRoles.contains(role)) {
          _excludedCandidateRoles.add(role);
        }
        _includedCandidateRoles.remove(role);
      } else {
        _excludedCandidateRoles.remove(role);
      }
    });
  }

  Widget _buildCandidateRoleControls(BuildContext context) {
    return InputDecorator(
      decoration: const InputDecoration(
        labelText: "候选角色边界",
        helperText: "留空表示按风险偏好自动决定；排除优先于纳入。",
        border: OutlineInputBorder(),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("只允许这些角色", style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _candidateRoles.entries
                .map(
                  (entry) => FilterChip(
                    label: Text(entry.value),
                    selected: _includedCandidateRoles.contains(entry.key),
                    onSelected: _saving
                        ? null
                        : (selected) =>
                            _toggleIncludedRole(entry.key, selected),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 12),
          Text("明确排除", style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _candidateRoles.entries
                .map(
                  (entry) => FilterChip(
                    label: Text(entry.value),
                    selected: _excludedCandidateRoles.contains(entry.key),
                    onSelected: _saving
                        ? null
                        : (selected) =>
                            _toggleExcludedRole(entry.key, selected),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
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
            title: "候选池治理",
            subtitle: "观察列表、偏好/排除候选、账户放置、资产区间和允许标的类型。",
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
  State<_PreferenceFactorsSheet> createState() =>
      _PreferenceFactorsSheetState();
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
  late final _provinceController = TextEditingController(
      text: widget.profile.preferenceFactors.province ?? "ON");
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
        "currentPreferenceFactors":
            widget.profile.preferenceFactors.toPayload(),
      });
      final data = response["data"];
      if (data is! Map<String, dynamic>) {
        throw const LooApiException("大臣草稿格式不正确。");
      }
      final factors =
          MobilePreferenceFactors.fromJson(data["preferenceFactors"]);
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
      homePurchaseHorizonYears:
          _parseNullableDouble(_homeHorizonController.text),
      homeDownPaymentTargetCad:
          _parseNullableDouble(_homeDownPaymentController.text),
      homePurchasePriority: _homePurchasePriority,
      emergencyFundTargetCad:
          widget.profile.preferenceFactors.emergencyFundTargetCad,
      retirementHorizonYears:
          widget.profile.preferenceFactors.retirementHorizonYears,
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
      maxDailyExternalCalls:
          widget.profile.preferenceFactors.maxDailyExternalCalls,
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
            const Text("这些参数会影响推荐 V4 的候选排序和解释；不会覆盖你的目标配置。"),
            const SizedBox(height: 16),
            TextField(
              controller: _ministerPromptController,
              enabled: !_saving && !_drafting,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: "让大臣草拟参数",
                helperText: "描述你的目标，例如：我更激进，偏科技能源，未来 5 年可能买房，也想做税务优化。",
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
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _riskCapacity = value),
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
                "例如 Technology, Energy；推荐 V4 会轻量加分。"),
            _factorTextField(
                _avoidedSectorsController, "回避行业", "例如 Tobacco；命中后会降低候选分。"),
            _factorTextField(
                _styleTiltsController, "风格偏好", "例如 Growth, Quality, Dividend。"),
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
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _rrspPriority = value),
            ),
            _GuidedSelect(
              label: "TFSA 成长优先级",
              value: _tfsaPriority,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _tfsaPriority = value),
            ),
            _GuidedSelect(
              label: "FHSA 买房优先级",
              value: _fhsaPriority,
              items: const {"low": "低", "medium": "中", "high": "高"},
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _fhsaPriority = value),
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
              onChanged: _saving
                  ? null
                  : (value) => setState(() => _liquidityNeed = value),
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
              subtitle: const Text("当前只保存偏好；推荐 V4 会在外部情报可用时读取。"),
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
                  : (value) =>
                      setState(() => _allowInstitutionalSignals = value),
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
  late var _goal = _initialAnswers["goal"] ?? "retirement";
  late var _horizon = _initialAnswers["horizon"] ?? "medium";
  late var _volatility = _initialAnswers["volatility"] ?? "medium";
  late var _priority = _initialAnswers["priority"] ?? "balanced";
  late var _cashNeed = _initialAnswers["cashNeed"] ?? "medium";
  late var _sectorTilt = _initialAnswers["sectorTilt"] ?? "broad";
  late var _homePlan = _initialAnswers["homePlan"] ?? "none";
  late var _taxFocus = _initialAnswers["taxFocus"] ?? "medium";
  late var _usdFundingPath = _initialAnswers["usdFundingPath"] ?? "unknown";
  late var _concentrationTolerance =
      _initialAnswers["concentrationTolerance"] ?? "medium";
  late var _allowExternalSignals =
      _initialAnswers["allowExternalSignals"] == "true";
  final _pageController = PageController();
  final _narrativeController = TextEditingController();
  var _guidePage = 0;
  MobilePreferenceFactors? _ministerFactors;
  String? _ministerSummary;
  List<String> _ministerRationale = const [];
  var _saving = false;
  var _drafting = false;
  String? _error;

  late final MobileGuidedDraft _initialDraft =
      MobileGuidedDraft.fromProfile(widget.profile);
  late final Map<String, String> _initialAnswers = _initialDraft.answers;

  MobileGuidedDraft get _draft => MobileGuidedDraft.fromAnswers(
        goal: _goal,
        horizon: _horizon,
        volatility: _volatility,
        priority: _priority,
        cashNeed: _cashNeed,
        sectorTilt: _sectorTilt,
        homePlan: _homePlan,
        taxFocus: _taxFocus,
        usdFundingPath: _usdFundingPath,
        concentrationTolerance: _concentrationTolerance,
        allowExternalSignals: _allowExternalSignals,
      );

  @override
  void dispose() {
    _pageController.dispose();
    _narrativeController.dispose();
    super.dispose();
  }

  MobilePreferenceFactors _effectiveFactors(MobileGuidedDraft draft) {
    return _ministerFactors ?? draft.preferenceFactors;
  }

  String _composeMinisterNarrative(MobileGuidedDraft draft) {
    final userText = _narrativeController.text.trim();
    return [
      "请根据以下新手问答，为 Preference Factors V2 生成完整草稿。",
      "目标: $_goal",
      "期限: $_horizon",
      "波动承受: $_volatility",
      "推荐优先级: $_priority",
      "现金需求: $_cashNeed",
      "行业/风格倾向: $_sectorTilt",
      "买房计划: $_homePlan",
      "税务关注: $_taxFocus",
      "USD 入金路径: $_usdFundingPath",
      "集中度承受: $_concentrationTolerance",
      "允许外部信息: $_allowExternalSignals",
      "当前本地草稿: ${draft.preferenceFactors.toPayload()}",
      if (userText.isNotEmpty) "用户补充: $userText",
    ].join("\n");
  }

  Future<void> _askMinisterForFullDraft() async {
    final draft = _draft;
    setState(() {
      _drafting = true;
      _error = null;
      _ministerSummary = null;
      _ministerRationale = const [];
    });

    try {
      final response = await widget.apiClient.createPreferenceFactorsDraft({
        "narrative": _composeMinisterNarrative(draft),
        "currentPreferenceFactors": draft.preferenceFactors.toPayload(),
      });
      final data = response["data"];
      if (data is! Map<String, dynamic>) {
        throw const LooApiException("大臣草稿格式不正确。");
      }
      final factors =
          MobilePreferenceFactors.fromJson(data["preferenceFactors"]);
      if (mounted) {
        setState(() {
          _ministerFactors = factors;
          _ministerSummary = data["summary"] as String? ?? "大臣已补全进阶参数。";
          _ministerRationale =
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

  Future<void> _apply() async {
    final draft = _draft;
    final factors = _effectiveFactors(draft);
    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await widget.apiClient.saveGuidedPreferenceDraft(draft.toDraftPayload());
      await widget.apiClient.updateInvestmentPreferences({
        ...draft.suggestedProfilePayload,
        "preferenceFactors": factors.toPayload(),
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
    final factors = _effectiveFactors(draft);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, bottomInset + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Loo皇定国策", style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text("第 ${_guidePage + 1}/5 阶段 · 回答后横滑进入下一段，最后确认国策比例。"),
            const SizedBox(height: 10),
            LinearProgressIndicator(value: (_guidePage + 1) / 5),
            const SizedBox(height: 16),
            SizedBox(
              height: 500,
              child: PageView(
                controller: _pageController,
                onPageChanged: (page) => setState(() => _guidePage = page),
                children: [
                  _GuidedStageCard(
                    title: "一、国库期限",
                    subtitle: "先判断这笔钱能不能长期留在战场。",
                    children: [
                      _GuidedSelect(
                        label: "目标",
                        value: _goal,
                        items: const {
                          "retirement": "退休长期积累",
                          "home": "买房/首套房",
                          "wealth": "财富增长",
                          "capital-preservation": "本金保护",
                        },
                        onChanged: _saving || _drafting
                            ? null
                            : (value) => setState(() {
                                  _goal = value;
                                  _ministerFactors = null;
                                }),
                      ),
                      _GuidedSelect(
                        label: "投资期限",
                        value: _horizon,
                        items: const {
                          "short": "3 年内可能要用",
                          "medium": "3-7 年",
                          "long": "7 年以上",
                        },
                        onChanged: _saving || _drafting
                            ? null
                            : (value) => setState(() {
                                  _horizon = value;
                                  _ministerFactors = null;
                                }),
                      ),
                      _GuidedSelect(
                        label: "买房计划",
                        value: _homePlan,
                        items: const {
                          "none": "暂时没有",
                          "possible": "未来可能买房",
                          "active": "已有明确首付目标",
                        },
                        onChanged: _saving || _drafting
                            ? null
                            : (value) => setState(() {
                                  _homePlan = value;
                                  _ministerFactors = null;
                                }),
                      ),
                    ],
                  ),
                  _GuidedStageCard(
                    title: "二、回撤承受",
                    subtitle: "高风险不是口号，要先确认跌下来会不会乱阵脚。",
                    children: [
                      _GuidedSelect(
                        label: "最大波动承受",
                        value: _volatility,
                        items: const {
                          "low": "跌 10-15% 就会难受",
                          "medium": "能承受 20-30%",
                          "high": "能承受 35% 左右",
                          "very_high": "50% 回撤也能按纪律持有",
                        },
                        onChanged: _saving || _drafting
                            ? null
                            : (value) => setState(() {
                                  _volatility = value;
                                  _ministerFactors = null;
                                }),
                      ),
                      _GuidedSelect(
                        label: "现金需求",
                        value: _cashNeed,
                        items: const {
                          "low": "现金需求低",
                          "medium": "保留常规缓冲",
                          "high": "近期需要高现金水位",
                        },
                        onChanged: _saving || _drafting
                            ? null
                            : (value) => setState(() {
                                  _cashNeed = value;
                                  _ministerFactors = null;
                                }),
                      ),
                    ],
                  ),
                  _GuidedStageCard(
                    title: "三、进攻方向",
                    subtitle: "这里决定是全球成长，还是明确偏纳指/科技进攻。",
                    children: [
                      _GuidedSelect(
                        label: "行业/风格倾向",
                        value: _sectorTilt,
                        items: const {
                          "broad": "保持宽分散",
                          "nasdaq-tech": "偏纳指/科技/AI",
                          "tech-energy": "偏科技/能源成长",
                          "dividend-quality": "偏分红/质量",
                          "canada-home": "偏加拿大/买房相关",
                        },
                        onChanged: _saving || _drafting
                            ? null
                            : (value) => setState(() {
                                  _sectorTilt = value;
                                  _ministerFactors = null;
                                }),
                      ),
                      _GuidedSelect(
                        label: "集中度承受",
                        value: _concentrationTolerance,
                        items: const {
                          "low": "单一标的要严格分散",
                          "medium": "允许核心 ETF 稍重",
                          "high": "可接受纳指/科技明显超配",
                        },
                        onChanged: _saving || _drafting
                            ? null
                            : (value) => setState(() {
                                  _concentrationTolerance = value;
                                  _ministerFactors = null;
                                }),
                      ),
                    ],
                  ),
                  _GuidedStageCard(
                    title: "四、账户路线",
                    subtitle: "同一标的放进不同账户，长期效果可能不一样。",
                    children: [
                      _GuidedSelect(
                        label: "推荐优先级",
                        value: _priority,
                        items: const {
                          "tax-efficiency": "税务优先",
                          "balanced": "平衡",
                          "stay-close": "贴近现状",
                        },
                        onChanged: _saving || _drafting
                            ? null
                            : (value) => setState(() {
                                  _priority = value;
                                  _ministerFactors = null;
                                }),
                      ),
                      _GuidedSelect(
                        label: "税务优化关注",
                        value: _taxFocus,
                        items: const {"low": "低", "medium": "中", "high": "高"},
                        onChanged: _saving || _drafting
                            ? null
                            : (value) => setState(() {
                                  _taxFocus = value;
                                  _ministerFactors = null;
                                }),
                      ),
                      _GuidedSelect(
                        label: "USD 入金/换汇路径",
                        value: _usdFundingPath,
                        items: const {
                          "unknown": "还不确定",
                          "available": "可稳定使用",
                          "avoid": "尽量避免",
                        },
                        onChanged: _saving || _drafting
                            ? null
                            : (value) => setState(() {
                                  _usdFundingPath = value;
                                  _ministerFactors = null;
                                }),
                      ),
                    ],
                  ),
                  _GuidedStageCard(
                    title: "五、确认国策",
                    subtitle: "保存前先看清楚比例和护栏；这是之后推荐 V4 的目标地图。",
                    children: [
                      Text(draft.summary),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _InfoChip("风险档位", draft.riskLabel),
                          _InfoChip("再平衡阈值", "${draft.rebalancingTolerancePct}%"),
                          _InfoChip("现金缓冲",
                              "\$${draft.cashBufferTargetCad.toStringAsFixed(0)}"),
                          _InfoChip("税务放置", draft.taxAwarePlacement ? "开启" : "关闭"),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text("进阶偏好：${factors.summary}"),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text("允许外部信息辅助推荐"),
                        value: _allowExternalSignals,
                        onChanged: _saving || _drafting
                            ? null
                            : (value) => setState(() {
                                  _allowExternalSignals = value;
                                  _ministerFactors = null;
                                }),
                      ),
                      TextField(
                        controller: _narrativeController,
                        enabled: !_saving && !_drafting,
                        minLines: 2,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: "补充说明 可选",
                        ),
                      ),
                      const SizedBox(height: 10),
                      OutlinedButton.icon(
                        onPressed: _saving || _drafting
                            ? null
                            : _askMinisterForFullDraft,
                        icon: const Icon(Icons.auto_awesome),
                        label: Text(_drafting ? "大臣补全中..." : "请大臣补全进阶参数"),
                      ),
                      if (_ministerSummary != null) ...[
                        const SizedBox(height: 8),
                        Text("大臣补全：$_ministerSummary"),
                        ..._ministerRationale
                            .take(2)
                            .map((item) => Text("• $item")),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _guidePage <= 0
                        ? null
                        : () => _pageController.previousPage(
                              duration: const Duration(milliseconds: 260),
                              curve: Curves.easeOutCubic,
                            ),
                    child: const Text("上一步"),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: _guidePage >= 4
                        ? (_saving ? null : _apply)
                        : () => _pageController.nextPage(
                              duration: const Duration(milliseconds: 260),
                              curve: Curves.easeOutCubic,
                            ),
                    child: Text(_guidePage >= 4
                        ? (_saving ? "应用中..." : "应用国策")
                        : "下一步"),
                  ),
                ),
              ],
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

class _GuidedStageCard extends StatelessWidget {
  const _GuidedStageCard({
    required this.title,
    required this.subtitle,
    required this.children,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 220),
      child: Card(
        key: ValueKey(title),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 6),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: 16),
                ...children,
              ],
            ),
          ),
        ),
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
                  ButtonSegment(value: "Aggressive", label: Text("进攻")),
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

class _RegisteredRoomSummaryCard extends StatelessWidget {
  const _RegisteredRoomSummaryCard({
    required this.registeredRooms,
    required this.onEdit,
  });

  final MobileRegisteredRooms registeredRooms;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  "注册额度 · ${registeredRooms.taxYear}",
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              TextButton(
                onPressed: onEdit,
                child: const Text("编辑"),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            "按账户类别共享，多个 TFSA/RRSP/FHSA 账户不会重复计算。",
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final room in registeredRooms.rooms)
                _InfoChip(room.accountType, room.value),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            "来源：${registeredRooms.sourceLabel}",
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _RegisteredRoomEditorSheet extends StatefulWidget {
  const _RegisteredRoomEditorSheet({
    required this.apiClient,
    required this.registeredRooms,
  });

  final LooApiClient apiClient;
  final MobileRegisteredRooms registeredRooms;

  @override
  State<_RegisteredRoomEditorSheet> createState() =>
      _RegisteredRoomEditorSheetState();
}

class _RegisteredRoomEditorSheetState
    extends State<_RegisteredRoomEditorSheet> {
  late final _taxYearController =
      TextEditingController(text: widget.registeredRooms.taxYear.toString());
  late final Map<String, TextEditingController> _roomControllers = {
    for (final type in const ["TFSA", "RRSP", "FHSA"])
      type: TextEditingController(text: _initialRoom(type).toStringAsFixed(0)),
  };
  var _saving = false;
  String? _error;

  double _initialRoom(String accountType) {
    return widget.registeredRooms.rooms
        .firstWhere(
          (room) => room.accountType == accountType,
          orElse: () => MobileRegisteredRoom(
            accountType: accountType,
            remainingRoomCad: 0,
            label: accountType,
            value: "\$0",
            note: null,
          ),
        )
        .remainingRoomCad;
  }

  @override
  void dispose() {
    _taxYearController.dispose();
    for (final controller in _roomControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.apiClient.updateRegisteredRooms({
        "taxYear":
            int.tryParse(_taxYearController.text.trim()) ?? DateTime.now().year,
        "rooms": [
          for (final entry in _roomControllers.entries)
            {
              "accountType": entry.key,
              "remainingRoomCad": double.tryParse(entry.value.text.trim()) ?? 0,
            },
        ],
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
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("注册额度", style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(
                "这里是 TFSA/RRSP/FHSA 按类别共享的剩余额度，不属于任何单个券商账户。",
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _taxYearController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: "税务年度",
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              for (final entry in _roomControllers.entries) ...[
                TextField(
                  controller: entry.value,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: "${entry.key} 剩余额度 CAD",
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (_error != null) ...[
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
                const SizedBox(height: 10),
              ],
              FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_outlined),
                label: Text(_saving ? "保存中…" : "保存注册额度"),
              ),
            ],
          ),
        ),
      ),
    );
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
