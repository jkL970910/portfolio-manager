import "package:flutter/widgets.dart";

import "../data/loo_minister_context_models.dart";

class LooMinisterScope extends InheritedWidget {
  const LooMinisterScope({
    required this.onContextChanged,
    required super.child,
    super.key,
  });

  final ValueChanged<LooMinisterPageContext> onContextChanged;

  static void report(
    BuildContext context,
    LooMinisterPageContext pageContext,
  ) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<LooMinisterScope>();
    scope?.onContextChanged(pageContext);
  }

  @override
  bool updateShouldNotify(LooMinisterScope oldWidget) {
    return onContextChanged != oldWidget.onContextChanged;
  }
}
