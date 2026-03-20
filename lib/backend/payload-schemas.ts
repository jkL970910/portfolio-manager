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

export const registerUserInputSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
});

export const importJobCreateSchema = z.object({
  fileName: z.string().trim().min(3).max(255),
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
  quantity: z.number().positive().max(1_000_000_000).nullable().optional(),
  avgCostPerShareCad: z.number().min(0).max(1_000_000).nullable().optional(),
  costBasisCad: z.number().min(0).max(1_000_000_000).nullable().optional(),
  lastPriceCad: z.number().min(0).max(1_000_000).nullable().optional(),
  marketValueCad: z.number().min(0).max(1_000_000_000).nullable().optional()
}).superRefine((value, context) => {
  if ((value.marketValueCad ?? 0) <= 0 && !((value.quantity ?? 0) > 0 && (value.lastPriceCad ?? 0) > 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["marketValueCad"],
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
  contributionRoomCad: z.number().min(0).max(1000000).optional().default(0),
  initialMarketValueCad: z.number().min(0).max(100000000).optional().default(0),
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

export type PreferenceProfileInputPayload = z.infer<typeof preferenceProfileInputSchema>;
export type RegisterUserInputPayload = z.infer<typeof registerUserInputSchema>;
export type ImportJobCreatePayload = z.infer<typeof importJobCreateSchema>;
export type ImportMappingPresetCreatePayload = z.infer<typeof importMappingPresetCreateSchema>;
export type ImportMappingPresetUpdatePayload = z.infer<typeof importMappingPresetUpdateSchema>;
export type GuidedImportCreatePayload = z.infer<typeof guidedImportCreateSchema>;
export type RecommendationRunCreatePayload = z.infer<typeof recommendationRunCreateSchema>;
