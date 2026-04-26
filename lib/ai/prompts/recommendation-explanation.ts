export function buildRecommendationExplanationPrompt() {
  return `
任务：解释后端已经生成的推荐结果为什么成立。

要求：
- 先总结推荐结论
- 再解释账户选择原因
- 再解释标的或资产类别选择原因
- 再解释主要风险和前提
- 保持中文移动端可读性
- 不要篡改后端推荐结果本身
`.trim();
}
