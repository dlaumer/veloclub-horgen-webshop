import { useState } from "react";
import { Calendar } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguage } from "@/contexts/LanguageContext";
import { fmtDateTime, fmtMoney, RangeMode } from "@/lib/adminFormat";
import { EnrichedOrder } from "@/types/admin";
import { readyBadge, pickedBadge, readyIcon, pickedIcon } from "@/components/admin/badges";
import { cn } from "@/lib/utils";

interface OrdersPanelProps {
  orders: EnrichedOrder[];
  stats: { count: number; revenue: number; notCollected: number };
  rangeMode: RangeMode;
  onRangeModeChange: (mode: RangeMode) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
  onSelectOrder: (id: string) => void;
}

export const OrdersPanel = ({
  orders,
  stats,
  rangeMode,
  onRangeModeChange,
  customFrom,
  customTo,
  onCustomFrom,
  onCustomTo,
  onSelectOrder,
}: OrdersPanelProps) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);

  const presets: { mode: RangeMode; label: string }[] = [
    { mode: "today", label: t("adminRangeToday") },
    { mode: "week", label: t("adminRangeWeek") },
    { mode: "month", label: t("adminRangeMonth") },
    { mode: "all", label: t("adminRangeAll") },
  ];

  const badgeI18n = {
    yes: t("adminYes"),
    no: t("adminNo"),
    cancelled: t("adminBadgeCancelled"),
    na: t("adminNA"),
  };

  const hasCustomRange = rangeMode === "custom" && (!!customFrom || !!customTo);
  const presetBtn = (active: boolean) =>
    cn(
      "px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-[12.5px] font-semibold cursor-pointer border whitespace-nowrap shrink-0",
      active
        ? "border-[hsl(227_69%_31%)] bg-[hsl(227_69%_31%)] text-white"
        : "border-[hsl(220_13%_88%)] bg-white text-[hsl(220_13%_35%)]",
    );

  return (
    <div className="bg-white border border-[hsl(220_13%_90%)] rounded-2xl p-3.5 sm:p-6 flex flex-col gap-3.5 sm:gap-5 h-full min-h-0 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3 shrink-0">
        <h2 className="m-0 text-[15px] sm:text-[17px] font-semibold">{t("adminOrdersTitle")}</h2>
        <div className="flex gap-1.5 items-center flex-wrap">
          {presets.map((p) => (
            <button key={p.mode} onClick={() => onRangeModeChange(p.mode)} className={presetBtn(rangeMode === p.mode)}>
              {p.label}
            </button>
          ))}

          {/* Desktop: explicit from/to date inputs */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <div className="w-px self-stretch bg-[hsl(220_13%_90%)] mx-1" />
            <input
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFrom(e.target.value)}
              className="px-2 py-1.5 rounded-md border border-[hsl(220_13%_88%)] text-[12.5px] text-[hsl(220_13%_30%)]"
            />
            <span className="text-[hsl(220_13%_60%)] text-[12.5px]">–</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => onCustomTo(e.target.value)}
              className="px-2 py-1.5 rounded-md border border-[hsl(220_13%_88%)] text-[12.5px] text-[hsl(220_13%_30%)]"
            />
          </div>

          {/* Mobile: icon-only trigger that reveals a small date popover */}
          <div className="relative sm:hidden shrink-0">
            <button
              onClick={() => setMobilePickerOpen((v) => !v)}
              title={t("adminCustomRange")}
              aria-label={t("adminCustomRange")}
              className={cn(
                "flex items-center justify-center w-[30px] h-[30px] rounded-lg border cursor-pointer",
                hasCustomRange
                  ? "border-[hsl(227_69%_31%)] bg-[hsl(227_69%_31%)] text-white"
                  : "border-[hsl(220_13%_88%)] bg-white text-[hsl(220_13%_45%)]",
              )}
            >
              <Calendar size={15} />
            </button>
            {mobilePickerOpen && (
              <div className="absolute top-[calc(100%+6px)] right-0 z-40 bg-white border border-[hsl(220_13%_90%)] rounded-[10px] shadow-lg p-3 flex flex-col gap-2 min-w-[180px]">
                <label className="flex flex-col gap-1 text-[11px] text-[hsl(220_13%_55%)]">
                  {t("adminDateFrom")}
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => onCustomFrom(e.target.value)}
                    className="px-2 py-1.5 rounded-md border border-[hsl(220_13%_88%)] text-[12.5px] text-[hsl(220_13%_30%)]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-[hsl(220_13%_55%)]">
                  {t("adminDateTo")}
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => onCustomTo(e.target.value)}
                    className="px-2 py-1.5 rounded-md border border-[hsl(220_13%_88%)] text-[12.5px] text-[hsl(220_13%_30%)]"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5 shrink-0">
        <div className="bg-[hsl(210_30%_97%)] rounded-lg sm:rounded-[10px] p-2 sm:p-3.5 flex flex-col gap-0.5 sm:gap-1.5 min-w-0">
          <span className="text-[10px] sm:text-xs text-[hsl(220_13%_55%)] truncate">{t("adminStatOrders")}</span>
          <span className="text-base sm:text-2xl font-bold truncate">{stats.count}</span>
        </div>
        <div className="bg-[hsl(210_30%_97%)] rounded-lg sm:rounded-[10px] p-2 sm:p-3.5 flex flex-col gap-0.5 sm:gap-1.5 min-w-0">
          <span className="text-[10px] sm:text-xs text-[hsl(220_13%_55%)] truncate">{t("adminStatRevenue")}</span>
          <span className="text-base sm:text-2xl font-bold truncate">{fmtMoney(stats.revenue)}</span>
        </div>
        <div className="bg-[hsl(210_30%_97%)] rounded-lg sm:rounded-[10px] p-2 sm:p-3.5 flex flex-col gap-0.5 sm:gap-1.5 min-w-0">
          <span className="text-[10px] sm:text-xs text-[hsl(220_13%_55%)] truncate">{t("adminStatNotCollected")}</span>
          <span className="text-base sm:text-2xl font-bold text-[hsl(0_74%_42%)] truncate">{stats.notCollected}</span>
        </div>
      </div>

      {/* Order list */}
      <div className="flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="sticky top-0 z-10 bg-white grid grid-cols-[1fr_40px_60px_32px_32px] sm:grid-cols-[118px_2fr_56px_84px_76px_76px] gap-2.5 px-4 pb-2 text-[11px] uppercase tracking-wide text-[hsl(220_13%_60%)] shrink-0 border-b border-[hsl(220_13%_91%)]">
          <span className="sm:hidden">{t("adminColClient")}</span>
          <span className="hidden sm:inline">{t("adminColDateTime")}</span>
          <span className="hidden sm:inline">{t("adminColClient")}</span>
          <span>{t("adminColItems")}</span>
          <span>{t("adminColTotal")}</span>
          <span className="hidden sm:inline">{t("adminColReady")}</span>
          <span className="hidden sm:inline">{t("adminColPicked")}</span>
        </div>

        {orders.map((order) => {
          const ready = readyBadge(order.ready, order.cancelled, badgeI18n);
          const picked = pickedBadge(order.picked_up, badgeI18n);
          const readyIc = readyIcon(order.ready, order.cancelled, badgeI18n);
          const pickedIc = pickedIcon(order.picked_up, badgeI18n);
          return (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              className="box-border grid grid-cols-[1fr_40px_60px_32px_32px] sm:grid-cols-[118px_2fr_56px_84px_76px_76px] gap-2.5 items-center px-4 py-3 border border-[hsl(220_13%_90%)] rounded-[10px] cursor-pointer bg-white hover:bg-[hsl(210_30%_97%)] min-w-0"
            >
              {/* Mobile: name + date (no order number) */}
              <span
                className={cn(
                  "sm:hidden flex flex-col gap-0.5 min-w-0",
                  order.cancelled && "line-through text-[hsl(220_13%_65%)]",
                )}
              >
                <span className="text-[13.5px] font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                  {order.fullName}
                </span>
                <span className="text-[10.5px] text-[hsl(220_13%_50%)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {fmtDateTime(order.placed_at || order.created, language)}
                </span>
              </span>

              {/* Desktop: date/time + order number */}
              <span
                className={cn(
                  "hidden sm:flex flex-col gap-0.5 min-w-0",
                  order.cancelled && "line-through text-[hsl(220_13%_65%)]",
                )}
              >
                <span className="text-[11px] text-[hsl(220_13%_45%)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {fmtDateTime(order.placed_at || order.created, language)}
                </span>
                <span className="text-xs font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                  {order.order_number}
                </span>
              </span>

              {/* Desktop: name */}
              <span
                className={cn(
                  "hidden sm:block text-[14.5px] font-medium overflow-hidden text-ellipsis whitespace-nowrap min-w-0",
                  order.cancelled && "line-through text-[hsl(220_13%_65%)]",
                )}
              >
                {order.fullName}
              </span>
              <span
                className={cn(
                  "text-[12.5px] text-[hsl(220_13%_40%)] overflow-hidden text-ellipsis whitespace-nowrap",
                  order.cancelled && "line-through text-[hsl(220_13%_65%)]",
                )}
              >
                {order.itemCount}
                {t("adminItemsSuffix")}
              </span>
              <span
                className={cn(
                  "text-[12.5px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap",
                  order.cancelled && "line-through text-[hsl(220_13%_65%)]",
                )}
              >
                {fmtMoney(order.amount_paid)}
              </span>
              <span className="flex sm:block items-center justify-center sm:justify-start">
                <span className="flex sm:hidden items-center justify-center" title={readyIc.label}>
                  <readyIc.Icon size={18} className={readyIc.className} />
                </span>
                <span className="hidden sm:inline-block">
                  <span className={ready.className}>{ready.label}</span>
                </span>
              </span>
              <span className="flex sm:block items-center justify-center sm:justify-start">
                <span className="flex sm:hidden items-center justify-center" title={pickedIc.label}>
                  <pickedIc.Icon size={18} className={pickedIc.className} />
                </span>
                <span className="hidden sm:inline-block">
                  <span className={picked.className}>{picked.label}</span>
                </span>
              </span>
            </div>
          );
        })}

        {orders.length === 0 && (
          <div className="py-6 text-center text-[hsl(220_13%_55%)] text-[13.5px]">{t("adminNoResults")}</div>
        )}
      </div>
    </div>
  );
};
