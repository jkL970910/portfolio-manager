import { getExternalResearchPolicy } from "@/lib/backend/portfolio-external-research";
import { getMarketDataConfig } from "@/lib/market-data/config";

export type DataFreshnessPolicyId =
  | "quote"
  | "fx"
  | "history"
  | "security-identity"
  | "external-intelligence";

export interface MobileDataFreshnessPolicyItem {
  id: DataFreshnessPolicyId;
  label: string;
  ttlSeconds: number;
  ttlLabel: string;
  sourceLabel: string;
  usageLabel: string;
  staleBehaviorLabel: string;
  workerTarget: boolean;
  userActionLabel: string;
}

export interface MobileDataFreshnessPolicy {
  generatedAt: string;
  items: MobileDataFreshnessPolicyItem[];
  summary: {
    quoteTtlLabel: string;
    fxTtlLabel: string;
    historyTtlLabel: string;
    externalIntelligenceTtlLabel: string;
    workerBoundaryLabel: string;
  };
}

function formatDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} 分钟`;
  }
  if (seconds < 86400) {
    return `${Math.round(seconds / 3600)} 小时`;
  }
  return `${Math.round(seconds / 86400)} 天`;
}

function policyItem(args: Omit<MobileDataFreshnessPolicyItem, "ttlLabel">) {
  return {
    ...args,
    ttlLabel: formatDuration(args.ttlSeconds),
  };
}

export function getMobileDataFreshnessPolicy(): MobileDataFreshnessPolicy {
  const marketData = getMarketDataConfig();
  const externalResearch = getExternalResearchPolicy();
  const quoteTtlSeconds = marketData.quoteCacheTtlSeconds;
  const fxTtlSeconds = marketData.fxCacheTtlSeconds;
  const historyTtlSeconds = marketData.quoteCacheTtlSeconds;
  const externalTtlSeconds = externalResearch.defaultTtlSeconds;

  const items: MobileDataFreshnessPolicyItem[] = [
    policyItem({
      id: "quote",
      label: "标的报价",
      ttlSeconds: quoteTtlSeconds,
      sourceLabel: "行情 provider + 本地报价缓存",
      usageLabel: "持仓市值、标的详情、智能快扫、推荐适配都会读取它。",
      staleBehaviorLabel:
        "过期后仍可用于方向解释，但下单前应重新刷新报价。",
      workerTarget: true,
      userActionLabel: "可在设置页手动刷新；后续由后台 worker 定时补齐。",
    }),
    policyItem({
      id: "fx",
      label: "FX 汇率",
      ttlSeconds: fxTtlSeconds,
      sourceLabel: "独立 FX 缓存，不跟随单个标的报价刷新",
      usageLabel: "只在 CAD/USD 汇总展示和总资产折算时使用。",
      staleBehaviorLabel:
        "过期时会标记为可能过期；不会改变持仓原始交易币种。",
      workerTarget: true,
      userActionLabel: "组合刷新会尝试更新；后续由 worker 单独维护。",
    }),
    policyItem({
      id: "history",
      label: "价格历史",
      ttlSeconds: historyTtlSeconds,
      sourceLabel: "按 symbol + exchange + currency + securityId 存储",
      usageLabel: "用于标的走势图、组合历史曲线、AI 数据新鲜度判断。",
      staleBehaviorLabel:
        "历史不足时页面必须显示参考/缓存边界，不能伪装成真实走势。",
      workerTarget: true,
      userActionLabel: "单标的刷新和组合刷新会写入；后续由 worker 定时补齐。",
    }),
    policyItem({
      id: "security-identity",
      label: "标的身份",
      ttlSeconds: marketData.resolveCacheTtlSeconds,
      sourceLabel: "搜索/resolve provider + 本地 identity registry",
      usageLabel: "用于区分美股正股、CAD 版本、CDR、ETF listing。",
      staleBehaviorLabel:
        "身份不完整时宁可要求确认，也不能 ticker-only 混合 CAD/USD listing。",
      workerTarget: false,
      userActionLabel: "导入和 Discover 会触发校验；后续继续补 registry 修复工具。",
    }),
    policyItem({
      id: "external-intelligence",
      label: "外部情报/今日秘闻",
      ttlSeconds: externalTtlSeconds,
      sourceLabel: "已缓存智能分析和外部研究文档",
      usageLabel: "用于推荐 V3 overlay、今日秘闻、大臣问答补充。",
      staleBehaviorLabel:
        "未启用 live provider 前不会自动抓新闻/论坛；过期资料只作背景参考。",
      workerTarget: true,
      userActionLabel: "当前只允许手动或 worker 入队，页面加载不得自动付费抓取。",
    }),
  ];

  return {
    generatedAt: new Date().toISOString(),
    items,
    summary: {
      quoteTtlLabel: formatDuration(quoteTtlSeconds),
      fxTtlLabel: formatDuration(fxTtlSeconds),
      historyTtlLabel: formatDuration(historyTtlSeconds),
      externalIntelligenceTtlLabel: formatDuration(externalTtlSeconds),
      workerBoundaryLabel:
        "行情、FX、历史和外部情报都应走 worker/cache；手机页面只读状态或手动确认触发。",
    },
  };
}
