import type {
  LooMinisterFact,
  LooMinisterPageContext,
} from "@/lib/backend/loo-minister-contracts";

export const looMinisterPageLabels: Record<LooMinisterPageContext["page"], string> = {
  overview: "总览",
  portfolio: "组合",
  "account-detail": "账户",
  "holding-detail": "持仓",
  "security-detail": "标的",
  "portfolio-health": "健康巡查",
  recommendations: "推荐",
  import: "导入",
  settings: "设置",
  spending: "收支",
};

export const looMinisterProjectKnowledgeItems: Array<{
  id: string;
  label: string;
  pages: Array<LooMinisterPageContext["page"]>;
  triggers: RegExp[];
  value: string;
  detail: string;
}> = [
  {
    id: "project-feature-overview",
    label: "功能说明：总览",
    pages: ["overview"],
    triggers: [/总览|首页|净资产|total asset|走势|曲线/i],
    value: "总览负责展示 Loo国当前全局状态：总资产、走势图、健康巡查、重点账户、头部持仓和今日秘闻。",
    detail:
      "总览是最高层摘要，不负责深度编辑；如果用户追问具体账户/持仓/标的，应引导进入对应详情页。走势图必须说明真实历史、本地缓存、参考曲线或 stale 状态。",
  },
  {
    id: "project-feature-portfolio",
    label: "功能说明：组合",
    pages: ["portfolio"],
    triggers: [/组合|portfolio|账户|持仓|资产类别|allocation|配置/i],
    value: "组合页负责解释账户、持仓、资产类别分布、FX 折算、报价新鲜度和组合级健康状态。",
    detail:
      "组合页不重复完整今日秘闻，避免每个页面都加载相同情报；它应优先帮助用户定位配置偏离、持仓状态和账户层面的下一步操作。",
  },
  {
    id: "project-feature-security",
    label: "功能说明：标的详情",
    pages: ["security-detail", "holding-detail"],
    triggers: [/标的|security|ticker|listing|买入|适合|适配|价格|报价|刷新/i],
    value: "标的/持仓详情必须按 securityId 或完整 symbol + exchange + currency 回答，不能只按 ticker 合并。",
    detail:
      "价格、走势图、智能快扫、今日秘闻和推荐解释都要保留 listing 身份。US 正股与 CAD listed/CDR/hedged 版本可以共享 underlying 研究背景，但不能共享 listing 价格、FX 和持仓事实。",
  },
  {
    id: "project-feature-recommendations",
    label: "功能说明：推荐",
    pages: ["recommendations"],
    triggers: [/推荐|recommend|v2|v3|候选|买什么|优先/i],
    value: "推荐页当前是 V2.1 deterministic core + V3 cached-intelligence overlay。",
    detail:
      "V2.1 负责目标配置、账户/税务/FX/约束和偏好因子；V3 overlay 读取缓存外部情报，不应在页面加载时实时抓新闻或论坛。大臣可解释推荐原因，但保存/执行仍需用户确认。",
  },
  {
    id: "project-feature-preferences",
    label: "功能说明：投资偏好",
    pages: ["settings", "recommendations", "portfolio-health"],
    triggers: [/偏好|preference|factor|风险|行业|科技|能源|买房|税务|现金/i],
    value: "投资偏好保留两条线：新手引导式问答生成完整参数，进阶用户手动编辑所有参数。",
    detail:
      "AI 大臣可以辅助生成草稿，但草稿必须展示给用户确认后才应用。Preference Factors V2 会影响健康分解释和推荐排序，但不能绕过目标配置和风险约束。",
  },
  {
    id: "project-feature-health",
    label: "功能说明：健康巡查",
    pages: ["portfolio-health", "overview", "portfolio", "account-detail"],
    triggers: [/health|健康|评分|score|分数|风险护栏|雷达|再平衡|偏离|目标/i],
    value: "Health Score 分全组合和账户两个层级：全组合看总体配置/风险，账户页看账户内适配并参考全组合目标。",
    detail:
      "账户评分不要求每个账户复制全组合目标。大臣解释健康分时应区分 portfolio lens 与 account lens，并说明配置偏离、集中度、现金/流动性、税务/账户位置和数据新鲜度。",
  },
  {
    id: "project-feature-recommendation-constraints",
    label: "功能说明：推荐约束",
    pages: ["recommendations", "settings"],
    triggers: [/约束|constraints|排除|preferred|excluded|偏好标的|账户规则|资产类别区间|security type/i],
    value: "推荐约束是 V2.1 的硬边界/软偏好层：排除标的、偏好标的、账户规则、资产类别区间和 security type 规则会影响推荐排序。",
    detail:
      "排除规则优先级高于偏好规则；偏好标的不会无条件买入，仍要满足目标配置、账户/税务/FX、数据新鲜度和身份匹配。大臣必须解释规则影响，不应直接建议绕过约束。",
  },
  {
    id: "project-feature-daily-intelligence",
    label: "功能说明：Loo国今日秘闻",
    pages: ["overview", "recommendations", "security-detail"],
    triggers: [/秘闻|新闻|论坛|外部信息|external|research|情报|可信度|相关度/i],
    value: "今日秘闻是缓存后的精选情报层，不是页面加载时实时爬新闻或论坛。",
    detail:
      "总览显示全局精选，推荐页显示折叠摘要，标的详情只显示同一 securityId 或完整 symbol/exchange/currency listing 的情报。缺失情报应显示边界，而不是 ticker-only 混入。",
  },
  {
    id: "project-feature-import",
    label: "功能说明：手动导入",
    pages: ["import"],
    triggers: [/导入|import|csv|新增账户|新增持仓|搜索标的|验证/i],
    value: "移动端导入保留手动/引导式账户和持仓导入，不做 CSV MVP。",
    detail:
      "导入时标的搜索/验证必须显示 symbol、exchange/listing market、currency，避免 US common share 和 CAD listing/CDR 混淆。",
  },
  {
    id: "project-feature-data-freshness",
    label: "功能说明：数据新鲜度",
    pages: [
      "overview",
      "portfolio",
      "account-detail",
      "holding-detail",
      "security-detail",
      "settings",
    ],
    triggers: [/新鲜|stale|缓存|刷新|provider|行情|fx|汇率|真实数据|mock|fallback/i],
    value: "行情、历史价格、FX 和外部情报都必须显示来源、新鲜度和 fallback 边界。",
    detail:
      "报价使用 native trading currency 存储，CAD 汇总只在显示/聚合时通过独立 FX cache 折算。刷新失败不能清空旧价格，也不能把参考曲线说成真实走势。",
  },
  {
    id: "project-feature-minister",
    label: "功能说明：AI 大臣",
    pages: [
      "overview",
      "portfolio",
      "account-detail",
      "holding-detail",
      "security-detail",
      "portfolio-health",
      "recommendations",
      "import",
      "settings",
      "spending",
    ],
    triggers: [/大臣|ai|gpt|chatgpt|问答|助手|管家|解释|怎么用|下一步/i],
    value: "AI 大臣是跨页面 Loo国管家，用当前页面 DTO、用户偏好、推荐、缓存分析和对话上下文回答问题。",
    detail:
      "大臣可以解释功能、数据、推荐、偏好和下一步；它不能自动修改真实数据，不能在未启用 worker/cache 策略时实时抓新闻/论坛，投资相关回答必须保留免责声明。",
  },
];

export function searchLooMinisterProjectKnowledge(input: {
  page: LooMinisterPageContext["page"];
  question: string;
  limit?: number;
}): LooMinisterFact[] {
  const selected = looMinisterProjectKnowledgeItems.filter(
    (item) =>
      item.pages.includes(input.page) ||
      item.triggers.some((trigger) => trigger.test(input.question)),
  );
  const unique = new Map<string, (typeof looMinisterProjectKnowledgeItems)[number]>();
  for (const item of selected) {
    unique.set(item.id, item);
  }

  return Array.from(unique.values())
    .slice(0, input.limit ?? 5)
    .map((item) => ({
      id: item.id,
      label: item.label,
      value: item.value.slice(0, 240),
      detail: item.detail.slice(0, 600),
      source: "system",
    }));
}

export function inferLooMinisterProjectKnowledgeIntent(input: {
  page: LooMinisterPageContext["page"];
  question: string;
}) {
  const text = input.question.toLowerCase();
  if (/对比|比较|相比|versus|compare| vs\.? /.test(text)) {
    return "comparison";
  }
  if (/买入|适合|适配|候选|analysis|analysis request|快扫/.test(text)) {
    return "candidate-fit";
  }
  if (/health|健康|评分|风险护栏|偏离|再平衡/.test(text)) {
    return "health";
  }
  if (/推荐|recommend|v2|v3|候选|优先/.test(text)) {
    return "recommendation";
  }
  if (/偏好|preference|factor|买房|税务|现金/.test(text)) {
    return "preference";
  }
  if (/秘闻|新闻|论坛|外部信息|external|research/.test(text)) {
    return "daily-intelligence";
  }
  if (/总资产|组合|持仓|账户|配置|allocation|portfolio/.test(text)) {
    return `page:${input.page}`;
  }
  return `page:${input.page}`;
}
