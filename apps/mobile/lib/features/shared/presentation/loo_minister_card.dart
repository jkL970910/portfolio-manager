import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../data/loo_minister_context_models.dart";

class LooMinisterCard extends StatefulWidget {
  const LooMinisterCard({
    required this.apiClient,
    required this.pageContext,
    required this.suggestedQuestion,
    super.key,
  });

  final LooApiClient apiClient;
  final LooMinisterPageContext pageContext;
  final String suggestedQuestion;

  @override
  State<LooMinisterCard> createState() => _LooMinisterCardState();
}

class LooMinisterFloatingButton extends StatelessWidget {
  const LooMinisterFloatingButton({
    required this.apiClient,
    required this.navigatorKey,
    required this.pageContext,
    required this.suggestedQuestion,
    super.key,
  });

  final LooApiClient apiClient;
  final GlobalKey<NavigatorState> navigatorKey;
  final LooMinisterPageContext pageContext;
  final String suggestedQuestion;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: _DraggableMinisterButton(
        apiClient: apiClient,
        navigatorKey: navigatorKey,
        pageContext: pageContext,
        suggestedQuestion: suggestedQuestion,
      ),
    );
  }
}

class _DraggableMinisterButton extends StatefulWidget {
  const _DraggableMinisterButton({
    required this.apiClient,
    required this.navigatorKey,
    required this.pageContext,
    required this.suggestedQuestion,
  });

  final LooApiClient apiClient;
  final GlobalKey<NavigatorState> navigatorKey;
  final LooMinisterPageContext pageContext;
  final String suggestedQuestion;

  @override
  State<_DraggableMinisterButton> createState() =>
      _DraggableMinisterButtonState();
}

class _DraggableMinisterButtonState extends State<_DraggableMinisterButton> {
  static const _buttonWidth = 124.0;
  static const _buttonHeight = 56.0;
  static const _edgeMargin = 14.0;

  Offset? _offset;
  var _dragging = false;
  var _movedDuringGesture = false;
  var _sheetOpen = false;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final position = _clampOffset(
          _offset ?? _initialOffset(constraints),
          constraints,
        );

        return Stack(
          children: [
            if (!_sheetOpen)
              AnimatedPositioned(
                duration: _dragging
                    ? Duration.zero
                    : const Duration(milliseconds: 180),
                curve: Curves.easeOutCubic,
                left: position.dx,
                top: position.dy,
                width: _buttonWidth,
                height: _buttonHeight,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: _openMinisterSheet,
                  onPanStart: (_) {
                    setState(() {
                      _dragging = true;
                      _movedDuringGesture = false;
                    });
                  },
                  onPanUpdate: (details) {
                    setState(() {
                      _movedDuringGesture = true;
                      _offset = _clampOffset(
                        position + details.delta,
                        constraints,
                      );
                    });
                  },
                  onPanCancel: () {
                    setState(() {
                      _dragging = false;
                      _movedDuringGesture = false;
                    });
                  },
                  onPanEnd: (_) {
                    final current = _clampOffset(
                      _offset ?? position,
                      constraints,
                    );
                    final snapLeft = current.dx + _buttonWidth / 2 <
                        constraints.maxWidth / 2;
                    setState(() {
                      _dragging = false;
                      _offset = _clampOffset(
                        Offset(
                          snapLeft
                              ? _edgeMargin
                              : constraints.maxWidth -
                                  _buttonWidth -
                                  _edgeMargin,
                          current.dy,
                        ),
                        constraints,
                      );
                    });
                    if (!_movedDuringGesture) {
                      _openMinisterSheet();
                    }
                    _movedDuringGesture = false;
                  },
                  child: AbsorbPointer(
                    child: FloatingActionButton.extended(
                      heroTag: "loo-minister",
                      onPressed: () {},
                      icon: const Icon(Icons.auto_awesome),
                      label: const Text("问大臣"),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Offset _initialOffset(BoxConstraints constraints) {
    return Offset(
      constraints.maxWidth - _buttonWidth - _edgeMargin,
      constraints.maxHeight - _buttonHeight - _edgeMargin,
    );
  }

  Offset _clampOffset(Offset offset, BoxConstraints constraints) {
    final maxX = constraints.maxWidth - _buttonWidth - _edgeMargin;
    final maxY = constraints.maxHeight - _buttonHeight - _edgeMargin;
    return Offset(
      offset.dx.clamp(_edgeMargin, maxX < _edgeMargin ? _edgeMargin : maxX),
      offset.dy.clamp(_edgeMargin, maxY < _edgeMargin ? _edgeMargin : maxY),
    );
  }

  void _openMinisterSheet() {
    if (_sheetOpen) {
      return;
    }

    final sheetContext = widget.navigatorKey.currentContext;
    if (sheetContext == null) {
      return;
    }

    setState(() => _sheetOpen = true);
    showModalBottomSheet<void>(
      context: sheetContext,
      isScrollControlled: true,
      useRootNavigator: true,
      useSafeArea: true,
      builder: (_) => _LooMinisterSheet(
        apiClient: widget.apiClient,
        pageContext: widget.pageContext,
        suggestedQuestion: widget.suggestedQuestion,
      ),
    ).whenComplete(() {
      if (mounted) {
        setState(() => _sheetOpen = false);
      }
    });
  }
}

class _LooMinisterSheet extends StatelessWidget {
  const _LooMinisterSheet({
    required this.apiClient,
    required this.pageContext,
    required this.suggestedQuestion,
  });

  final LooApiClient apiClient;
  final LooMinisterPageContext pageContext;
  final String suggestedQuestion;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      minChildSize: 0.42,
      maxChildSize: 0.92,
      builder: (context, scrollController) {
        return SingleChildScrollView(
          controller: scrollController,
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 10,
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: Column(
            children: [
              Container(
                width: 48,
                height: 5,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.outlineVariant,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 10),
              LooMinisterCard(
                apiClient: apiClient,
                pageContext: pageContext,
                suggestedQuestion: suggestedQuestion,
              ),
            ],
          ),
        );
      },
    );
  }
}

class _LooMinisterCardState extends State<LooMinisterCard> {
  late final TextEditingController _questionController =
      TextEditingController(text: widget.suggestedQuestion);
  Future<LooMinisterAnswer>? _answer;
  var _loading = false;

  @override
  void dispose() {
    _questionController.dispose();
    super.dispose();
  }

  Future<LooMinisterAnswer> _askMinister() async {
    final question = _questionController.text.trim();
    if (question.length < 2) {
      throw const LooApiException("请先输入至少 2 个字的问题。");
    }

    final request = LooMinisterQuestionRequest(
      pageContext: widget.pageContext,
      question: question,
    );
    final response = await widget.apiClient.askLooMinister(request.toJson());
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("Loo国大臣答复格式不正确。");
    }
    return LooMinisterAnswer.fromJson(data);
  }

  void _submit() {
    setState(() {
      _loading = true;
      _answer = _askMinister().whenComplete(() {
        if (mounted) {
          setState(() => _loading = false);
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.forum_outlined),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    "问 Loo国大臣",
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text("基于当前页面数据回答；暂不调用实时新闻、论坛或外部研究。"),
            const SizedBox(height: 12),
            TextField(
              controller: _questionController,
              minLines: 1,
              maxLines: 3,
              decoration: const InputDecoration(labelText: "你的问题"),
              onSubmitted: (_) {
                if (!_loading) {
                  _submit();
                }
              },
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _loading ? null : _submit,
                icon: const Icon(Icons.auto_awesome),
                label: Text(_loading ? "大臣思考中..." : "请大臣解释"),
              ),
            ),
            if (_answer != null) ...[
              const SizedBox(height: 14),
              FutureBuilder<LooMinisterAnswer>(
                future: _answer,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const LinearProgressIndicator();
                  }
                  if (snapshot.hasError) {
                    return _MinisterError(message: snapshot.error.toString());
                  }
                  final answer = snapshot.data;
                  if (answer == null) {
                    return const _MinisterError(message: "没有收到大臣答复。");
                  }
                  return _MinisterAnswerView(answer);
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class LooMinisterAnswer {
  const LooMinisterAnswer({
    required this.title,
    required this.answer,
    required this.keyPoints,
    required this.disclaimer,
  });

  final String title;
  final String answer;
  final List<String> keyPoints;
  final String disclaimer;

  factory LooMinisterAnswer.fromJson(Map<String, dynamic> json) {
    final disclaimer = json["disclaimer"];
    return LooMinisterAnswer(
      title: json["title"] as String? ?? "大臣答复",
      answer: json["answer"] as String? ?? "暂时没有答复。",
      keyPoints: (json["keyPoints"] as List?)?.whereType<String>().toList() ??
          const [],
      disclaimer: disclaimer is Map<String, dynamic>
          ? disclaimer["zh"] as String? ?? "仅用于研究学习，不构成投资建议。"
          : "仅用于研究学习，不构成投资建议。",
    );
  }
}

class _MinisterAnswerView extends StatelessWidget {
  const _MinisterAnswerView(this.answer);

  final LooMinisterAnswer answer;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context)
            .colorScheme
            .primaryContainer
            .withValues(alpha: 0.32),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(answer.title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(answer.answer),
            if (answer.keyPoints.isNotEmpty) ...[
              const SizedBox(height: 10),
              ...answer.keyPoints.take(4).map((point) => Text("• $point")),
            ],
            const SizedBox(height: 10),
            Text(
              answer.disclaimer,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _MinisterError extends StatelessWidget {
  const _MinisterError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Text(
      message,
      style: TextStyle(color: Theme.of(context).colorScheme.error),
    );
  }
}
