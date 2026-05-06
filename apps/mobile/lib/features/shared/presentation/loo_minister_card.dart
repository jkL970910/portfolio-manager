import "dart:async";

import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../data/loo_minister_context_models.dart";

class LooMinisterCard extends StatefulWidget {
  const LooMinisterCard({
    required this.apiClient,
    required this.pageContext,
    required this.recentSubjects,
    required this.suggestedQuestion,
    required this.onSuggestedActionConfirmed,
    super.key,
  });

  final LooApiClient apiClient;
  final LooMinisterPageContext pageContext;
  final List<LooMinisterRecentSubject> recentSubjects;
  final String suggestedQuestion;
  final ValueChanged<LooMinisterSuggestedAction> onSuggestedActionConfirmed;

  @override
  State<LooMinisterCard> createState() => _LooMinisterCardState();
}

class LooMinisterFloatingButton extends StatelessWidget {
  const LooMinisterFloatingButton({
    required this.apiClient,
    required this.navigatorKey,
    required this.pageContext,
    required this.recentSubjects,
    required this.suggestedQuestion,
    required this.onSuggestedActionConfirmed,
    super.key,
  });

  final LooApiClient apiClient;
  final GlobalKey<NavigatorState> navigatorKey;
  final LooMinisterPageContext pageContext;
  final List<LooMinisterRecentSubject> recentSubjects;
  final String suggestedQuestion;
  final ValueChanged<LooMinisterSuggestedAction> onSuggestedActionConfirmed;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: _DraggableMinisterButton(
        apiClient: apiClient,
        navigatorKey: navigatorKey,
        pageContext: pageContext,
        recentSubjects: recentSubjects,
        suggestedQuestion: suggestedQuestion,
        onSuggestedActionConfirmed: onSuggestedActionConfirmed,
      ),
    );
  }
}

class _DraggableMinisterButton extends StatefulWidget {
  const _DraggableMinisterButton({
    required this.apiClient,
    required this.navigatorKey,
    required this.pageContext,
    required this.recentSubjects,
    required this.suggestedQuestion,
    required this.onSuggestedActionConfirmed,
  });

  final LooApiClient apiClient;
  final GlobalKey<NavigatorState> navigatorKey;
  final LooMinisterPageContext pageContext;
  final List<LooMinisterRecentSubject> recentSubjects;
  final String suggestedQuestion;
  final ValueChanged<LooMinisterSuggestedAction> onSuggestedActionConfirmed;

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
        recentSubjects: widget.recentSubjects,
        suggestedQuestion: widget.suggestedQuestion,
        onSuggestedActionConfirmed: widget.onSuggestedActionConfirmed,
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
    required this.recentSubjects,
    required this.suggestedQuestion,
    required this.onSuggestedActionConfirmed,
  });

  final LooApiClient apiClient;
  final LooMinisterPageContext pageContext;
  final List<LooMinisterRecentSubject> recentSubjects;
  final String suggestedQuestion;
  final ValueChanged<LooMinisterSuggestedAction> onSuggestedActionConfirmed;

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
                recentSubjects: recentSubjects,
                suggestedQuestion: suggestedQuestion,
                onSuggestedActionConfirmed: onSuggestedActionConfirmed,
              ),
            ],
          ),
        );
      },
    );
  }
}

class _LooMinisterCardState extends State<LooMinisterCard> {
  static const _ministerSlowThreshold = Duration(seconds: 12);

  late final TextEditingController _questionController =
      TextEditingController(text: widget.suggestedQuestion);
  final List<_MinisterChatMessage> _messages = [];
  final List<Timer> _phaseTimers = [];
  var _loading = false;
  String? _phaseLabel;
  String? _sessionId;

  @override
  void dispose() {
    _clearPhaseTimers();
    _questionController.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _requestMinister(
    String question, {
    required String answerMode,
  }) async {
    final request = LooMinisterQuestionRequest(
      pageContext: widget.pageContext,
      question: question,
      recentSubjects: widget.recentSubjects,
    ).toJson();
    return widget.apiClient.askLooMinisterChat({
      ...request,
      "answerMode": answerMode,
      if (_sessionId != null) "sessionId": _sessionId,
    });
  }

  void _clearPhaseTimers() {
    for (final timer in _phaseTimers) {
      timer.cancel();
    }
    _phaseTimers.clear();
  }

  void _schedulePhaseUpdates() {
    _clearPhaseTimers();
    _setPhase("整理当前页面上下文...");
    _phaseTimers.add(Timer(const Duration(milliseconds: 700), () {
      _setPhase("补齐标的/项目资料...");
    }));
    _phaseTimers.add(Timer(const Duration(seconds: 2), () {
      _setPhase("询问 GPT-5.5 或等待本地策略...");
    }));
  }

  void _setPhase(String label) {
    if (!mounted || !_loading) {
      return;
    }
    setState(() => _phaseLabel = label);
  }

  Future<_MinisterTimeoutChoice?> _showTimeoutChoice() {
    return showDialog<_MinisterTimeoutChoice>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text("大臣回复较慢"),
        content: const Text(
          "GPT/Router 还在等待。你可以继续等真实模型答复，也可以改用本地大臣先给出基于缓存和页面 context 的答复。",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext)
                .pop(_MinisterTimeoutChoice.continueWaiting),
            child: const Text("继续等 GPT"),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext)
                .pop(_MinisterTimeoutChoice.useLocal),
            child: const Text("改用本地大臣"),
          ),
        ],
      ),
    );
  }

  Future<void> _applyMinisterResponse(Map<String, dynamic> response) async {
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("Loo国大臣答复格式不正确。");
    }
    final answerData = data["answer"];
    if (answerData is! Map<String, dynamic>) {
      throw const LooApiException("Loo国大臣答复格式不正确。");
    }
    final answer = LooMinisterAnswer.fromJson(answerData);
    if (!mounted) {
      return;
    }
    setState(() {
      _sessionId = data["sessionId"] as String? ?? _sessionId;
      _messages.add(_MinisterChatMessage.assistant(answer));
      _questionController.clear();
    });
  }

  Future<void> _askMinister(String question) async {
    _schedulePhaseUpdates();
    final remoteFuture = _requestMinister(question, answerMode: "auto");
    final firstResult = await Future.any<Object>([
      remoteFuture,
      Future<_MinisterSlowResponse>.delayed(
        _ministerSlowThreshold,
        () => const _MinisterSlowResponse(),
      ),
    ]);

    if (firstResult is Map<String, dynamic>) {
      await _applyMinisterResponse(firstResult);
      return;
    }

    _setPhase("GPT/Router 响应较慢，等待你的选择...");
    final choice = await _showTimeoutChoice();
    if (choice == _MinisterTimeoutChoice.useLocal) {
      _setPhase("切换本地大臣答复...");
      final localResponse =
          await _requestMinister(question, answerMode: "local");
      await _applyMinisterResponse(localResponse);
      return;
    }

    _setPhase("继续等待 GPT-5.5 答复...");
    await _applyMinisterResponse(await remoteFuture);
  }

  void _submit() {
    final question = _questionController.text.trim();
    if (question.length < 2 || _loading) {
      return;
    }

    setState(() {
      _loading = true;
      _messages.add(_MinisterChatMessage.user(question));
    });
    _askMinister(question).catchError((Object error) {
      if (mounted) {
        setState(() {
          _messages.add(_MinisterChatMessage.error(error.toString()));
        });
      }
    }).whenComplete(() {
      if (mounted) {
        _clearPhaseTimers();
        setState(() {
          _loading = false;
          _phaseLabel = null;
        });
      }
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
            const Text("基于当前页面和本轮对话回答；暂不在聊天里实时抓新闻、论坛或外部研究。"),
            if (_sessionId != null) ...[
              const SizedBox(height: 6),
              Text(
                "本轮对话已开启，可继续追问。",
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            if (_messages.isNotEmpty) ...[
              const SizedBox(height: 12),
              ..._messages.map(
                (message) => _MinisterChatBubble(
                  message,
                  onSuggestedActionConfirmed: widget.onSuggestedActionConfirmed,
                ),
              ),
            ],
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
                label: Text(_loading ? "大臣思考中..." : "发送给大臣"),
              ),
            ),
            if (_loading) ...[
              const SizedBox(height: 12),
              Text(
                _phaseLabel ?? "大臣思考中...",
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 6),
              const LinearProgressIndicator(),
            ],
          ],
        ),
      ),
    );
  }
}

class _MinisterSlowResponse {
  const _MinisterSlowResponse();
}

enum _MinisterTimeoutChoice { continueWaiting, useLocal }

class _MinisterChatMessage {
  const _MinisterChatMessage._({
    required this.role,
    required this.text,
    this.answer,
    this.isError = false,
  });

  factory _MinisterChatMessage.user(String text) =>
      _MinisterChatMessage._(role: "user", text: text);

  factory _MinisterChatMessage.assistant(LooMinisterAnswer answer) =>
      _MinisterChatMessage._(
        role: "assistant",
        text: answer.answer,
        answer: answer,
      );

  factory _MinisterChatMessage.error(String text) =>
      _MinisterChatMessage._(role: "assistant", text: text, isError: true);

  final String role;
  final String text;
  final LooMinisterAnswer? answer;
  final bool isError;
}

class _MinisterChatBubble extends StatelessWidget {
  const _MinisterChatBubble(
    this.message, {
    required this.onSuggestedActionConfirmed,
  });

  final _MinisterChatMessage message;
  final ValueChanged<LooMinisterSuggestedAction> onSuggestedActionConfirmed;

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == "user";
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Align(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: isUser
                  ? theme.colorScheme.secondaryContainer
                  : theme.colorScheme.primaryContainer.withValues(alpha: 0.32),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: theme.colorScheme.outlineVariant),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: isUser
                  ? Text(message.text)
                  : message.isError
                      ? _MinisterError(message: message.text)
                      : _MinisterAnswerView(
                          message.answer!,
                          onSuggestedActionConfirmed:
                              onSuggestedActionConfirmed,
                        ),
            ),
          ),
        ),
      ),
    );
  }
}

class LooMinisterAnswer {
  const LooMinisterAnswer({
    required this.title,
    required this.answer,
    required this.structured,
    required this.keyPoints,
    required this.suggestedActions,
    required this.disclaimer,
  });

  final String title;
  final String answer;
  final LooMinisterStructuredAnswer? structured;
  final List<String> keyPoints;
  final List<LooMinisterSuggestedAction> suggestedActions;
  final String disclaimer;

  factory LooMinisterAnswer.fromJson(Map<String, dynamic> json) {
    final disclaimer = json["disclaimer"];
    return LooMinisterAnswer(
      title: json["title"] as String? ?? "大臣答复",
      answer: json["answer"] as String? ?? "暂时没有答复。",
      structured: json["structured"] is Map<String, dynamic>
          ? LooMinisterStructuredAnswer.fromJson(
              json["structured"] as Map<String, dynamic>)
          : null,
      keyPoints: (json["keyPoints"] as List?)?.whereType<String>().toList() ??
          const [],
      suggestedActions: (json["suggestedActions"] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(_actionFromJson)
              .toList() ??
          const [],
      disclaimer: disclaimer is Map<String, dynamic>
          ? disclaimer["zh"] as String? ?? "仅用于研究学习，不构成投资建议。"
          : "仅用于研究学习，不构成投资建议。",
    );
  }

  static LooMinisterSuggestedAction _actionFromJson(Map<String, dynamic> json) {
    final target = json["target"];
    return LooMinisterSuggestedAction(
      id: json["id"] as String? ?? "minister-action",
      label: json["label"] as String? ?? "查看建议动作",
      actionType: json["actionType"] as String? ?? "explain",
      detail: json["detail"] as String?,
      target:
          target is Map<String, dynamic> ? target : const <String, dynamic>{},
      requiresConfirmation: json["requiresConfirmation"] == true,
    );
  }
}

class LooMinisterStructuredAnswer {
  const LooMinisterStructuredAnswer({
    required this.directAnswer,
    required this.reasoning,
    required this.decisionGates,
    required this.boundary,
    required this.nextStep,
  });

  final String directAnswer;
  final List<String> reasoning;
  final List<String> decisionGates;
  final String? boundary;
  final String? nextStep;

  factory LooMinisterStructuredAnswer.fromJson(Map<String, dynamic> json) {
    return LooMinisterStructuredAnswer(
      directAnswer: json["directAnswer"] as String? ?? "",
      reasoning: (json["reasoning"] as List?)?.whereType<String>().toList() ??
          const [],
      decisionGates:
          (json["decisionGates"] as List?)?.whereType<String>().toList() ??
              const [],
      boundary: json["boundary"] as String?,
      nextStep: json["nextStep"] as String?,
    );
  }
}

class _MinisterAnswerView extends StatelessWidget {
  const _MinisterAnswerView(
    this.answer, {
    required this.onSuggestedActionConfirmed,
  });

  final LooMinisterAnswer answer;
  final ValueChanged<LooMinisterSuggestedAction> onSuggestedActionConfirmed;

  @override
  Widget build(BuildContext context) {
    final structured = answer.structured;
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
            if (structured != null &&
                structured.directAnswer.trim().isNotEmpty) ...[
              Text(structured.directAnswer),
              if (structured.reasoning.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text("判断依据",
                    style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                ...structured.reasoning.take(4).map((point) => Text("• $point")),
              ],
              if (structured.decisionGates.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text("需要确认",
                    style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 4),
                ...structured.decisionGates
                    .take(4)
                    .map((point) => Text("• $point")),
              ],
              if (structured.boundary != null &&
                  structured.boundary!.trim().isNotEmpty) ...[
                const SizedBox(height: 10),
                Text("边界：${structured.boundary}",
                    style: Theme.of(context).textTheme.bodySmall),
              ],
              if (structured.nextStep != null &&
                  structured.nextStep!.trim().isNotEmpty) ...[
                const SizedBox(height: 10),
                Text("下一步：${structured.nextStep}"),
              ],
            ] else ...[
              Text(answer.answer),
            ],
            if (structured == null && answer.keyPoints.isNotEmpty) ...[
              const SizedBox(height: 10),
              ...answer.keyPoints.take(4).map((point) => Text("• $point")),
            ],
            if (answer.suggestedActions.isNotEmpty) ...[
              const SizedBox(height: 12),
              ...answer.suggestedActions.take(3).map(
                    (action) => _MinisterSuggestedActionChip(
                      action: action,
                      onConfirmed: onSuggestedActionConfirmed,
                    ),
                  ),
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

class _MinisterSuggestedActionChip extends StatelessWidget {
  const _MinisterSuggestedActionChip({
    required this.action,
    required this.onConfirmed,
  });

  final LooMinisterSuggestedAction action;
  final ValueChanged<LooMinisterSuggestedAction> onConfirmed;

  @override
  Widget build(BuildContext context) {
    final isRunAnalysis = action.actionType == "run-analysis";
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: OutlinedButton.icon(
        onPressed: () => _confirmAction(context),
        icon: Icon(
          isRunAnalysis
              ? Icons.analytics_outlined
              : Icons.arrow_forward_outlined,
        ),
        label: Text(action.label),
      ),
    );
  }

  Future<void> _confirmAction(BuildContext context) async {
    final confirmationDetail = _confirmationDetail;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(action.label),
        content: Text([action.detail, confirmationDetail]
            .whereType<String>()
            .where((item) => item.isNotEmpty)
            .join("\n\n")),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text("取消"),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text("确认执行"),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    onConfirmed(action);
  }

  String get _confirmationDetail {
    return switch (action.actionType) {
      "run-analysis" => "确认后，大臣会触发当前页面已有的智能快扫。真实请求、缓存策略和额度仍由页面分析卡片控制。",
      "navigate" => "确认后会打开对应页面，不会修改任何数据。",
      "open-form" => "确认后会打开对应入口。保存前仍需要你在页面内再次确认。",
      "update-preferences" => "确认后会打开偏好设置。大臣不会直接替你保存配置。",
      "refresh-data" => "确认后会打开对应页面。实际刷新仍需要你使用页面内按钮确认执行。",
      _ => "确认后会把这个建议交给当前应用处理。",
    };
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
