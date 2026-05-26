import "package:flutter/foundation.dart";
import "package:flutter/widgets.dart";

import "../data/loo_minister_context_models.dart";

class LooMinisterScope extends InheritedWidget {
  const LooMinisterScope({
    required this.onContextChanged,
    required this.onFloatingVisibilityChanged,
    required this.analysisActionListenable,
    required this.floatingButtonKey,
    required super.child,
    super.key,
  });

  final ValueChanged<LooMinisterPageContext> onContextChanged;
  final ValueChanged<bool> onFloatingVisibilityChanged;
  final ValueListenable<LooMinisterSuggestedAction?> analysisActionListenable;
  final GlobalKey floatingButtonKey;

  static LooMinisterScope? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<LooMinisterScope>();
  }

  static void report(
    BuildContext context,
    LooMinisterPageContext pageContext,
  ) {
    final scope = maybeOf(context);
    scope?.onContextChanged(pageContext);
  }

  static void setFloatingVisible(BuildContext context, bool visible) {
    final scope = maybeOf(context);
    scope?.onFloatingVisibilityChanged(visible);
  }

  static GlobalKey? floatingButtonKeyOf(BuildContext context) {
    return maybeOf(context)?.floatingButtonKey;
  }

  @override
  bool updateShouldNotify(LooMinisterScope oldWidget) {
    return onContextChanged != oldWidget.onContextChanged ||
        onFloatingVisibilityChanged != oldWidget.onFloatingVisibilityChanged ||
        analysisActionListenable != oldWidget.analysisActionListenable ||
        floatingButtonKey != oldWidget.floatingButtonKey;
  }
}
