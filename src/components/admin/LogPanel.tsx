import { useTranslation } from "@/hooks/useTranslation";
import { useLanguage } from "@/contexts/LanguageContext";
import { fmtDateTime } from "@/lib/adminFormat";
import { EnrichedLog } from "@/types/admin";
import { cn } from "@/lib/utils";

export type LogKindFilter = "all" | EnrichedLog["kind"];

const DOT_COLORS: Record<EnrichedLog["kind"], string> = {
  purchase: "hsl(227 69% 40%)",
  ready: "hsl(35 80% 50%)",
  pickup: "hsl(150 45% 40%)",
  cancel: "hsl(0 74% 50%)",
  // corrections - same neutral gray for both, visually distinct from the
  // "real" ready/pickup events they're undoing.
  ready_undo: "hsl(220 13% 55%)",
  pickup_undo: "hsl(220 13% 55%)",
  exchange: "hsl(258 60% 55%)",
};

interface LogPanelProps {
  logs: EnrichedLog[];
  onSelectOrder: (id: string) => void;
  activeKind: LogKindFilter;
  onKindChange: (kind: LogKindFilter) => void;
}

export const LogPanel = ({ logs, onSelectOrder, activeKind, onKindChange }: LogPanelProps) => {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const kindLabels: Record<EnrichedLog["kind"], string> = {
    purchase: t("adminKindPurchase"),
    ready: t("adminKindReady"),
    pickup: t("adminKindPickup"),
    cancel: t("adminKindCancel"),
    ready_undo: t("adminKindReadyUndo"),
    pickup_undo: t("adminKindPickupUndo"),
    exchange: t("adminKindExchange"),
  };

  const kindFilters: LogKindFilter[] = [
    "all",
    "purchase",
    "ready",
    "pickup",
    "cancel",
    "ready_undo",
    "pickup_undo",
    "exchange",
  ];

  const visible = logs.slice(0, 40);

  return (
    <div className="bg-white border border-[hsl(220_13%_90%)] rounded-2xl p-5 flex flex-col gap-3.5 h-full min-h-0 overflow-hidden">
      <div className="flex justify-between items-center gap-3 flex-wrap shrink-0">
        <h2 className="m-0 text-[17px] font-semibold">{t("adminLogTitle")}</h2>
        <div className="flex gap-1.5 flex-wrap">
          {kindFilters.map((k) => (
            <button
              key={k}
              onClick={() => onKindChange(k)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[12.5px] font-semibold cursor-pointer border",
                activeKind === k
                  ? "border-[hsl(227_69%_31%)] bg-[hsl(227_69%_31%)] text-white"
                  : "border-[hsl(220_13%_88%)] bg-white text-[hsl(220_13%_35%)]",
              )}
            >
              {k === "all" ? t("adminAllCategories") : kindLabels[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
        {visible.map((log) => (
          <div
            key={log.id}
            onClick={() => log.order && onSelectOrder(log.order)}
            className="flex items-center gap-2 px-3 py-2 border border-[hsl(220_13%_91%)] rounded-[9px] cursor-pointer hover:bg-[hsl(210_30%_97%)] min-w-0"
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOT_COLORS[log.kind] }} />
            <span className="text-[12px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
              <span className="font-semibold">{kindLabels[log.kind]}</span>
              {" · "}
              <span className="hidden sm:inline font-semibold">{log.orderNumber}</span>
              <span className="hidden sm:inline">{" · "}</span>
              <span className="text-[hsl(220_13%_40%)]">{log.fullName}</span>
              {" · "}
              <span className={cn("text-[hsl(220_13%_55%)]", !log.placedAt && "italic")}>
                {log.placedAt ? fmtDateTime(log.placedAt, language) : t("adminNoDateInfo")}
              </span>
              {log.admin_name && (
                <>
                  {" · "}
                  <span className="hidden sm:inline text-[hsl(220_13%_55%)]">{log.admin_name}</span>
                </>
              )}
            </span>
          </div>
        ))}

        {visible.length === 0 && (
          <div className="py-4 text-center text-[hsl(220_13%_55%)] text-[13px]">{t("adminNoResults")}</div>
        )}
      </div>
    </div>
  );
};
