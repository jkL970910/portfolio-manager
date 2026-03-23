export type DisplayLanguage = "zh" | "en";

export const DISPLAY_LANGUAGE_COOKIE = "pm_display_language";

export function isDisplayLanguage(value: string | null | undefined): value is DisplayLanguage {
  return value === "zh" || value === "en";
}

export function pick<T>(language: DisplayLanguage, zh: T, en: T): T {
  return language === "zh" ? zh : en;
}

export function buildMetadataCopy(language: DisplayLanguage) {
  return {
    title: pick(language, "Loo国的财富宝库", "Portfolio Manager"),
    description: pick(
      language,
      "一个更柔和的玻璃质感财富总览，用来看组合、消费与配置建议。",
      "A softer glassmorphism wealth dashboard for portfolio analysis, spending visibility, and recommendation workflows."
    )
  };
}
