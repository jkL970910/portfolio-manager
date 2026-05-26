import "package:flutter/material.dart";

import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../data/mobile_onboarding_models.dart";

class OnboardingChecklistCard extends StatefulWidget {
  const OnboardingChecklistCard({
    required this.state,
    required this.onOpenIdentitySettings,
    required this.onOpenPreferenceSettings,
    required this.onOpenAiMinisterSettings,
    required this.onOpenRegisteredRoomSettings,
    required this.onOpenImport,
    required this.onOpenHealth,
    required this.onOpenRecommendations,
    required this.onMarkCompleted,
    required this.onAllCompleted,
    required this.onSkip,
    super.key,
  });

  final MobileOnboardingState state;
  final VoidCallback onOpenIdentitySettings;
  final VoidCallback onOpenPreferenceSettings;
  final VoidCallback onOpenAiMinisterSettings;
  final VoidCallback onOpenRegisteredRoomSettings;
  final VoidCallback onOpenImport;
  final VoidCallback onOpenHealth;
  final VoidCallback onOpenRecommendations;
  final ValueChanged<String> onMarkCompleted;
  final VoidCallback onAllCompleted;
  final VoidCallback onSkip;

  @override
  State<OnboardingChecklistCard> createState() => OnboardingChecklistCardState();
}

class OnboardingChecklistCardState extends State<OnboardingChecklistCard> {
  late Map<String, String> _localChecklist;
  String? _syncingStepKey;
  var _completionCeremonyShown = false;

  @override
  void initState() {
    super.initState();
    _localChecklist = Map<String, String>.from(widget.state.checklist);
  }

  @override
  void didUpdateWidget(OnboardingChecklistCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.state, widget.state)) {
      _localChecklist = {
        ..._localChecklist,
        ...widget.state.checklist,
      };
    }
  }

  void _markCompleted(String keyName) {
    if (_localChecklist[keyName] == "completed" || _syncingStepKey != null) {
      return;
    }
    setState(() {
      _localChecklist[keyName] = "completed";
      _syncingStepKey = keyName;
    });
    widget.onMarkCompleted(keyName);
  }

  void markSyncFailed(String keyName) {
    if (!mounted) {
      return;
    }
    setState(() {
      _localChecklist[keyName] = widget.state.statusFor(keyName);
      _syncingStepKey = null;
    });
  }

  void markSyncFinished(String keyName) {
    if (!mounted) {
      return;
    }
    if (_syncingStepKey == keyName) {
      setState(() {
        _syncingStepKey = null;
      });
    }
    if (_isAllCompleted && !_completionCeremonyShown) {
      _completionCeremonyShown = true;
      Future<void>.microtask(_showCompletionCeremony);
    }
  }

  bool get _isAllCompleted {
    const requiredKeys = [
      "identity",
      "preferences",
      "aiMinister",
      "registeredRoom",
      "importAssets",
      "healthReview",
      "firstRecommendation",
    ];
    return requiredKeys.every((key) => _localChecklist[key] == "completed");
  }

  Future<void> _showCompletionCeremony() async {
    if (!mounted) {
      return;
    }
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) => Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
        backgroundColor: Colors.transparent,
        child: LooGlassCard(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: tokens.accentSoft.withValues(alpha: 0.62),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Icon(
                        Icons.workspace_premium_rounded,
                        color: tokens.accent,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      "开国大典已成",
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                "陛下，国民身份、进货规矩、额度银两、资产账本、巡阅与进货路线均已立好。Loo国宝库正式开张。",
                style: theme.textTheme.bodyLarge?.copyWith(height: 1.45),
              ),
              const SizedBox(height: 10),
              Text(
                "从现在开始，臣会守着你的国库地图：该巡查时提醒，该上贡时验货，该进货时先过护栏。赚钱不靠玄学，靠账本清楚、规矩清楚、风险清楚。",
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: tokens.mutedText,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.castle_rounded),
                      label: const Text("开始巡国库"),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    widget.onAllCompleted();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.state.shouldShowChecklist) {
      return const SizedBox.shrink();
    }
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    final steps = [
      _OnboardingStep(
        keyName: "identity",
        title: "领取国民身份",
        detail: "先定称呼、头像和币种，国库账册才知道该向谁禀报。",
        actionLabel: "去设置",
        onTap: widget.onOpenIdentitySettings,
      ),
      _OnboardingStep(
        keyName: "preferences",
        title: "立下进货规矩",
        detail: "先写下风险、账户顺序和禁入清单，臣才不会乱荐货。",
        actionLabel: "去设置",
        onTap: widget.onOpenPreferenceSettings,
      ),
      _OnboardingStep(
        keyName: "aiMinister",
        title: "召请外部智囊",
        detail: "接入你的外部 API Key，深度思考才有额外军师可用。",
        actionLabel: "去设置",
        onTap: widget.onOpenAiMinisterSettings,
      ),
      _OnboardingStep(
        keyName: "registeredRoom",
        title: "登记额度与银两",
        detail: "TFSA/RRSP/FHSA 额度与可动用银两，会决定进货路线。",
        actionLabel: "去设置",
        onTap: widget.onOpenRegisteredRoomSettings,
      ),
      _OnboardingStep(
        keyName: "importAssets",
        title: "上贡资产",
        detail: "手动创建或券商同步，确认后才写入账本。",
        actionLabel: "去上贡",
        onTap: widget.onOpenImport,
      ),
      _OnboardingStep(
        keyName: "healthReview",
        title: "请 Loo皇巡阅",
        detail: "让 Loo皇先巡国库，找出最该补防的地方。",
        actionLabel: "去巡查",
        onTap: widget.onOpenHealth,
      ),
      _OnboardingStep(
        keyName: "firstRecommendation",
        title: "听取 Loo皇推荐",
        detail: "报上本轮银两，臣按规矩筛出本次可考虑的进货候选。",
        actionLabel: "去进货",
        onTap: widget.onOpenRecommendations,
      ),
    ];
    final nextStep = steps.firstWhere(
      (step) => _statusFor(step.keyName) != "completed",
      orElse: () => steps.last,
    );
    final completedCount =
        steps.where((step) => _statusFor(step.keyName) == "completed").length;
    final totalCount = steps.length;

    return LooGlassCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.flag_outlined, color: tokens.accent),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  "开国任务",
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _ProgressPill(
                "$completedCount/$totalCount",
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            "陛下先走完这几道开国工序，Loo国才能从空宝库变成可巡、可问、可进货的个人风控台。",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: tokens.mutedText,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: totalCount <= 0 ? 0 : completedCount / totalCount,
              minHeight: 7,
              backgroundColor: tokens.cardBorder,
            ),
          ),
          const SizedBox(height: 12),
          ...steps.map(
            (step) => _OnboardingStepTile(
              step: step,
              status: _statusFor(step.keyName),
              isNext: step.keyName == nextStep.keyName,
              syncing: _syncingStepKey == step.keyName,
              onMarkCompleted: () => _markCompleted(step.keyName),
              onReplay: step.onTap,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: nextStep.onTap,
                  icon: const Icon(Icons.arrow_forward_rounded),
                  label: Text(nextStep.actionLabel),
                ),
              ),
              const SizedBox(width: 10),
              TextButton(
                onPressed: widget.onSkip,
                child: const Text("先跳过"),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _statusFor(String keyName) => _localChecklist[keyName] ?? "pending";
}

class _OnboardingStep {
  const _OnboardingStep({
    required this.keyName,
    required this.title,
    required this.detail,
    required this.actionLabel,
    required this.onTap,
  });

  final String keyName;
  final String title;
  final String detail;
  final String actionLabel;
  final VoidCallback onTap;
}

class _OnboardingStepTile extends StatelessWidget {
  const _OnboardingStepTile({
    required this.step,
    required this.status,
    required this.isNext,
    required this.syncing,
    required this.onMarkCompleted,
    required this.onReplay,
  });

  final _OnboardingStep step;
  final String status;
  final bool isNext;
  final bool syncing;
  final VoidCallback onMarkCompleted;
  final VoidCallback onReplay;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final completed = status == "completed";
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: isNext
              ? tokens.accentSoft.withValues(alpha: 0.32)
              : Theme.of(context).colorScheme.surface.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isNext
                ? tokens.accent.withValues(alpha: 0.45)
                : tokens.cardBorder,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Icon(
                completed
                    ? Icons.check_circle_rounded
                    : isNext
                        ? Icons.radio_button_checked_rounded
                        : Icons.radio_button_unchecked_rounded,
                color: completed ? Colors.green.shade300 : tokens.accent,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      step.title,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      step.detail,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: tokens.mutedText,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (completed)
                TextButton(
                  onPressed: onReplay,
                  child: const Text("重走"),
                )
              else if (syncing)
                const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                TextButton(
                  onPressed: onMarkCompleted,
                  child: const Text("完成"),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProgressPill extends StatelessWidget {
  const _ProgressPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.accentSoft.withValues(alpha: 0.42),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: tokens.accent,
                fontWeight: FontWeight.w900,
              ),
        ),
      ),
    );
  }
}
