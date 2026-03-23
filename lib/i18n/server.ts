import { cookies } from "next/headers";
import { DISPLAY_LANGUAGE_COOKIE, type DisplayLanguage, isDisplayLanguage } from "@/lib/i18n/ui";

export async function getRequestDisplayLanguage(): Promise<DisplayLanguage> {
  const store = await cookies();
  const cookieValue = store.get(DISPLAY_LANGUAGE_COOKIE)?.value;
  return isDisplayLanguage(cookieValue) ? cookieValue : "zh";
}
