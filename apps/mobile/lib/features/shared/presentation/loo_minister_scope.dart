import "package:flutter/foundation.dart";
import "package:flutter/widgets.dart";

import "../data/loo_minister_context_models.dart";

class LooMinisterScope extends InheritedWidget {
  const LooMinisterScope({
    required this.onContextChanged,
    required this.analysisActionListenable,
    required super.child,
    super.key,
  });

  final ValueChanged<LooMinisterPageContext> onContextChanged;
  final ValueListenable<LooMinisterSuggestedAction?> analysisActionListenable;

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

  @override
  bool updateShouldNotify(LooMinisterScope oldWidget) {
    return onContextChanged != oldWidget.onContextChanged ||
        analysisActionListenable != oldWidget.analysisActionListenable;
  }
}
