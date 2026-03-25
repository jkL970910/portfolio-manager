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
    "wealthsimple-generic": { zh: "Wealthsimple 通用对照", en: "Wealthsimple Generic" },
    "questrade-generic": { zh: "Questrade 通用对照", en: "Questrade Generic" },
    "auto-detect": { zh: "根据表头自动识别", en: "Auto-detect from headers" }
  };

  const value = map[key];
  return value ? pick(language, value.zh, value.en) : fallbackLabel;
}

export function getImportFieldMeta(field: string, language: DisplayLanguage) {
  const map: Record<string, { zh: string; en: string; helpZh: string; helpEn: string }> = {
    record_type: {
      zh: "记录类型",
      en: "Record type",
      helpZh: "告诉系统这一行是账户、持仓还是交易流水。",
      helpEn: "Tells the system whether the row is an account, holding, or transaction."
    },
    account_key: {
      zh: "账户编号",
      en: "Account key",
      helpZh: "把同一个账户下的多行数据串起来。",
      helpEn: "Links rows that belong to the same account."
    },
    account_type: {
      zh: "账户类型",
      en: "Account type",
      helpZh: "例如 TFSA、RRSP、FHSA 或应税账户。",
      helpEn: "Examples: TFSA, RRSP, FHSA, or taxable."
    },
    institution: {
      zh: "机构",
      en: "Institution",
      helpZh: "账户所在券商或银行名称。",
      helpEn: "The broker or bank name."
    },
    account_nickname: {
      zh: "账户昵称",
      en: "Account nickname",
      helpZh: "方便你自己认出这是哪个账户。",
      helpEn: "A label to help you recognize the account."
    },
    account_currency: {
      zh: "账户币种",
      en: "Account currency",
      helpZh: "这个账户平时记账的主要币种。",
      helpEn: "The account's main reporting currency."
    },
    market_value: {
      zh: "总市值",
      en: "Market value",
      helpZh: "如果文件已经给了总值，系统会优先直接用它。",
      helpEn: "If the file already includes total value, the system uses it directly."
    },
    contribution_room_cad: {
      zh: "剩余额度（CAD）",
      en: "Contribution room (CAD)",
      helpZh: "注册账户还剩多少可继续放钱的空间。",
      helpEn: "Remaining contribution room for registered accounts."
    },
    symbol: {
      zh: "代码",
      en: "Symbol",
      helpZh: "证券代码，例如 XEQT 或 ZAG。",
      helpEn: "Ticker symbol, for example XEQT or ZAG."
    },
    name: {
      zh: "名称",
      en: "Name",
      helpZh: "证券或持仓的名称。",
      helpEn: "The security or holding name."
    },
    asset_class: {
      zh: "资产类别",
      en: "Asset class",
      helpZh: "例如加拿大股票、固定收益、现金。",
      helpEn: "Examples: Canadian Equity, Fixed Income, or Cash."
    },
    sector: {
      zh: "行业",
      en: "Sector",
      helpZh: "可选字段，用来帮助你看行业集中度。",
      helpEn: "Optional field for sector concentration analysis."
    },
    holding_currency: {
      zh: "持仓币种",
      en: "Holding currency",
      helpZh: "这笔持仓实际交易和计价的币种。",
      helpEn: "The trading or listing currency of the holding."
    },
    quantity: {
      zh: "份额 / 股数",
      en: "Quantity",
      helpZh: "你手上到底持有多少份。",
      helpEn: "How many shares or units you hold."
    },
    avg_cost_per_share: {
      zh: "平均成本 / 每股",
      en: "Avg cost / share",
      helpZh: "平均买入成本，系统可用它推导成本基础。",
      helpEn: "Average purchase cost per share."
    },
    cost_basis: {
      zh: "成本基础",
      en: "Cost basis",
      helpZh: "如果文件直接给了总成本，也可以对到这里。",
      helpEn: "Use this when the file already provides total cost basis."
    },
    last_price: {
      zh: "最近价格",
      en: "Last price",
      helpZh: "用来配合股数推算总市值。",
      helpEn: "Used with quantity to estimate total market value."
    },
    weight_pct: {
      zh: "权重占比",
      en: "Weight %",
      helpZh: "可选字段，表示这笔持仓在账户里的占比。",
      helpEn: "Optional share of the account represented by the holding."
    },
    gain_loss_pct: {
      zh: "盈亏比例",
      en: "Gain / loss %",
      helpZh: "可选字段，系统也能自己推算。",
      helpEn: "Optional field; the system can also derive it."
    },
    booked_at: {
      zh: "入账时间",
      en: "Booked at",
      helpZh: "交易或流水真正记账的日期。",
      helpEn: "The booking date of the transaction."
    },
    merchant: {
      zh: "商户",
      en: "Merchant",
      helpZh: "这笔消费是付给谁的。",
      helpEn: "Who the transaction was paid to."
    },
    category: {
      zh: "分类",
      en: "Category",
      helpZh: "例如吃饭、交通、房租。",
      helpEn: "Examples: food, transport, rent."
    },
    amount_cad: {
      zh: "金额（CAD）",
      en: "Amount (CAD)",
      helpZh: "系统目前按 CAD 读这笔流水金额。",
      helpEn: "The spending flow amount currently expected in CAD."
    },
    direction: {
      zh: "方向",
      en: "Direction",
      helpZh: "告诉系统这是流入还是流出。",
      helpEn: "Marks the row as inflow or outflow."
    }
  };

  const value = map[field];
  if (!value) {
    return {
      label: field,
      help: pick(language, "这个字段保持原样显示。", "This field is shown as-is.")
    };
  }

  return {
    label: pick(language, value.zh, value.en),
    help: pick(language, value.helpZh, value.helpEn)
  };
}
