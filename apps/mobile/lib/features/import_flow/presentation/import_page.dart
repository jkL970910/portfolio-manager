import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../shared/data/mobile_models.dart";

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
                          onTap: action.title == "添加账户"
                              ? _openCreateAccountSheet
                              : null,
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
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _CreateAccountSheet(apiClient: widget.apiClient),
    );
    if (created == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("账户已加入 Loo国账本")),
      );
      _refresh();
    }
  }
}

class MobileImportSnapshot {
  const MobileImportSnapshot({
    required this.manualSteps,
    required this.actionCards,
    required this.accounts,
    required this.notes,
  });

  final List<MobileImportStep> manualSteps;
  final List<MobileImportAction> actionCards;
  final List<MobileImportAccount> accounts;
  final List<String> notes;

  factory MobileImportSnapshot.fromJson(Map<String, dynamic> json) {
    return MobileImportSnapshot(
      manualSteps: readJsonList(json, "manualSteps")
          .map(MobileImportStep.fromJson)
          .toList(),
      actionCards: readJsonList(json, "actionCards")
          .map(MobileImportAction.fromJson)
          .toList(),
      accounts: readJsonList(json, "existingAccounts")
          .map(MobileImportAccount.fromJson)
          .toList(),
      notes: (json["notes"] as List?)?.whereType<String>().toList() ?? const [],
    );
  }
}

class MobileImportStep {
  const MobileImportStep({
    required this.title,
    required this.description,
  });

  final String title;
  final String description;

  factory MobileImportStep.fromJson(Map<String, dynamic> json) {
    return MobileImportStep(
      title: json["title"] as String? ?? "导入步骤",
      description: json["description"] as String? ?? "",
    );
  }
}

class MobileImportAction {
  const MobileImportAction({
    required this.label,
    required this.title,
    required this.description,
  });

  final String label;
  final String title;
  final String description;

  factory MobileImportAction.fromJson(Map<String, dynamic> json) {
    return MobileImportAction(
      label: json["label"] as String? ?? "入口",
      title: json["title"] as String? ?? "手动导入",
      description: json["description"] as String? ?? "",
    );
  }
}

class MobileImportAccount {
  const MobileImportAccount({
    required this.id,
    required this.displayName,
    required this.value,
    required this.detail,
  });

  final String id;
  final String displayName;
  final String value;
  final String detail;

  factory MobileImportAccount.fromJson(Map<String, dynamic> json) {
    return MobileImportAccount(
      id: json["id"] as String? ?? "",
      displayName: json["displayName"] as String? ??
          json["nickname"] as String? ??
          "未知账户",
      value: json["value"] as String? ?? "--",
      detail: json["detail"] as String? ?? "",
    );
  }
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
      await widget.apiClient.createManualAccount(
        accountType: _accountType,
        institution: _institutionController.text.trim(),
        nickname: _nicknameController.text.trim(),
        currency: _currency,
        contributionRoomCad: double.tryParse(_roomController.text.trim()) ?? 0,
        initialMarketValueAmount:
            double.tryParse(_marketValueController.text.trim()) ?? 0,
      );
      if (mounted) {
        Navigator.of(context).pop(true);
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
