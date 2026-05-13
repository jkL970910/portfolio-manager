import "package:flutter/material.dart";

import "../../../core/platform/external_link_stub.dart"
    if (dart.library.html) "../../../core/platform/external_link_web.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../data/daily_intelligence_models.dart";

class DailyIntelligenceCard extends StatelessWidget {
  const DailyIntelligenceCard({
    required this.snapshot,
    required this.isLoading,
    this.errorMessage,
    this.onViewSecurity,
    this.compactCarousel = false,
    super.key,
  });

  final MobileDailyIntelligenceSnapshot? snapshot;
  final bool isLoading;
  final String? errorMessage;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;
  final bool compactCarousel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final items = snapshot?.items ?? const <MobileDailyIntelligenceItem>[];
    if (compactCarousel) {
      return _DailyIntelligenceCarousel(
        snapshot: snapshot,
        isLoading: isLoading,
        errorMessage: errorMessage,
        onViewSecurity: onViewSecurity,
      );
    }

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
            const SizedBox(height: 12),
            if (errorMessage != null)
              _DailyEmptyState(
                title: "今日秘闻暂不可用",
                detail: errorMessage!,
              )
            else if (isLoading && snapshot == null)
              const Text("正在整理已保存资料...")
            else if (items.isEmpty)
              _DailyEmptyState(
                title: snapshot?.emptyTitle ?? "暂时没有可用秘闻",
                detail: snapshot?.emptyDetail ?? "先在标的详情运行智能快扫，或手动刷新标的资料。",
              )
            else
              _DailyIntelligenceDropdownList(
                items: items,
                onViewSecurity: onViewSecurity,
              ),
          ],
        ),
      ),
    );
  }
}

class _DailyIntelligenceCarousel extends StatefulWidget {
  const _DailyIntelligenceCarousel({
    required this.snapshot,
    required this.isLoading,
    required this.errorMessage,
    required this.onViewSecurity,
  });

  final MobileDailyIntelligenceSnapshot? snapshot;
  final bool isLoading;
  final String? errorMessage;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;

  @override
  State<_DailyIntelligenceCarousel> createState() =>
      _DailyIntelligenceCarouselState();
}

class _DailyIntelligenceCarouselState
    extends State<_DailyIntelligenceCarousel> {
  late final PageController _controller;
  var _page = 0;
  final Set<String> _expandedItemIds = <String>{};

  @override
  void initState() {
    super.initState();
    _controller = PageController();
  }

  @override
  void didUpdateWidget(covariant _DailyIntelligenceCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    final count = widget.snapshot?.items.length ?? 0;
    if (_page >= count && count > 0) {
      _page = count - 1;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final items =
        widget.snapshot?.items ?? const <MobileDailyIntelligenceItem>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                "Loo国今日秘闻",
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            if (widget.isLoading)
              const SizedBox(
                height: 18,
                width: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
          ],
        ),
        const SizedBox(height: 10),
        if (widget.errorMessage != null)
          LooStatePanel(title: "今日秘闻暂不可用", message: widget.errorMessage!)
        else if (widget.isLoading && widget.snapshot == null)
          const LooGlassCard(child: Text("正在整理今日秘闻..."))
        else if (items.isEmpty)
          LooStatePanel(
            title: widget.snapshot?.emptyTitle ?? "暂时没有可用秘闻",
            message: widget.snapshot?.emptyDetail ?? "暂无已整理资料。",
          )
        else
          LooGlassCard(
            padding: const EdgeInsets.all(10),
            child: _DailyIntelligenceCarouselPager(
              items: items,
              onViewSecurity: widget.onViewSecurity,
              page: _page,
              expandedItemIds: _expandedItemIds,
              controller: _controller,
              onPageChanged: (value) => setState(() => _page = value),
              onExpansionChanged: (item, isExpanded) {
                setState(() {
                  if (isExpanded) {
                    _expandedItemIds.add(item.id);
                  } else {
                    _expandedItemIds.remove(item.id);
                  }
                });
              },
            ),
          ),
      ],
    );
  }
}

class _DailyIntelligenceCarouselPager extends StatelessWidget {
  const _DailyIntelligenceCarouselPager({
    required this.items,
    required this.onViewSecurity,
    required this.page,
    required this.expandedItemIds,
    required this.controller,
    required this.onPageChanged,
    required this.onExpansionChanged,
  });

  final List<MobileDailyIntelligenceItem> items;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;
  final int page;
  final Set<String> expandedItemIds;
  final PageController controller;
  final ValueChanged<int> onPageChanged;
  final void Function(MobileDailyIntelligenceItem item, bool isExpanded)
      onExpansionChanged;

  @override
  Widget build(BuildContext context) {
    final activeIndex = page.clamp(0, items.length - 1);
    final activeItem = items[activeIndex];
    final activeExpanded = expandedItemIds.contains(activeItem.id);
    final pageHeight = activeExpanded
        ? _expandedPageHeight(activeItem)
        : _previewPageHeight(activeItem);
    return Column(
      children: [
        AnimatedSize(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
          alignment: Alignment.topCenter,
          child: SizedBox(
            height: pageHeight,
            child: PageView.builder(
              controller: controller,
              onPageChanged: onPageChanged,
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: _DailyIntelligenceDropdownTile(
                      item,
                      initiallyExpanded: expandedItemIds.contains(item.id),
                      onExpansionChanged: (isExpanded) =>
                          onExpansionChanged(item, isExpanded),
                      onViewSecurity:
                          item.canOpenSecurity ? onViewSecurity : null,
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        if (items.length > 1) ...[
          const SizedBox(height: 10),
          _DailyCarouselDots(
            count: items.length,
            activeIndex: page.clamp(0, items.length - 1),
          ),
        ],
      ],
    );
  }

  double _previewPageHeight(MobileDailyIntelligenceItem item) {
    final titleLines = (item.cleanedTitle.length / 16).ceil().clamp(1, 3);
    final summaryLines = (item.summary.length / 24).ceil().clamp(2, 4);
    return (188 + (titleLines - 1) * 24 + (summaryLines - 2) * 21)
        .toDouble();
  }

  double _expandedPageHeight(MobileDailyIntelligenceItem item) {
    final titleLines = (item.cleanedTitle.length / 16).ceil().clamp(1, 4);
    final summaryLines = (item.summary.length / 22).ceil().clamp(3, 14);
    final pointLines = item.keyPoints.take(5).fold<int>(
          0,
          (sum, point) => sum + (point.length / 28).ceil().clamp(1, 4),
        );
    final riskLines = item.visibleRiskFlags.take(3).fold<int>(
          0,
          (sum, risk) => sum + (risk.length / 28).ceil().clamp(1, 3),
        );
    final estimated =
        178 + titleLines * 25 + summaryLines * 22 + pointLines * 24 + riskLines * 24;
    return estimated.clamp(470, 820).toDouble();
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
    final countLabel = items.isEmpty ? "暂无组合秘闻" : "${items.length} 条已保存秘闻";

    return Card(
      child: ExpansionTile(
        leading: const Icon(Icons.auto_awesome_outlined),
        title: Text("Loo国今日秘闻", style: theme.textTheme.titleLarge),
        subtitle: Text(
          errorMessage != null
              ? "暂不可用"
              : isLoading
                  ? "正在整理已保存资料..."
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
          if (errorMessage != null)
            _DailyEmptyState(
              title: "今日秘闻暂不可用",
              detail: errorMessage!,
            )
          else if (items.isEmpty)
            _DailyEmptyState(
              title: snapshot?.emptyTitle ?? "暂时没有可用秘闻",
              detail: snapshot?.emptyDetail ?? "先在标的详情运行智能快扫，或手动刷新标的资料。",
            )
          else
            _DailyIntelligenceDropdownList(
              items: items,
              onViewSecurity: onViewSecurity,
            ),
        ],
      ),
    );
  }
}

class _DailyIntelligenceDropdownList extends StatelessWidget {
  const _DailyIntelligenceDropdownList({
    required this.items,
    required this.onViewSecurity,
  });

  final List<MobileDailyIntelligenceItem> items;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var index = 0; index < items.length; index++) ...[
          _DailyIntelligenceDropdownTile(
            items[index],
            initiallyExpanded: index == 0,
            onExpansionChanged: (_) {},
            onViewSecurity:
                items[index].canOpenSecurity ? onViewSecurity : null,
          ),
          if (index != items.length - 1) const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _DailyIntelligenceDropdownTile extends StatelessWidget {
  const _DailyIntelligenceDropdownTile(
    this.item, {
    required this.initiallyExpanded,
    required this.onExpansionChanged,
    required this.onViewSecurity,
  });

  final MobileDailyIntelligenceItem item;
  final bool initiallyExpanded;
  final ValueChanged<bool> onExpansionChanged;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color:
            theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.32),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item.cleanedTitle,
              maxLines: initiallyExpanded ? 4 : 3,
              overflow: TextOverflow.ellipsis,
              style: (initiallyExpanded
                      ? theme.textTheme.titleLarge
                      : theme.textTheme.headlineSmall)
                  ?.copyWith(
                fontWeight: FontWeight.w900,
                height: 1.08,
              ),
            ),
            if (item.subtitleLabel.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                item.subtitleLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
            const SizedBox(height: 10),
            Text(
              item.summary,
              maxLines: initiallyExpanded ? null : 4,
              overflow:
                  initiallyExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
              style: theme.textTheme.bodyMedium?.copyWith(
                height: 1.35,
              ),
            ),
            if (!initiallyExpanded) ...[
              const SizedBox(height: 12),
              _DailyKeywordWrap(item),
            ],
            if (initiallyExpanded) ...[
              if (item.keyPoints.isNotEmpty) ...[
                const SizedBox(height: 8),
                ...item.keyPoints.take(4).map(
                      (point) => _DailyBullet(point),
                    ),
              ],
              if (item.visibleRiskFlags.isNotEmpty) ...[
                const SizedBox(height: 8),
                ...item.visibleRiskFlags.take(2).map(
                      (risk) => _DailyBullet(
                        "注意：$risk",
                        color: theme.colorScheme.error,
                      ),
                    ),
              ],
              if (item.primarySourceUrl.isNotEmpty) ...[
                const SizedBox(height: 10),
                SelectableText(
                  item.primarySourceUrl,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.primary,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ],
            ],
            const Spacer(),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextButton.icon(
                    onPressed: () => onExpansionChanged(!initiallyExpanded),
                    icon: Icon(
                      initiallyExpanded
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      size: 18,
                    ),
                    label: Text(initiallyExpanded ? "收起" : "展开阅读"),
                  ),
                ),
                if (initiallyExpanded && item.primarySourceUrl.isNotEmpty)
                  TextButton.icon(
                    onPressed: () => openExternalLink(item.primarySourceUrl),
                    icon: const Icon(Icons.open_in_new, size: 16),
                    label: const Text("查看原文"),
                  ),
                if (initiallyExpanded && onViewSecurity != null)
                  TextButton.icon(
                    onPressed: () => onViewSecurity!(item),
                    icon: const Icon(Icons.chevron_right, size: 18),
                    label: const Text("标的"),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DailyKeywordWrap extends StatelessWidget {
  const _DailyKeywordWrap(this.item);

  final MobileDailyIntelligenceItem item;

  @override
  Widget build(BuildContext context) {
    final candidates = <String>[
      ...item.keyPoints,
      item.reason,
      item.relevanceLabel,
      item.confidenceLabel,
    ]
        .map(_normalizeKeyword)
        .where((value) => value.isNotEmpty)
        .toSet()
        .take(4)
        .toList();
    if (candidates.isEmpty) {
      return const SizedBox.shrink();
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final keyword in candidates) _DailyKeywordChip(keyword),
      ],
    );
  }

  static String _normalizeKeyword(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return "";
    }
    final separators = ["：", ":", "。", ".", "，", ","];
    var normalized = trimmed;
    for (final separator in separators) {
      final index = normalized.indexOf(separator);
      if (index > 0) {
        normalized = normalized.substring(0, index);
        break;
      }
    }
    normalized = normalized.replaceAll(RegExp(r"\s+"), " ").trim();
    if (normalized.length > 18) {
      normalized = "${normalized.substring(0, 18)}...";
    }
    return normalized;
  }
}

class _DailyKeywordChip extends StatelessWidget {
  const _DailyKeywordChip(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: theme.colorScheme.primary.withValues(alpha: 0.34),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          label,
          style: theme.textTheme.labelMedium?.copyWith(
            color: theme.colorScheme.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _DailyCarouselDots extends StatelessWidget {
  const _DailyCarouselDots({
    required this.count,
    required this.activeIndex,
  });

  final int count;
  final int activeIndex;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (index) {
        final isActive = index == activeIndex;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: isActive ? 28 : 9,
          height: 9,
          decoration: BoxDecoration(
            color: isActive ? tokens.accent : tokens.cardBorder,
            borderRadius: BorderRadius.circular(999),
          ),
        );
      }),
    );
  }
}

class _DailyBullet extends StatelessWidget {
  const _DailyBullet(this.text, {this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("· ", style: theme.textTheme.bodySmall?.copyWith(color: color)),
          Expanded(
            child: Text(
              text,
              style: theme.textTheme.bodySmall?.copyWith(color: color),
            ),
          ),
        ],
      ),
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
