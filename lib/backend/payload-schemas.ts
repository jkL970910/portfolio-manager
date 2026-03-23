import { z } from "zod";

const allocationTargetSchema = z.object({
  assetClass: z.string().min(1),
  targetPct: z.number().int().min(0).max(100)
});

export const preferenceProfileInputSchema = z.object({
  riskProfile: z.enum(["Conservative", "Balanced", "Growth"]),
  targetAllocation: z.array(allocationTargetSchema).min(1),
  accountFundingPriority: z.array(z.enum(["TFSA", "RRSP", "FHSA", "Taxable"]))
    .min(1)
    .refine((items) => new Set(items).size === items.length, "Account priorities must be unique."),
  taxAwarePlacement: z.boolean(),
  cashBufferTargetCad: z.number().min(0).max(1000000),
  transitionPreference: z.enum(["stay-close", "gradual", "direct"]),
  recommendationStrategy: z.enum(["tax-aware", "target-first", "balanced"]),
  rebalancingTolerancePct: z.number().int().min(0).max(50),
  watchlistSymbols: z.array(z.string().trim().min(1).max(32)).max(20)
}).superRefine((value, context) => {
  const total = value.targetAllocation.reduce((sum, target) => sum + target.targetPct, 0);
  if (total !== 100) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetAllocation"],
      message: "Target allocation must sum to 100."
    });
  }
});

export const displayCurrencyInputSchema = z.object({
  currency: z.enum(["CAD", "USD"])
});

export const displayLanguageInputSchema = z.object({
  language: z.enum(["zh", "en"])
});

export const registerUserInputSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  mode: z.enum(["standard", "loo-zh"]).default("standard"),
  gender: z.enum(["male", "female"]).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  acceptLooTerms: z.boolean().optional(),
  displayLanguage: z.enum(["zh", "en"]).optional()
}).superRefine((value, context) => {
  if (value.mode === "loo-zh") {
    if (!value.gender) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["gender"], message: "Gender is required for Loo citizenship registration." });
    }
    if (!value.birthDate) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["birthDate"], message: "Birth date is required for Loo citizenship registration." });
    }
    if (value.acceptLooTerms !== true) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["acceptLooTerms"], message: "Loo terms must be accepted." });
    }
  }
});

export const citizenOverrideInputSchema = z.object({
  rank: z.enum(["lowly-ox", "base-loo", "citizen", "general", "emperor"]).nullable().optional(),
  addressTier: z.enum(["cowshed", "suburbs", "city", "palace-gate", "bedchamber"]).nullable().optional(),
  idCode: z.string().trim().min(4).max(32).nullable().optional()
}).refine(
  (value) => value.rank !== undefined || value.addressTier !== undefined || value.idCode !== undefined,
  "At least one citizen override field must be provided."
);

export const importJobCreateSchema = z.object({
  fileName: z.string().trim().min(3).max(255),
  workflow: z.enum(["portfolio", "spending"]).default("portfolio"),
  sourceType: z.enum(["csv"]).default("csv"),
  csvContent: z.string().min(1).max(2_000_000).optional(),
  fieldMapping: z.record(z.string().min(1), z.string().min(1)).optional(),
  symbolCorrections: z.record(
    z.string().trim().min(1).max(32),
    z.object({
      symbol: z.string().trim().min(1).max(32),
      name: z.string().trim().min(1).max(160).optional()
    })
  ).optional(),
  importMode: z.enum(["replace", "merge"]).default("replace"),
  dryRun: z.boolean().optional().default(false)
});

export const importMappingPresetCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sourceType: z.enum(["csv"]).default("csv"),
  mapping: z.record(z.string().min(1), z.string().min(1)).refine(
    (value) => Object.keys(value).length > 0,
    "At least one mapped field is required."
  )
});

export const importMappingPresetUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  mapping: z.record(z.string().min(1), z.string().min(1)).optional(),
  sourceType: z.enum(["csv"]).optional()
}).refine(
  (value) => value.name !== undefined || value.mapping !== undefined || value.sourceType !== undefined,
  "At least one preset field must be updated."
);

const guidedHoldingSchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  holdingName: z.string().trim().max(160).optional(),
  assetClass: z.string().trim().min(1).max(64),
  sector: z.string().trim().max(64).optional(),
  currency: z.enum(["CAD", "USD"]).default("CAD"),
  quantity: z.number().positive().max(1_000_000_000).nullable().optional(),
  avgCostPerShareAmount: z.number().min(0).max(1_000_000).nullable().optional(),
  costBasisAmount: z.number().min(0).max(1_000_000_000).nullable().optional(),
  lastPriceAmount: z.number().min(0).max(1_000_000).nullable().optional(),
  marketValueAmount: z.number().min(0).max(1_000_000_000).nullable().optional()
}).superRefine((value, context) => {
  if ((value.marketValueAmount ?? 0) <= 0 && !((value.quantity ?? 0) > 0 && (value.lastPriceAmount ?? 0) > 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["marketValueAmount"],
      message: "Each holding requires market value or quantity plus current price."
    });
  }
});

export const guidedImportCreateSchema = z.object({
  accountMode: z.enum(["new", "existing"]).default("new"),
  existingAccountId: z.string().uuid().optional(),
  accountType: z.enum(["TFSA", "RRSP", "FHSA", "Taxable"]),
  method: z.enum(["single-account-csv", "manual-entry", "continue-later"]),
  institution: z.string().trim().min(2).max(120),
  nickname: z.string().trim().min(2).max(120),
  currency: z.enum(["CAD", "USD"]).default("CAD"),
  contributionRoomCad: z.number().min(0).max(1000000).optional().default(0),
  initialMarketValueAmount: z.number().min(0).max(100000000).optional().default(0),
  holdings: z.array(guidedHoldingSchema).max(100).optional().default([])
}).superRefine((value, context) => {
  if (value.accountMode === "existing" && !value.existingAccountId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["existingAccountId"], message: "Select an existing account." });
  }
  if (value.method === "manual-entry") {
    if ((value.holdings?.length ?? 0) === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["holdings"], message: "Manual entry requires at least one holding." });
    }
  }
});

export const recommendationRunCreateSchema = z.object({
  contributionAmountCad: z.number().positive().max(1000000)
});

export const guidedAllocationDraftSchema = z.object({
  answers: z.object({
    goal: z.enum(["retirement", "home", "wealth", "capital-preservation"]),
    horizon: z.enum(["short", "medium", "long"]),
    volatility: z.enum(["low", "medium", "high"]),
    priority: z.enum(["tax-efficiency", "balanced", "stay-close"]),
    cashNeed: z.enum(["low", "medium", "high"])
  }),
  suggestedProfile: z.object({
    riskProfile: z.enum(["Conservative", "Balanced", "Growth"]),
    targetAllocation: z.array(allocationTargetSchema).min(1),
    accountFundingPriority: z.array(z.enum(["TFSA", "RRSP", "FHSA", "Taxable"]))
      .min(1)
      .refine((items) => new Set(items).size === items.length, "Account priorities must be unique."),
    taxAwarePlacement: z.boolean(),
    cashBufferTargetCad: z.number().min(0).max(1000000),
    transitionPreference: z.enum(["stay-close", "gradual", "direct"]),
    recommendationStrategy: z.enum(["tax-aware", "target-first", "balanced"]),
    rebalancingTolerancePct: z.number().int().min(0).max(50)
  }).superRefine((value, context) => {
    const total = value.targetAllocation.reduce((sum, target) => sum + target.targetPct, 0);
    if (total !== 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetAllocation"],
        message: "Target allocation must sum to 100."
      });
    }
  }),
  assumptions: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
  rationale: z.array(z.string().trim().min(1).max(240)).min(1).max(12)
});

export type PreferenceProfileInputPayload = z.infer<typeof preferenceProfileInputSchema>;
export type DisplayCurrencyInputPayload = z.infer<typeof displayCurrencyInputSchema>;
export type DisplayLanguageInputPayload = z.infer<typeof displayLanguageInputSchema>;
export type RegisterUserInputPayload = z.infer<typeof registerUserInputSchema>;
export type ImportJobCreatePayload = z.infer<typeof importJobCreateSchema>;
export type ImportMappingPresetCreatePayload = z.infer<typeof importMappingPresetCreateSchema>;
export type ImportMappingPresetUpdatePayload = z.infer<typeof importMappingPresetUpdateSchema>;
export type GuidedImportCreatePayload = z.infer<typeof guidedImportCreateSchema>;
export type RecommendationRunCreatePayload = z.infer<typeof recommendationRunCreateSchema>;
export type GuidedAllocationDraftPayload = z.infer<typeof guidedAllocationDraftSchema>;
export type CitizenOverrideInputPayload = z.infer<typeof citizenOverrideInputSchema>;
