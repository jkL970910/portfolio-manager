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
                      ...snapshot.data!.actionCards.map(_ActionCard.new),
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
  const _ActionCard(this.action);

  final MobileImportAction action;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
            child: Text(
                action.label.isEmpty ? "入" : action.label.substring(0, 1))),
        title: Text(action.title),
        subtitle: Text(action.description),
        trailing: const Icon(Icons.chevron_right),
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
