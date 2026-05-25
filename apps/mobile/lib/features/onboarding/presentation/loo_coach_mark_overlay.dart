import "package:flutter/material.dart";

class LooCoachStep {
  const LooCoachStep({
    required this.targetKey,
    required this.title,
    required this.body,
    this.beforeResolve,
  });

  final GlobalKey targetKey;
  final String title;
  final String body;
  final Future<void> Function()? beforeResolve;
}

Future<void> showLooCoachMarks({
  required BuildContext context,
  required List<LooCoachStep> steps,
  required Future<void> Function() onCompleted,
  required Future<void> Function() onSkipped,
}) async {
  if (steps.isEmpty) {
    return;
  }
  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (context) => _LooCoachMarkDialog(
      steps: steps,
      onCompleted: onCompleted,
      onSkipped: onSkipped,
    ),
  );
}

class _LooCoachMarkDialog extends StatefulWidget {
  const _LooCoachMarkDialog({
    required this.steps,
    required this.onCompleted,
    required this.onSkipped,
  });

  final List<LooCoachStep> steps;
  final Future<void> Function() onCompleted;
  final Future<void> Function() onSkipped;

  @override
  State<_LooCoachMarkDialog> createState() => _LooCoachMarkDialogState();
}

class _LooCoachMarkDialogState extends State<_LooCoachMarkDialog> {
  var _index = 0;
  Rect? _targetRect;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _resolveTarget());
  }

  Future<void> _resolveTarget() async {
    if (!mounted) {
      return;
    }
    final step = widget.steps[_index];
    await step.beforeResolve?.call();
    if (!mounted) {
      return;
    }
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) {
      return;
    }
    final initialKeyContext = step.targetKey.currentContext;
    if (initialKeyContext != null) {
      if (!initialKeyContext.mounted) {
        return;
      }
      await Scrollable.ensureVisible(
        initialKeyContext,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
        alignment: 0.12,
      );
      await Future<void>.delayed(const Duration(milliseconds: 80));
    }
    if (!mounted) {
      return;
    }
    final keyContext = step.targetKey.currentContext;
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) {
      return;
    }
    final renderObject = keyContext?.findRenderObject();
    if (renderObject is! RenderBox || !renderObject.hasSize) {
      setState(() => _targetRect = null);
      return;
    }
    final offset = renderObject.localToGlobal(Offset.zero);
    setState(() {
      _targetRect = offset & renderObject.size;
    });
  }

  Future<void> _skip() async {
    await widget.onSkipped();
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _next() async {
    if (_index >= widget.steps.length - 1) {
      await widget.onCompleted();
      if (mounted) {
        Navigator.of(context).pop();
      }
      return;
    }
    setState(() {
      _index += 1;
      _targetRect = null;
    });
    await _resolveTarget();
  }

  @override
  Widget build(BuildContext context) {
    final step = widget.steps[_index];
    final rect = _targetRect;
    final media = MediaQuery.of(context);
    final cardTop = rect == null
        ? media.size.height * 0.28
        : (rect.bottom + 14).clamp(72.0, media.size.height - 240.0);
    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          ..._buildScrimPieces(media.size, rect),
          if (rect != null)
            Positioned.fromRect(
              rect: rect.inflate(6),
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: Colors.white, width: 2),
                    color: Colors.white.withValues(alpha: 0.03),
                  ),
                ),
              ),
            ),
          Positioned(
            left: 20,
            right: 20,
            top: cardTop,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(22),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.24),
                    blurRadius: 30,
                    offset: const Offset(0, 18),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "${_index + 1}/${widget.steps.length} · ${step.title}",
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(step.body),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        TextButton(
                          onPressed: _skip,
                          child: const Text("跳过本页"),
                        ),
                        const Spacer(),
                        FilledButton(
                          onPressed: _next,
                          child: Text(
                            _index >= widget.steps.length - 1 ? "知道了" : "下一步",
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildScrimPieces(Size size, Rect? rect) {
    final color = Colors.black.withValues(alpha: 0.64);
    Widget piece({
      required double left,
      required double top,
      required double width,
      required double height,
    }) {
      if (width <= 0 || height <= 0) {
        return const SizedBox.shrink();
      }
      return Positioned(
        left: left,
        top: top,
        width: width,
        height: height,
        child: IgnorePointer(child: ColoredBox(color: color)),
      );
    }

    if (rect == null) {
      return [
        piece(left: 0, top: 0, width: size.width, height: size.height),
      ];
    }

    final cutout = rect.inflate(8);
    final left = cutout.left.clamp(0.0, size.width);
    final top = cutout.top.clamp(0.0, size.height);
    final right = cutout.right.clamp(0.0, size.width);
    final bottom = cutout.bottom.clamp(0.0, size.height);

    return [
      piece(left: 0, top: 0, width: size.width, height: top),
      piece(
          left: 0,
          top: bottom,
          width: size.width,
          height: size.height - bottom),
      piece(left: 0, top: top, width: left, height: bottom - top),
      piece(
          left: right,
          top: top,
          width: size.width - right,
          height: bottom - top),
    ];
  }
}
