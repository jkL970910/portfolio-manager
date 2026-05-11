import "dart:ui";

import "package:flutter/material.dart";

import "../../../core/theme/loo_theme.dart";

class LooBottomNavItem {
  const LooBottomNavItem({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;
}

class LooBottomNavBar extends StatelessWidget {
  const LooBottomNavBar({
    required this.currentIndex,
    required this.items,
    required this.onChanged,
    super.key,
  });

  final int currentIndex;
  final List<LooBottomNavItem> items;
  final ValueChanged<int> onChanged;

  static const bottomOffset = 18.0;
  static const visualHeight = 60.0;
  static const contentGap = 18.0;

  static double contentInset(BuildContext context) {
    return bottomOffset +
        visualHeight +
        contentGap +
        MediaQuery.paddingOf(context).bottom;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final surface = dark ? const Color(0x661B0C13) : const Color(0xB8FFF7F9);
    final selectedText = dark ? Colors.white : const Color(0xFF3B1425);
    final unselectedText = dark ? Colors.white70 : tokens.mutedText;
    final selectedGradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: dark
          ? const [
              Color(0xB3338D58),
              Color(0xCCC85078),
            ]
          : const [
              Color(0xD9F7A1B9),
              Color(0xE6E45F88),
            ],
    );

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 0),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color: tokens.cardBorder.withValues(alpha: dark ? 0.48 : 0.7),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: dark ? 0.12 : 0.06),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final itemCount = items.length;
                    final slotWidth = constraints.maxWidth / itemCount;
                    return SizedBox(
                      height: 52,
                      child: Stack(
                        children: [
                          AnimatedPositioned(
                            duration: const Duration(milliseconds: 280),
                            curve: Curves.easeOutCubic,
                            left: slotWidth * currentIndex,
                            top: 0,
                            width: slotWidth,
                            height: 52,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 1.5,
                                vertical: 1,
                              ),
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(24),
                                  gradient: selectedGradient,
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFFC44F76)
                                          .withValues(alpha: 0.18),
                                      blurRadius: 14,
                                      offset: const Offset(0, 6),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          Row(
                            children: List.generate(items.length, (index) {
                              final selected = index == currentIndex;
                              return Expanded(
                                child: _LooBottomNavButton(
                                  item: items[index],
                                  selected: selected,
                                  selectedText: selectedText,
                                  unselectedText: unselectedText,
                                  onTap: () => onChanged(index),
                                ),
                              );
                            }),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LooBottomNavButton extends StatelessWidget {
  const _LooBottomNavButton({
    required this.item,
    required this.selected,
    required this.selectedText,
    required this.unselectedText,
    required this.onTap,
  });

  final LooBottomNavItem item;
  final bool selected;
  final Color selectedText;
  final Color unselectedText;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: selected,
      button: true,
      label: item.label,
      child: InkWell(
        borderRadius: BorderRadius.circular(28),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutCubic,
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                item.icon,
                size: 19,
                color: selected ? selectedText : unselectedText,
              ),
              const SizedBox(height: 2),
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: selected ? selectedText : unselectedText,
                  fontSize: 10,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  height: 1.05,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
