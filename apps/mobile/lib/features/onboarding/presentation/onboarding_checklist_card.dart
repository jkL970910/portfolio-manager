import "package:flutter/material.dart";

import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../data/mobile_onboarding_models.dart";

class OnboardingChecklistCard extends StatelessWidget {
  const OnboardingChecklistCard({
    required this.state,
    required this.onOpenSettings,
    required this.onOpenImport,
    required this.onOpenHealth,
    required this.onOpenRecommendations,
    required this.onSkip,
    super.key,
  });

  final MobileOnboardingState state;
  final VoidCallback onOpenSettings;
  final VoidCallback onOpenImport;
  final VoidCallback onOpenHealth;
  final VoidCallback onOpenRecommendations;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    if (!state.shouldShowChecklist) {
      return const SizedBox.shrink();
    }
    final tokens = context.looTokens;
    final theme = Theme.of(context);
    final steps = [
      _OnboardingStep(
        keyName: "identity",
        title: "登记身份",
        detail: "确认 Loo国身份、主题和显示币种。",
        actionLabel: "去设置",
        onTap: onOpenSettings,
      ),
      _OnboardingStep(
        keyName: "preferences",
        title: "设定候选池治理",
        detail: "风险、账户优先级、偏好和不进候选池边界。",
        actionLabel: "去设置",
        onTap: onOpenSettings,
      ),
      _OnboardingStep(
        keyName: "registeredRoom",
        title: "设置额度与银两",
        detail: "注册账户额度和 buying power 会影响进货判断。",
        actionLabel: "去设置",
        onTap: onOpenSettings,
      ),
      _OnboardingStep(
        keyName: "importAssets",
        title: "上贡资产",
        detail: "手动创建或券商同步，确认后才写入账本。",
        actionLabel: "去上贡",
        onTap: onOpenImport,
      ),
      _OnboardingStep(
        keyName: "healthReview",
        title: "巡查国库",
        detail: "看健康分、优先行动和账户巡查。",
        actionLabel: "去巡查",
        onTap: onOpenHealth,
      ),
      _OnboardingStep(
        keyName: "firstRecommendation",
        title: "听取 Loo皇推荐",
        detail: "输入本轮银两，生成候选池过滤后的推荐。",
        actionLabel: "去进货",
        onTap: onOpenRecommendations,
      ),
    ];
    final nextStep = steps.firstWhere(
      (step) => state.statusFor(step.keyName) != "completed",
      orElse: () => steps.last,
    );

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
                "${state.progress.completed}/${state.progress.total}",
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: state.progress.total <= 0
                  ? 0
                  : state.progress.completed / state.progress.total,
              minHeight: 7,
              backgroundColor: tokens.cardBorder,
            ),
          ),
          const SizedBox(height: 12),
          ...steps.map(
            (step) => _OnboardingStepTile(
              step: step,
              status: state.statusFor(step.keyName),
              isNext: step.keyName == nextStep.keyName,
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
                onPressed: onSkip,
                child: const Text("先跳过"),
              ),
            ],
          ),
        ],
      ),
    );
  }
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
  });

  final _OnboardingStep step;
  final String status;
  final bool isNext;

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
