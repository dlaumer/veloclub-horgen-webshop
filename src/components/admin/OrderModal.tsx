import { CheckCircle2, PackageCheck, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguage } from "@/contexts/LanguageContext";
import { fmtDateTime, fmtMoney } from "@/lib/adminFormat";
import { parseTriState } from "@/lib/adminApi";
import { EnrichedOrder } from "@/types/admin";
import { readyBadge, pickedBadge, flagBadge } from "@/components/admin/badges";
import { cn } from "@/lib/utils";

interface OrderModalProps {
  order: EnrichedOrder | null;
  onClose: () => void;
  onMarkReady: () => void;
  onMarkPicked: () => void;
  onCancel: () => void;
  busy: boolean;
}

const ACTION_BASE =
  "flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-[12.5px] font-semibold border text-center leading-tight cursor-pointer transition-colors disabled:cursor-not-allowed";

const ACTION_TONE = {
  blue: "bg-[hsl(227_69%_95%)] text-[hsl(227_69%_30%)] border-[hsl(227_69%_85%)] hover:bg-[hsl(227_69%_90%)]",
  green: "bg-[hsl(150_45%_94%)] text-[hsl(150_45%_26%)] border-[hsl(150_45%_82%)] hover:bg-[hsl(150_45%_88%)]",
  red: "bg-[hsl(0_74%_96%)] text-[hsl(0_74%_42%)] border-[hsl(0_74%_88%)] hover:bg-[hsl(0_74%_92%)]",
  disabled: "bg-[hsl(220_13%_95%)] text-[hsl(220_13%_62%)] border-[hsl(220_13%_90%)]",
};

export const OrderModal = ({ order, onClose, onMarkReady, onMarkPicked, onCancel, busy }: OrderModalProps) => {
  const { t } = useTranslation();
  const { language } = useLanguage();

  if (!order) return null;

  const badgeI18n = {
    yes: t("adminYes"),
    no: t("adminNo"),
    cancelled: t("adminBadgeCancelled"),
    na: t("adminNA"),
  };

  const ready = readyBadge(order.ready, order.cancelled, badgeI18n);
  const picked = pickedBadge(order.picked_up, badgeI18n);
  const kidzbike = flagBadge(order.kidzbike, badgeI18n);

  // ready/picked_up are tri-state TEXT fields ("yes" / "no" / legacy string
  // / blank), not real bools - parse before branching on them. "No data"
  // (neither true nor false) means we can't safely offer the action, so
  // disable it rather than guess.
  const readyState = parseTriState(order.ready);
  const pickedState = parseTriState(order.picked_up);
  const cancelledState = parseTriState(order.cancelled);

  const readyDisabled = readyState === null || readyState === true || cancelledState === true || pickedState === true || busy;
  const pickedDisabled = pickedState === null || pickedState === true || cancelledState === true || busy;
  const cancelDisabled = cancelledState === true || pickedState === true || busy;

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[620px] max-h-[86vh] overflow-y-auto p-7">
        <DialogTitle className="sr-only">{t("adminOrderDetails")}</DialogTitle>

        <div className="mb-4 pr-6">
          <div className="text-[11px] text-[hsl(220_13%_55%)] uppercase tracking-wide mb-1">
            {t("adminOrderDetails")}
          </div>
          <div className="text-xl font-bold">{order.order_number}</div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            disabled={readyDisabled}
            onClick={onMarkReady}
            className={cn(ACTION_BASE, readyDisabled ? ACTION_TONE.disabled : ACTION_TONE.blue)}
          >
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{t("adminMarkReady")}</span>
          </button>
          <button
            disabled={pickedDisabled}
            onClick={onMarkPicked}
            className={cn(ACTION_BASE, pickedDisabled ? ACTION_TONE.disabled : ACTION_TONE.green)}
          >
            <PackageCheck size={15} className="shrink-0" />
            <span>{t("adminMarkPickedUp")}</span>
          </button>
          <button
            disabled={cancelDisabled}
            onClick={onCancel}
            className={cn(ACTION_BASE, cancelDisabled ? ACTION_TONE.disabled : ACTION_TONE.red)}
          >
            <XCircle size={15} className="shrink-0" />
            <span>{t("adminCancelOrder")}</span>
          </button>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <span className={ready.className}>{ready.label}</span>
          <span className={picked.className}>{picked.label}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5 text-[13.5px]">
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminBuyer")}</div>
            <div>{order.fullName}</div>
          </div>
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminEmail")}</div>
            <div>{order.buyer_email}</div>
          </div>
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminColDateTime")}</div>
            <div>{fmtDateTime(order.placed_at || order.created, language)}</div>
          </div>
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminPaymentStatus")}</div>
            <div>{order.payment_status}</div>
          </div>
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminKidzbike")}</div>
            <span className={kidzbike.className}>{kidzbike.label}</span>
          </div>
          {order.comments && (
            <div className="sm:col-span-2">
              <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminCustomerNote")}</div>
              <div>{order.comments}</div>
            </div>
          )}
          {order.internal_note && (
            <div className="sm:col-span-2">
              <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminInternalNote")}</div>
              <div>{order.internal_note}</div>
            </div>
          )}
        </div>

        <div className="text-[11px] text-[hsl(220_13%_55%)] uppercase tracking-wide mb-2">{t("adminItems")}</div>
        <div className="flex flex-col gap-1.5 mb-4">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[40px_1fr_auto_auto_auto] gap-2.5 items-center px-3 py-2.5 bg-[hsl(210_30%_97%)] rounded-lg text-[13px]"
            >
              <img
                src={item.image}
                alt=""
                className="w-10 h-10 rounded-md object-cover bg-white border border-[hsl(220_13%_90%)]"
              />
              <span>
                {item.name} <span className="text-[hsl(220_13%_55%)]">— {item.color}, {item.size}</span>
                {item.isReturn && (
                  <span className="ml-2 inline-block px-[7px] py-[1px] rounded-full text-[10.5px] font-semibold bg-[hsl(35_90%_92%)] text-[hsl(35_80%_35%)] align-middle">
                    {t("adminReturnTag")}
                  </span>
                )}
              </span>
              <span className="text-[hsl(220_13%_45%)]">×{item.quantity}</span>
              <span className="text-[hsl(220_13%_45%)]">{fmtMoney(item.unitPrice)}</span>
              <span className="font-semibold text-right">{fmtMoney(item.pricePaid)}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center py-3 px-1 border-t border-[hsl(220_13%_90%)]">
          <span className="text-sm font-semibold">{t("adminTotal")}</span>
          <span className="text-lg font-bold">{fmtMoney(order.amount_paid)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
