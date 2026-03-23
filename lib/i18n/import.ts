import type { DisplayLanguage } from "@/lib/i18n/ui";
import { pick } from "@/lib/i18n/ui";

export function getImportMappingGroupTitle(title: string, language: DisplayLanguage) {
  const map: Record<string, { zh: string; en: string }> = {
    Core: { zh: "核心字段", en: "Core" },
    "Account rows": { zh: "账户行", en: "Account rows" },
    "Holding rows": { zh: "持仓行", en: "Holding rows" },
    "Transaction rows": { zh: "交易流水行", en: "Transaction rows" }
  };

  const value = map[title];
  return value ? pick(language, value.zh, value.en) : title;
}

export function getImportPresetLabel(key: string, fallbackLabel: string, language: DisplayLanguage) {
  const map: Record<string, { zh: string; en: string }> = {
    canonical: { zh: "标准 CSV 模板", en: "Canonical CSV" },
    "wealthsimple-generic": { zh: "Wealthsimple 通用映射", en: "Wealthsimple Generic" },
    "questrade-generic": { zh: "Questrade 通用映射", en: "Questrade Generic" },
    "auto-detect": { zh: "根据表头自动识别", en: "Auto-detect from headers" }
  };

  const value = map[key];
  return value ? pick(language, value.zh, value.en) : fallbackLabel;
}
