import "package:flutter/material.dart";

import "../theme/loo_theme.dart";

Future<T?> showLooFloatingSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool isScrollControlled = true,
  bool useRootNavigator = false,
  EdgeInsetsGeometry? padding,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    useRootNavigator: useRootNavigator,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.42),
    elevation: 0,
    builder: (sheetContext) {
      final media = MediaQuery.of(sheetContext);
      final tokens = sheetContext.looTokens;
      final horizontalInset = media.size.width >= 640 ? 44.0 : 16.0;
      return Padding(
        padding: EdgeInsets.only(
          left: horizontalInset,
          right: horizontalInset,
          bottom: media.viewInsets.bottom + 16,
          top: 16,
        ),
        child: Align(
          alignment: Alignment.bottomCenter,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: 620,
              maxHeight: media.size.height * 0.88,
            ),
            child: LooGlassCard(
              padding: padding ?? EdgeInsets.all(tokens.gapLg),
              child: builder(sheetContext),
            ),
          ),
        ),
      );
    },
  );
}

EdgeInsets looPagePadding(
  BuildContext context, {
  double left = 20,
  double top = 0,
  double right = 20,
  double bottom = 28,
}) {
  final safeBottom = MediaQuery.paddingOf(context).bottom;
  return EdgeInsets.fromLTRB(
    left,
    top,
    right,
    safeBottom > bottom ? safeBottom : bottom,
  );
}

class LooPageGradient extends StatelessWidget {
  const LooPageGradient({
    required this.child,
    super.key,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(gradient: context.looTokens.pageGradient),
      child: child,
    );
  }
}

class LooGlassCard extends StatelessWidget {
  const LooGlassCard({
    required this.child,
    this.margin,
    this.padding,
    this.onTap,
    this.isHero = false,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry? margin;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final bool isHero;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final shape = RoundedRectangleBorder(
      borderRadius:
          BorderRadius.circular(isHero ? tokens.radiusXl : tokens.radiusLg),
      side: BorderSide(color: tokens.cardBorder),
    );
    final content = Ink(
      decoration: BoxDecoration(
        gradient: isHero ? tokens.heroGradient : tokens.cardGradient,
        borderRadius:
            BorderRadius.circular(isHero ? tokens.radiusXl : tokens.radiusLg),
        border: Border.all(color: tokens.cardBorder),
        boxShadow: dark
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.18),
                  blurRadius: isHero ? 28 : 18,
                  offset: const Offset(0, 12),
                ),
              ]
            : const [],
      ),
      child: Padding(
        padding:
            padding ?? EdgeInsets.all(isHero ? tokens.gapXl : tokens.gapLg),
        child: child,
      ),
    );

    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: Material(
        color: Colors.transparent,
        shape: shape,
        child: onTap == null
            ? content
            : InkWell(
                borderRadius: BorderRadius.circular(
                  isHero ? tokens.radiusXl : tokens.radiusLg,
                ),
                onTap: onTap,
                child: content,
              ),
      ),
    );
  }
}

class LooHeroHeader extends StatelessWidget {
  const LooHeroHeader({
    required this.title,
    required this.subtitle,
    this.eyebrow,
    this.trailing,
    super.key,
  });

  final String title;
  final String subtitle;
  final String? eyebrow;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        tokens.gapLg,
        tokens.gapLg,
        tokens.gapLg,
        tokens.gapMd,
      ),
      child: LooGlassCard(
        isHero: true,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (eyebrow != null && eyebrow!.isNotEmpty) ...[
                    Text(
                      eyebrow!,
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: tokens.accent,
                        letterSpacing: 0.8,
                      ),
                    ),
                    SizedBox(height: tokens.gapSm),
                  ],
                  Text(title, style: theme.textTheme.headlineMedium),
                  SizedBox(height: tokens.gapSm),
                  Text(
                    subtitle,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: tokens.mutedText,
                    ),
                  ),
                ],
              ),
            ),
            if (trailing != null) ...[
              SizedBox(width: tokens.gapMd),
              trailing!,
            ],
          ],
        ),
      ),
    );
  }
}

class LooSectionHeader extends StatelessWidget {
  const LooSectionHeader({
    required this.title,
    this.actionLabel,
    this.onAction,
    super.key,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return Row(
      children: [
        Expanded(child: Text(title, style: theme.textTheme.titleLarge)),
        if (actionLabel != null)
          TextButton(
            onPressed: onAction,
            child: Text(
              actionLabel!,
              style:
                  TextStyle(color: onAction == null ? tokens.mutedText : null),
            ),
          ),
      ],
    );
  }
}

class LooMetricCard extends StatelessWidget {
  const LooMetricCard({
    required this.label,
    required this.value,
    this.detail,
    this.icon,
    super.key,
  });

  final String label;
  final String value;
  final String? detail;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return LooGlassCard(
      padding: EdgeInsets.all(tokens.gapMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: tokens.mutedText,
                  ),
                ),
              ),
              if (icon != null) Icon(icon, size: 18, color: tokens.accent),
            ],
          ),
          const Spacer(),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleLarge,
          ),
          if (detail != null && detail!.isNotEmpty) ...[
            SizedBox(height: tokens.gapXs),
            Text(
              detail!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                color: tokens.subtleText,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class LooTappableRow extends StatelessWidget {
  const LooTappableRow({
    required this.title,
    required this.value,
    this.subtitle,
    this.valueDetail,
    this.leading,
    this.onTap,
    this.margin,
    super.key,
  });

  final String title;
  final String value;
  final String? subtitle;
  final String? valueDetail;
  final Widget? leading;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return LooGlassCard(
      margin: margin,
      padding: EdgeInsets.all(tokens.gapMd),
      onTap: onTap,
      child: Row(
        children: [
          if (leading != null) ...[
            leading!,
            SizedBox(width: tokens.gapMd),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium,
                ),
                if (subtitle != null && subtitle!.isNotEmpty) ...[
                  SizedBox(height: tokens.gapXs),
                  Text(
                    subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: tokens.mutedText,
                    ),
                  ),
                ],
              ],
            ),
          ),
          SizedBox(width: tokens.gapMd),
          Flexible(
            flex: 0,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  style: theme.textTheme.titleMedium,
                ),
                if (valueDetail != null && valueDetail!.isNotEmpty) ...[
                  SizedBox(height: tokens.gapXs),
                  Text(
                    valueDetail!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: valueDetail!.trim().startsWith("-")
                          ? tokens.danger
                          : tokens.success,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class LooKeyValueItem {
  const LooKeyValueItem({
    required this.label,
    required this.value,
    this.detail,
  });

  final String label;
  final String value;
  final String? detail;
}

class LooKeyValueTable extends StatelessWidget {
  const LooKeyValueTable({
    required this.items,
    super.key,
  });

  final List<LooKeyValueItem> items;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return Column(
      children: [
        for (var index = 0; index < items.length; index++) ...[
          if (index > 0)
            Divider(height: tokens.gapLg, color: tokens.cardBorder),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  items[index].label,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: tokens.mutedText,
                  ),
                ),
              ),
              SizedBox(width: tokens.gapMd),
              Expanded(
                flex: 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      items[index].value,
                      textAlign: TextAlign.right,
                      style: theme.textTheme.titleSmall,
                    ),
                    if (items[index].detail != null &&
                        items[index].detail!.isNotEmpty) ...[
                      SizedBox(height: tokens.gapXs),
                      Text(
                        items[index].detail!,
                        textAlign: TextAlign.right,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: tokens.subtleText,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class LooStatePanel extends StatelessWidget {
  const LooStatePanel({
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.icon = Icons.auto_awesome_outlined,
    super.key,
  });

  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return Center(
      child: Padding(
        padding: EdgeInsets.all(tokens.gapXl),
        child: LooGlassCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: tokens.accent, size: 34),
              SizedBox(height: tokens.gapMd),
              Text(title, style: theme.textTheme.titleLarge),
              SizedBox(height: tokens.gapSm),
              Text(
                message,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: tokens.mutedText,
                ),
              ),
              if (actionLabel != null && onAction != null) ...[
                SizedBox(height: tokens.gapLg),
                FilledButton(onPressed: onAction, child: Text(actionLabel!)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
