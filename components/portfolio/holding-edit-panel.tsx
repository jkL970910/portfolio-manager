"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PencilLine, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DisplayLanguage } from "@/lib/backend/models";
import type { PortfolioHoldingDetailData } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiErrorMessage, safeJson } from "@/lib/client/api";
import { pick } from "@/lib/i18n/ui";

const FIELD_CLASS_NAME =
  "w-full rounded-[20px] border border-white/58 bg-white/56 px-4 py-3 text-sm outline-none backdrop-blur-xl";

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function HoldingEditPanel({
  detail,
  language
}: {
  detail: PortfolioHoldingDetailData;
  language: DisplayLanguage;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [status, setStatus] = useState("");
  const [name, setName] = useState(detail.editContext.current.name);
  const [accountId, setAccountId] = useState(detail.holding.accountId);
  const [currency, setCurrency] = useState<"CAD" | "USD">(detail.editContext.current.currency);
  const [quantity, setQuantity] = useState(detail.editContext.current.quantity?.toString() ?? "");
  const [avgCost, setAvgCost] = useState(detail.editContext.current.avgCostPerShareAmount?.toString() ?? "");
  const [costBasis, setCostBasis] = useState(detail.editContext.current.costBasisAmount?.toString() ?? "");
  const [lastPrice, setLastPrice] = useState(detail.editContext.current.lastPriceAmount?.toString() ?? "");
  const [marketValue, setMarketValue] = useState(detail.editContext.current.marketValueAmount?.toString() ?? "");
  const [costBasisTouched, setCostBasisTouched] = useState(false);
  const [marketValueTouched, setMarketValueTouched] = useState(false);
  const [assetClassOverride, setAssetClassOverride] = useState(detail.editContext.current.assetClassOverride ?? "");
  const [sectorOverride, setSectorOverride] = useState(detail.editContext.current.sectorOverride ?? "");
  const [securityTypeOverride, setSecurityTypeOverride] = useState(detail.editContext.current.securityTypeOverride ?? "");
  const [exchangeOverride, setExchangeOverride] = useState(detail.editContext.current.exchangeOverride ?? "");
  const [marketSectorOverride, setMarketSectorOverride] = useState(detail.editContext.current.marketSectorOverride ?? "");

  const selectedAccountDetail = useMemo(
    () => detail.editContext.accountOptions.find((option) => option.value === accountId)?.detail,
    [accountId, detail.editContext.accountOptions]
  );

  useEffect(() => {
    const parsedQuantity = toNullableNumber(quantity);
    const parsedAvgCost = toNullableNumber(avgCost);
    if (!costBasisTouched && parsedQuantity != null && parsedAvgCost != null) {
      setCostBasis(String(Number((parsedQuantity * parsedAvgCost).toFixed(2))));
    }
  }, [avgCost, costBasisTouched, quantity]);

  useEffect(() => {
    const parsedQuantity = toNullableNumber(quantity);
    const parsedLastPrice = toNullableNumber(lastPrice);
    if (!marketValueTouched && parsedQuantity != null && parsedLastPrice != null) {
      setMarketValue(String(Number((parsedQuantity * parsedLastPrice).toFixed(2))));
    }
  }, [lastPrice, marketValueTouched, quantity]);

  function saveChanges() {
    setStatus("");
    startTransition(async () => {
      const response = await fetch(`/api/portfolio/holdings/${detail.holding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          accountId,
          currency,
          quantity: toNullableNumber(quantity),
          avgCostPerShareAmount: toNullableNumber(avgCost),
          costBasisAmount: toNullableNumber(costBasis),
          lastPriceAmount: toNullableNumber(lastPrice),
          marketValueAmount: toNullableNumber(marketValue),
          assetClassOverride: assetClassOverride || null,
          sectorOverride: sectorOverride.trim() ? sectorOverride.trim() : null,
          securityTypeOverride: securityTypeOverride || null,
          exchangeOverride: exchangeOverride || null,
          marketSectorOverride: marketSectorOverride.trim() ? marketSectorOverride.trim() : null
        })
      });
      const payload = await safeJson(response);
      if (!response.ok) {
        setStatus(getApiErrorMessage(payload, pick(language, "保存这笔持仓失败。", "Failed to save the holding changes.")));
        return;
      }
      setStatus(
        pick(
          language,
          "这笔持仓已经保存，这笔仓位和所属账户总值都会一起刷新。",
          "The holding has been saved. This position and its account totals will refresh together."
        )
      );
      router.refresh();
    });
  }

  function deleteHolding() {
    setStatus("");
    startTransition(async () => {
      const response = await fetch(`/api/portfolio/holdings/${detail.holding.id}`, { method: "DELETE" });
      const payload = await safeJson(response);
      if (!response.ok) {
        setShowDeleteConfirm(false);
        setStatus(getApiErrorMessage(payload, pick(language, "删除这笔持仓失败。", "Failed to delete the holding.")));
        return;
      }
      router.push(detail.holding.accountHref);
      router.refresh();
    });
  }

  function clearClassificationOverrides() {
    setAssetClassOverride("");
    setSectorOverride("");
    setSecurityTypeOverride("");
    setExchangeOverride("");
    setMarketSectorOverride("");
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-5 px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "修改这笔持仓", "Edit this holding")}</p>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                {pick(
                  language,
                  "这里可以改数量、成本、当前价格、放在哪个账户，以及系统没认准的分类信息。",
                  "Update the amount, cost, current price, account placement, and any classification the system did not identify correctly."
                )}
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setOpen((current) => !current)} leadingIcon={<PencilLine className="h-4 w-4" />}>
              {open ? pick(language, "收起修改面板", "Hide editor") : pick(language, "打开修改面板", "Open editor")}
            </Button>
          </div>

          {!open ? null : (
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "先改这笔持仓最基础的信息", "Start with the basics")}</p>
                <div className="space-y-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "名称", "Name")}</span>
                    <input className={FIELD_CLASS_NAME} value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "放在哪个账户里", "Account")}</span>
                    <select className={FIELD_CLASS_NAME} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                      {detail.editContext.accountOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {selectedAccountDetail ? <p className="text-xs text-[color:var(--muted-foreground)]">{selectedAccountDetail}</p> : null}
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "币种", "Currency")}</span>
                    <select className={FIELD_CLASS_NAME} value={currency} onChange={(event) => setCurrency(event.target.value as "CAD" | "USD")}>
                      {detail.editContext.currencyOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-[22px] border border-white/55 bg-white/42 px-4 py-4 text-sm text-[color:var(--muted-foreground)]">
                    <p className="font-medium text-[color:var(--foreground)]">{pick(language, "系统最初是这么认的", "Original system read")}</p>
                    <div className="mt-2 space-y-1 text-sm leading-7">
                      <p>{pick(language, "资产类别", "Asset class")}: {detail.editContext.raw.assetClass}</p>
                      <p>{pick(language, "行业", "Sector")}: {detail.editContext.raw.sector}</p>
                      <p>{pick(language, "标的类型", "Security type")}: {detail.editContext.raw.securityType}</p>
                      <p>{pick(language, "交易所", "Exchange")}: {detail.editContext.raw.exchange}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "再改数量和金额", "Then adjust the amounts")}</p>
                <div className="space-y-4 rounded-[24px] border border-white/55 bg-white/36 p-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "数量", "Quantity")}</span>
                    <input className={FIELD_CLASS_NAME} value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "平均成本", "Average cost")}</span>
                    <input className={FIELD_CLASS_NAME} value={avgCost} onChange={(event) => setAvgCost(event.target.value)} inputMode="decimal" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "总成本", "Cost basis")}</span>
                    <input
                      className={FIELD_CLASS_NAME}
                      value={costBasis}
                      onChange={(event) => {
                        setCostBasisTouched(true);
                        setCostBasis(event.target.value);
                      }}
                      inputMode="decimal"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "当前价格", "Current price")}</span>
                    <input className={FIELD_CLASS_NAME} value={lastPrice} onChange={(event) => setLastPrice(event.target.value)} inputMode="decimal" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "当前总值", "Current value")}</span>
                    <input
                      className={FIELD_CLASS_NAME}
                      value={marketValue}
                      onChange={(event) => {
                        setMarketValueTouched(true);
                        setMarketValue(event.target.value);
                      }}
                      inputMode="decimal"
                    />
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      {pick(
                        language,
                        "如果你先填了数量和当前价格，这里会自动跟着算；如果你想自己指定总值，也可以直接改这里。",
                        "If quantity and current price are filled in, this value will auto-calculate. You can still override it manually if needed."
                      )}
                    </p>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "最后修正分类", "Finally fix classification")}</p>
                  <Button type="button" variant="secondary" onClick={clearClassificationOverrides}>
                    {pick(language, "清空手动修正", "Clear manual overrides")}
                  </Button>
                </div>
                <div className="space-y-4 rounded-[24px] border border-white/55 bg-white/36 p-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "资产类别", "Asset class")}</span>
                    <select className={FIELD_CLASS_NAME} value={assetClassOverride} onChange={(event) => setAssetClassOverride(event.target.value)}>
                      <option value="">{pick(language, "沿用系统原值", "Use system value")}</option>
                      {detail.editContext.assetClassOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "标的类型", "Security type")}</span>
                    <select className={FIELD_CLASS_NAME} value={securityTypeOverride} onChange={(event) => setSecurityTypeOverride(event.target.value)}>
                      <option value="">{pick(language, "沿用系统原值", "Use system value")}</option>
                      {detail.editContext.securityTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "交易所", "Exchange")}</span>
                    <select className={FIELD_CLASS_NAME} value={exchangeOverride} onChange={(event) => setExchangeOverride(event.target.value)}>
                      <option value="">{pick(language, "沿用系统原值", "Use system value")}</option>
                      {detail.editContext.exchangeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "行业", "Sector")}</span>
                    <input className={FIELD_CLASS_NAME} value={sectorOverride} onChange={(event) => setSectorOverride(event.target.value)} placeholder={detail.editContext.raw.sector} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{pick(language, "市场标签", "Market tag")}</span>
                    <input className={FIELD_CLASS_NAME} value={marketSectorOverride} onChange={(event) => setMarketSectorOverride(event.target.value)} placeholder={detail.editContext.raw.marketSector} />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={saveChanges} disabled={isPending} leadingIcon={isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : undefined}>
                  {isPending ? pick(language, "保存中...", "Saving...") : pick(language, "保存这笔持仓", "Save changes")}
                </Button>
                {(detail.editContext.current.assetClassOverride || detail.editContext.current.securityTypeOverride || detail.editContext.current.exchangeOverride)
                  ? <Badge variant="warning">{pick(language, "这笔持仓已经有过手动修正。", "Manual overrides already exist")}</Badge>
                  : null}
              </div>
            </div>
          )}

          <div className="rounded-[26px] border border-[rgba(213,101,120,0.18)] bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(248,224,232,0.3),rgba(255,239,224,0.18))] p-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{pick(language, "删除这笔持仓", "Delete this holding")}</p>
              <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(
                  language,
                  "如果你确认这笔已经不该留在当前账户里，就可以删掉它。删掉后会回到账户页，系统也会重新计算组合权重。",
                  "Delete the holding only if it should no longer exist in this account. After removal, you will return to the account page and the portfolio weights will be recalculated."
                )}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" variant="secondary" className="border-[rgba(213,101,120,0.26)] text-[color:var(--danger)]" onClick={() => setShowDeleteConfirm(true)} leadingIcon={<Trash2 className="h-4 w-4" />}>
                {pick(language, "删除这笔持仓", "Delete this holding")}
              </Button>
            </div>
          </div>

          {status ? <p className="text-sm text-[color:var(--muted-foreground)]">{status}</p> : null}
        </CardContent>
      </Card>

      {!showDeleteConfirm ? null : (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(42,34,57,0.18)] px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(246,218,230,0.36),rgba(221,232,255,0.28))] p-6 shadow-[0_24px_60px_rgba(110,103,130,0.18)]">
            <div className="space-y-3">
              <p className="text-lg font-semibold text-[color:var(--foreground)]">{pick(language, "确认删除这笔持仓？", "Delete this holding?")}</p>
              <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                {pick(
                  language,
                  "删除后会回到这个账户页。这笔持仓会从账户里移除，组合里的占比和健康提示也会一起更新。",
                  "After deletion, you will return to the account page. The position will be removed from the account and the portfolio weights will be recalculated."
                )}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                {pick(language, "取消", "Cancel")}
              </Button>
              <Button type="button" className="border-[rgba(213,101,120,0.2)] bg-[linear-gradient(135deg,rgba(213,101,120,0.92),rgba(240,143,178,0.82))]" onClick={deleteHolding} disabled={isPending} leadingIcon={isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}>
                {isPending ? pick(language, "删除中...", "Deleting...") : pick(language, "确认删除", "Confirm delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
