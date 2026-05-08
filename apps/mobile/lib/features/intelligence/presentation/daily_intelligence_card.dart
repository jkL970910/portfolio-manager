import "package:flutter/material.dart";

import "../data/daily_intelligence_models.dart";

class DailyIntelligenceCard extends StatelessWidget {
  const DailyIntelligenceCard({
    required this.snapshot,
    required this.isLoading,
    this.errorMessage,
    this.onViewSecurity,
    super.key,
  });

  final MobileDailyIntelligenceSnapshot? snapshot;
  final bool isLoading;
  final String? errorMessage;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final items = snapshot?.items ?? const <MobileDailyIntelligenceItem>[];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.auto_awesome_outlined),
                const SizedBox(width: 8),
                Expanded(
                  child: Text("Loo国今日秘闻", style: theme.textTheme.titleLarge),
                ),
                if (isLoading)
                  const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
              ],
            ),
            const SizedBox(height: 8),
            Text(
              snapshot?.disclaimer ?? "这里展示已整理好的资料摘要；刷新资料需要你手动确认。",
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            if (errorMessage != null)
              _DailyEmptyState(
                title: "今日秘闻暂不可用",
                detail: errorMessage!,
              )
            else if (isLoading && snapshot == null)
              const Text("正在整理缓存秘闻...")
            else if (items.isEmpty)
              _DailyEmptyState(
                title: snapshot?.emptyTitle ?? "暂时没有可用秘闻",
                detail: snapshot?.emptyDetail ?? "先在标的详情运行智能快扫，或手动触发缓存外部研究。",
              )
            else
              ...items.take(3).map(
                    (item) => _DailyIntelligenceTile(
                      item,
                      onViewSecurity:
                          item.canOpenSecurity ? onViewSecurity : null,
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}

class DailyIntelligenceSummaryCard extends StatelessWidget {
  const DailyIntelligenceSummaryCard({
    required this.snapshot,
    required this.isLoading,
    this.errorMessage,
    this.onViewSecurity,
    super.key,
  });

  final MobileDailyIntelligenceSnapshot? snapshot;
  final bool isLoading;
  final String? errorMessage;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final items = snapshot?.items ?? const <MobileDailyIntelligenceItem>[];
    final countLabel = items.isEmpty ? "暂无组合秘闻" : "${items.length} 条缓存秘闻";

    return Card(
      child: ExpansionTile(
        leading: const Icon(Icons.auto_awesome_outlined),
        title: Text("Loo国今日秘闻", style: theme.textTheme.titleLarge),
        subtitle: Text(
          errorMessage != null
              ? "暂不可用"
              : isLoading
                  ? "正在整理缓存秘闻..."
                  : "$countLabel · 已整理资料摘要",
        ),
        trailing: isLoading
            ? const SizedBox(
                height: 18,
                width: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : null,
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              snapshot?.disclaimer ?? "这里只展示已缓存的 AI/行情研究，不会在页面加载时实时抓新闻或论坛。",
              style: theme.textTheme.bodySmall,
            ),
          ),
          const SizedBox(height: 10),
          if (errorMessage != null)
            _DailyEmptyState(
              title: "今日秘闻暂不可用",
              detail: errorMessage!,
            )
          else if (items.isEmpty)
            _DailyEmptyState(
              title: snapshot?.emptyTitle ?? "暂时没有可用秘闻",
              detail: snapshot?.emptyDetail ?? "先在标的详情运行智能快扫，或手动触发缓存外部研究。",
            )
          else
            ...items.take(2).map(
                  (item) => _DailyIntelligenceTile(
                    item,
                    onViewSecurity:
                        item.canOpenSecurity ? onViewSecurity : null,
                  ),
                ),
        ],
      ),
    );
  }
}

class _DailyIntelligenceTile extends StatelessWidget {
  const _DailyIntelligenceTile(this.item, {required this.onViewSecurity});

  final MobileDailyIntelligenceItem item;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color:
              theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.42),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.title, style: theme.textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(item.summary),
              finalReason(item, theme),
              const SizedBox(height: 10),
              Row(
                children: [
                  _DailyTypePill(item.displayTypeLabel),
                  if (item.compactMetaLabel.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        item.compactMetaLabel,
                        style: theme.textTheme.bodySmall,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
              if (item.keyPoints.isNotEmpty ||
                  item.visibleRiskFlags.isNotEmpty) ...[
                const SizedBox(height: 10),
                ...item.keyPoints.take(2).map(
                      (point) => Text(
                        "· $point",
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                ...item.visibleRiskFlags.take(1).map(
                      (risk) => Text(
                        "注意：$risk",
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.error,
                        ),
                      ),
                    ),
              ],
              if (item.sources.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  "来源：${item.sources.take(1).map((source) => source.label).join("；")}",
                  style: theme.textTheme.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              if (onViewSecurity != null) ...[
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () => onViewSecurity!(item),
                    icon: const Icon(Icons.chevron_right),
                    label: const Text("查看标的"),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget finalReason(MobileDailyIntelligenceItem item, ThemeData theme) {
    if (item.reason.isEmpty) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 6),
        Text(item.reason, style: theme.textTheme.bodySmall),
      ],
    );
  }
}

class _DailyTypePill extends StatelessWidget {
  const _DailyTypePill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    if (label.isEmpty) {
      return const SizedBox.shrink();
    }
    return Chip(
      label: Text(label),
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );
  }
}

class _DailyEmptyState extends StatelessWidget {
  const _DailyEmptyState({required this.title, required this.detail});

  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: 0.36),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 4),
            Text(detail),
          ],
        ),
      ),
    );
  }
}
