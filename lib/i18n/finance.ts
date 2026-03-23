import type {
  AccountType,
  PreferenceProfile,
  RiskProfile
} from "@/lib/backend/models";
import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

export function getAssetClassLabel(assetClass: string, language: DisplayLanguage) {
  const map: Record<string, { zh: string; en: string }> = {
    "Canadian Equity": { zh: "加拿大股票", en: "Canadian Equity" },
    "US Equity": { zh: "美国股票", en: "US Equity" },
    "International Equity": { zh: "国际股票", en: "International Equity" },
    "Fixed Income": { zh: "固定收益", en: "Fixed Income" },
    Cash: { zh: "现金", en: "Cash" },
    "Multi-sector": { zh: "多行业", en: "Multi-sector" },
    Other: { zh: "其他", en: "Other" }
  };

  const value = map[assetClass];
  return value ? pick(language, value.zh, value.en) : assetClass;
}

export function getAccountTypeLabel(type: AccountType, language: DisplayLanguage) {
  const map: Record<AccountType, { zh: string; en: string }> = {
    TFSA: { zh: "TFSA", en: "TFSA" },
    RRSP: { zh: "RRSP", en: "RRSP" },
    FHSA: { zh: "FHSA", en: "FHSA" },
    Taxable: { zh: "应税账户", en: "Taxable" }
  };
  return pick(language, map[type].zh, map[type].en);
}

export function getRiskProfileLabel(value: RiskProfile, language: DisplayLanguage) {
  const map = {
    Conservative: { zh: "保守型", en: "Conservative" },
    Balanced: { zh: "平衡型", en: "Balanced" },
    Growth: { zh: "成长型", en: "Growth" }
  } as const;
  return pick(language, map[value].zh, map[value].en);
}

export function getTransitionPreferenceLabel(
  value: PreferenceProfile["transitionPreference"],
  language: DisplayLanguage
) {
  const map = {
    "stay-close": { zh: "尽量贴近当前持仓", en: "Stay close to current holdings" },
    gradual: { zh: "逐步向目标过渡", en: "Gradually transition to target" },
    direct: { zh: "更直接地向目标靠拢", en: "Move more directly toward target" }
  } as const;
  return pick(language, map[value].zh, map[value].en);
}

export function getRecommendationStrategyLabel(
  value: PreferenceProfile["recommendationStrategy"],
  language: DisplayLanguage
) {
  const map = {
    balanced: { zh: "平衡型", en: "Balanced" },
    "tax-aware": { zh: "税务感知优先", en: "Tax-aware" },
    "target-first": { zh: "目标配置优先", en: "Target-first" }
  } as const;
  return pick(language, map[value].zh, map[value].en);
}

export function getSectorLabel(sector: string, language: DisplayLanguage) {
  const map: Record<string, { zh: string; en: string }> = {
    Technology: { zh: "科技", en: "Technology" },
    Financials: { zh: "金融", en: "Financials" },
    Healthcare: { zh: "医疗保健", en: "Healthcare" },
    Energy: { zh: "能源", en: "Energy" },
    Industrials: { zh: "工业", en: "Industrials" },
    Utilities: { zh: "公用事业", en: "Utilities" },
    Materials: { zh: "原材料", en: "Materials" },
    RealEstate: { zh: "房地产", en: "Real Estate" },
    "Real Estate": { zh: "房地产", en: "Real Estate" },
    Consumer: { zh: "消费", en: "Consumer" },
    "Consumer Staples": { zh: "日常消费", en: "Consumer Staples" },
    "Consumer Discretionary": { zh: "可选消费", en: "Consumer Discretionary" },
    Communication: { zh: "通信", en: "Communication" },
    "Communication Services": { zh: "通信服务", en: "Communication Services" },
    "Multi-sector": { zh: "多行业", en: "Multi-sector" },
    Other: { zh: "其他", en: "Other" }
  };

  const value = map[sector];
  return value ? pick(language, value.zh, value.en) : sector;
}

export function getCategoryLabel(category: string, language: DisplayLanguage) {
  const map: Record<string, { zh: string; en: string }> = {
    Groceries: { zh: "日常采购", en: "Groceries" },
    Dining: { zh: "餐饮", en: "Dining" },
    Rent: { zh: "房租", en: "Rent" },
    Housing: { zh: "住房", en: "Housing" },
    Payroll: { zh: "工资入账", en: "Payroll" },
    Income: { zh: "收入", en: "Income" },
    Transport: { zh: "交通", en: "Transport" },
    Utilities: { zh: "水电网", en: "Utilities" },
    Travel: { zh: "出行", en: "Travel" },
    Shopping: { zh: "购物", en: "Shopping" },
    Healthcare: { zh: "医疗", en: "Healthcare" },
    Entertainment: { zh: "娱乐", en: "Entertainment" },
    Investment: { zh: "投资", en: "Investment" },
    Transfer: { zh: "转账", en: "Transfer" },
    Other: { zh: "其他", en: "Other" }
  };

  const value = map[category];
  return value ? pick(language, value.zh, value.en) : category;
}

export function getMerchantLabel(merchant: string, language: DisplayLanguage) {
  const map: Record<string, { zh: string; en: string }> = {
    Payroll: { zh: "工资入账", en: "Payroll" },
    Rent: { zh: "房租", en: "Rent" },
    Employer: { zh: "雇主入账", en: "Employer" }
  };

  const value = map[merchant];
  return value ? pick(language, value.zh, value.en) : merchant;
}
