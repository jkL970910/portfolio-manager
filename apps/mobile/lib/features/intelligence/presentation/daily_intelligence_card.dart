import "package:flutter/material.dart";

import "../../../core/platform/external_link_stub.dart"
    if (dart.library.html) "../../../core/platform/external_link_web.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../data/daily_intelligence_models.dart";

typedef DailyIntelligenceAiSummaryLoader
    = Future<MobileDailyIntelligenceAiSummary> Function(
        MobileDailyIntelligenceItem item);

class DailyIntelligenceCard extends StatelessWidget {
  const DailyIntelligenceCard({
    required this.snapshot,
    required this.isLoading,
    this.errorMessage,
    this.onViewSecurity,
    this.onGenerateAiSummary,
    this.compactCarousel = false,
    super.key,
  });

  final MobileDailyIntelligenceSnapshot? snapshot;
  final bool isLoading;
  final String? errorMessage;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;
  final DailyIntelligenceAiSummaryLoader? onGenerateAiSummary;
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
        onGenerateAiSummary: onGenerateAiSummary,
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
                onGenerateAiSummary: onGenerateAiSummary,
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
    required this.onGenerateAiSummary,
  });

  final MobileDailyIntelligenceSnapshot? snapshot;
  final bool isLoading;
  final String? errorMessage;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;
  final DailyIntelligenceAiSummaryLoader? onGenerateAiSummary;

  @override
  State<_DailyIntelligenceCarousel> createState() =>
      _DailyIntelligenceCarouselState();
}

class _DailyIntelligenceCarouselState
    extends State<_DailyIntelligenceCarousel> {
  late final PageController _controller;
  var _page = 0;
  final Set<String> _expandedItemIds = <String>{};
  final Map<String, MobileDailyIntelligenceAiSummary> _aiSummaries =
      <String, MobileDailyIntelligenceAiSummary>{};
  final Set<String> _loadingAiSummaryIds = <String>{};
  final Map<String, String> _aiSummaryErrors = <String, String>{};

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
              aiSummaries: _aiSummaries,
              loadingAiSummaryIds: _loadingAiSummaryIds,
              aiSummaryErrors: _aiSummaryErrors,
              onGenerateAiSummary: widget.onGenerateAiSummary == null
                  ? null
                  : _generateAiSummary,
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

  Future<void> _generateAiSummary(MobileDailyIntelligenceItem item) async {
    final loader = widget.onGenerateAiSummary;
    if (loader == null || _loadingAiSummaryIds.contains(item.id)) {
      return;
    }
    setState(() {
      _loadingAiSummaryIds.add(item.id);
      _aiSummaryErrors.remove(item.id);
    });
    try {
      final summary = await loader(item);
      if (!mounted) return;
      setState(() {
        _aiSummaries[item.id] = summary;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _aiSummaryErrors[item.id] = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() => _loadingAiSummaryIds.remove(item.id));
      }
    }
  }
}

class _DailyIntelligenceCarouselPager extends StatelessWidget {
  const _DailyIntelligenceCarouselPager({
    required this.items,
    required this.onViewSecurity,
    required this.page,
    required this.expandedItemIds,
    required this.controller,
    required this.aiSummaries,
    required this.loadingAiSummaryIds,
    required this.aiSummaryErrors,
    required this.onGenerateAiSummary,
    required this.onPageChanged,
    required this.onExpansionChanged,
  });

  final List<MobileDailyIntelligenceItem> items;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;
  final int page;
  final Set<String> expandedItemIds;
  final PageController controller;
  final Map<String, MobileDailyIntelligenceAiSummary> aiSummaries;
  final Set<String> loadingAiSummaryIds;
  final Map<String, String> aiSummaryErrors;
  final ValueChanged<MobileDailyIntelligenceItem>? onGenerateAiSummary;
  final ValueChanged<int> onPageChanged;
  final void Function(MobileDailyIntelligenceItem item, bool isExpanded)
      onExpansionChanged;

  @override
  Widget build(BuildContext context) {
    final activeIndex = page.clamp(0, items.length - 1);
    final activeItem = items[activeIndex];
    final activeExpanded = expandedItemIds.contains(activeItem.id);
    final pageHeight = activeExpanded
        ? _expandedPageHeight(context)
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
                      maxContentHeight:
                          expandedItemIds.contains(item.id) ? pageHeight : null,
                      onExpansionChanged: (isExpanded) =>
                          onExpansionChanged(item, isExpanded),
                      onViewSecurity:
                          item.canOpenSecurity ? onViewSecurity : null,
                      aiSummary: aiSummaries[item.id],
                      isLoadingAiSummary: loadingAiSummaryIds.contains(item.id),
                      aiSummaryError: aiSummaryErrors[item.id],
                      onGenerateAiSummary: onGenerateAiSummary == null
                          ? null
                          : () => onGenerateAiSummary!(item),
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
    final keywordRows = _previewKeywordCount(item) > 3 ? 2 : 1;
    return (268 +
            (titleLines - 1) * 28 +
            (summaryLines - 2) * 22 +
            (keywordRows - 1) * 34)
        .toDouble();
  }

  int _previewKeywordCount(MobileDailyIntelligenceItem item) {
    return <String>{
      ...item.keyPoints,
      item.reason,
      item.relevanceLabel,
      item.confidenceLabel,
    }.where((value) => value.trim().isNotEmpty).take(4).length;
  }

  double _expandedPageHeight(BuildContext context) {
    final screenHeight = MediaQuery.sizeOf(context).height;
    return (screenHeight * 0.72).clamp(600.0, 760.0);
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
              onGenerateAiSummary: null,
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
    required this.onGenerateAiSummary,
  });

  final List<MobileDailyIntelligenceItem> items;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;
  final DailyIntelligenceAiSummaryLoader? onGenerateAiSummary;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var index = 0; index < items.length; index++) ...[
          _DailyIntelligenceDropdownTile(
            items[index],
            initiallyExpanded: index == 0,
            maxContentHeight: null,
            onExpansionChanged: (_) {},
            onViewSecurity:
                items[index].canOpenSecurity ? onViewSecurity : null,
            aiSummary: null,
            isLoadingAiSummary: false,
            aiSummaryError: null,
            onGenerateAiSummary: onGenerateAiSummary == null
                ? null
                : () => onGenerateAiSummary!(items[index]),
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
    required this.maxContentHeight,
    required this.onExpansionChanged,
    required this.onViewSecurity,
    required this.aiSummary,
    required this.isLoadingAiSummary,
    required this.aiSummaryError,
    required this.onGenerateAiSummary,
  });

  final MobileDailyIntelligenceItem item;
  final bool initiallyExpanded;
  final double? maxContentHeight;
  final ValueChanged<bool> onExpansionChanged;
  final ValueChanged<MobileDailyIntelligenceItem>? onViewSecurity;
  final MobileDailyIntelligenceAiSummary? aiSummary;
  final bool isLoadingAiSummary;
  final String? aiSummaryError;
  final VoidCallback? onGenerateAiSummary;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final content = Padding(
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
            overflow: initiallyExpanded
                ? TextOverflow.visible
                : TextOverflow.ellipsis,
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
            const SizedBox(height: 12),
            _DailyAiSummarySection(
              summary: aiSummary,
              isLoading: isLoadingAiSummary,
              errorMessage: aiSummaryError,
              onGenerate: onGenerateAiSummary,
            ),
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
          const SizedBox(height: 12),
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
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        color:
            theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.32),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: initiallyExpanded && maxContentHeight != null
          ? SizedBox(
              height: maxContentHeight,
              child: Scrollbar(
                thumbVisibility: true,
                child: SingleChildScrollView(
                  padding: EdgeInsets.zero,
                  child: content,
                ),
              ),
            )
          : content,
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

class _DailyAiSummarySection extends StatelessWidget {
  const _DailyAiSummarySection({
    required this.summary,
    required this.isLoading,
    required this.errorMessage,
    required this.onGenerate,
  });

  final MobileDailyIntelligenceAiSummary? summary;
  final bool isLoading;
  final String? errorMessage;
  final VoidCallback? onGenerate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    final summary = this.summary;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.accent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.accent.withValues(alpha: 0.28)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.auto_awesome, size: 16, color: tokens.accent),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    summary?.headline ?? "AI 摘要总结",
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                if (summary?.cached == true)
                  Text(
                    "已生成",
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: tokens.mutedText,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (isLoading)
              const LinearProgressIndicator(minHeight: 3)
            else if (summary == null) ...[
              Text(
                "用你在设置中配置的外部 GPT，总结核心内容、相关领域和可能影响的持仓。",
                style: theme.textTheme.bodySmall?.copyWith(height: 1.35),
              ),
              if (errorMessage != null) ...[
                const SizedBox(height: 6),
                Text(
                  errorMessage!,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.error,
                  ),
                ),
              ],
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton.tonalIcon(
                  onPressed: onGenerate,
                  icon: const Icon(Icons.psychology_alt_outlined, size: 16),
                  label: const Text("生成 AI 总结"),
                ),
              ),
            ] else ...[
              Text(summary.coreSummary,
                  style: theme.textTheme.bodySmall?.copyWith(height: 1.35)),
              if (summary.relatedFields.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final field in summary.relatedFields)
                      _DailyKeywordChip(field),
                  ],
                ),
              ],
              if (summary.affectedHoldings.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text("可能影响的持仓", style: theme.textTheme.labelLarge),
                const SizedBox(height: 4),
                for (final holding in summary.affectedHoldings)
                  _DailyBullet("${holding.symbol}：${holding.reason}"),
              ],
              if (summary.portfolioImpact.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text("组合影响", style: theme.textTheme.labelLarge),
                const SizedBox(height: 4),
                Text(
                  summary.portfolioImpact,
                  style: theme.textTheme.bodySmall?.copyWith(height: 1.35),
                ),
              ],
              if (summary.watchPoints.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text("后续关注", style: theme.textTheme.labelLarge),
                ...summary.watchPoints.map((point) => _DailyBullet(point)),
              ],
            ],
          ],
        ),
      ),
    );
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
