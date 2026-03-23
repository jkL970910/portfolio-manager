import type { CitizenAddressTier, CitizenAvatarType, CitizenGender, CitizenRank, DisplayLanguage } from "@/lib/backend/models";
import { pick } from "@/lib/i18n/ui";

export function getCitizenRankLabel(value: CitizenRank, language: DisplayLanguage) {
  const labels: Record<CitizenRank, { zh: string; en: string }> = {
    "lowly-ox": { zh: "低等牛", en: "Stable Ox" },
    "base-loo": { zh: "原皮Loo", en: "Base Loo" },
    citizen: { zh: "Loo国子民", en: "Citizen of Loo" },
    general: { zh: "Loo皇大将军", en: "Grand General of Loo" },
    emperor: { zh: "Loo皇", en: "Loo Emperor" }
  };
  return pick(language, labels[value].zh, labels[value].en);
}

export function getCitizenAddressLabel(value: CitizenAddressTier, language: DisplayLanguage) {
  const labels: Record<CitizenAddressTier, { zh: string; en: string }> = {
    cowshed: { zh: "牛棚", en: "Outer Barn" },
    suburbs: { zh: "Loo国郊区", en: "Loo Suburbs" },
    city: { zh: "Loo国城内", en: "Loo City" },
    "palace-gate": { zh: "Loo皇殿前", en: "Before the Palace Gate" },
    bedchamber: { zh: "Loo皇寝宫", en: "Emperor's Chamber" }
  };
  return pick(language, labels[value].zh, labels[value].en);
}

export function getCitizenGenderLabel(value: CitizenGender | null, language: DisplayLanguage) {
  if (!value) {
    return pick(language, "未设定", "Not set");
  }
  return value === "male" ? pick(language, "男", "Male") : pick(language, "女", "Female");
}

export function getCitizenAvatarAsset(value: CitizenAvatarType) {
  switch (value) {
    case "male":
      return "citizenMale";
    case "female":
      return "citizenFemale";
    case "emperor":
      return "looEmperor";
    default:
      return "citizenDefault";
  }
}

export function getCitizenRankVisualSrc(value: CitizenRank) {
  const map: Record<CitizenRank, string> = {
    "lowly-ox": "/mascot/rank-lowly-ox.jpg",
    "base-loo": "/mascot/rank-base-loo.jpg",
    citizen: "/mascot/rank-citizen.jpg",
    general: "/mascot/rank-general.jpg",
    emperor: "/mascot/Loo_King.jpg"
  };

  return map[value];
}

export function getCitizenAddressVisualSrc(value: CitizenAddressTier) {
  const map: Partial<Record<CitizenAddressTier, string>> = {
    cowshed: "/mascot/address-lowly-ox.jpg",
    suburbs: "/mascot/address-base-loo.jpg",
    city: "/mascot/address-citizen.jpg",
    "palace-gate": "/mascot/address-general.jpg",
    bedchamber: "/mascot/address-emperor.jpg"
  };

  return map[value] ?? null;
}
