import { useState } from "react";
import { CheckCircle2, PackageCheck, XCircle, Clock, User, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguage } from "@/contexts/LanguageContext";
import { fmtDateTime, fmtMoney } from "@/lib/adminFormat";
import { parseTriState } from "@/lib/adminApi";
import { EnrichedOrder } from "@/types/admin";
import { readyBadge, pickedBadge, flagBadge } from "@/components/admin/badges";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface OrderModalProps {
  order: EnrichedOrder | null;
  onClose: () => void;
  onMarkReady: () => void;
  onMarkPicked: () => void;
  onCancel: () => void;
  onOpenArticle: (articleNumber: string) => void;
  onSaveNote: (note: string) => void;
  savingNote?: boolean;
  onUndoReady: () => void;
  onUndoPicked: () => void;
  undoingReady?: boolean;
  undoingPicked?: boolean;
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

export const OrderModal = ({
  order,
  onClose,
  onMarkReady,
  onMarkPicked,
  onCancel,
  onOpenArticle,
  onSaveNote,
  savingNote,
  onUndoReady,
  onUndoPicked,
  undoingReady,
  undoingPicked,
  busy,
}: OrderModalProps) => {
  const { t } = useTranslation();
  const { language } = useLanguage();

  // Local draft of the internal note, separate from order.internal_note so
  // typing doesn't need a round-trip to the server. Re-synced whenever a
  // different order is opened (or this order's saved note changes under us,
  // e.g. after the save succeeds and the orders query refetches).
  //
  // This resync used to live in a useEffect keyed on [order?.id,
  // order?.internal_note]. Effects run AFTER the first paint though, so for
  // one frame the component would render with the PREVIOUS order's draft
  // next to the NEW order's saved note - noteDirty briefly came out true,
  // flashing the "Notiz speichern" button before the effect caught up.
  // Doing the same comparison directly during render (React's documented
  // "adjusting state when a prop changes" pattern) fixes that: if it's
  // stale, the state is corrected and re-rendered before anything is ever
  // painted to the screen.
  const [noteDraft, setNoteDraft] = useState(order?.internal_note || "");
  const [noteSyncedFor, setNoteSyncedFor] = useState<{ id?: string; note: string }>({
    id: order?.id,
    note: order?.internal_note || "",
  });
  if (order && (order.id !== noteSyncedFor.id || (order.internal_note || "") !== noteSyncedFor.note)) {
    setNoteDraft(order.internal_note || "");
    setNoteSyncedFor({ id: order.id, note: order.internal_note || "" });
  }

  if (!order) return null;

  const noteDirty = noteDraft !== (order.internal_note || "");

  const badgeI18n = {
    yes: t("adminYes"),
    no: t("adminNo"),
    cancelled: t("adminBadgeCancelled"),
    na: t("adminNA"),
  };

  // Never show a bare "Ja"/"Nein" for ready/picked-up - always spell out
  // what that actually means ("Bereit"/"Nicht bereit",
  // "Abgeholt"/"Nicht abgeholt"). "cancelled"/"N/A" still come from the
  // shared i18n strings, those are unambiguous on their own.
  const ready = readyBadge(order.ready, order.cancelled, {
    ...badgeI18n,
    yes: t("adminMarkReady"),
    no: t("adminNotReady"),
  });
  const picked = pickedBadge(order.picked_up, {
    ...badgeI18n,
    yes: t("adminMarkPickedUp"),
    no: t("adminNotPickedUp"),
  });
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

  // Undoing "ready" while it's already picked up would leave picked_up=true
  // on an order that was never (as far as the record now shows) marked
  // ready - undo pickup first. Undoing "pickup" has no such constraint.
  const undoReadyDisabled = pickedState === true || cancelledState === true || busy || !!undoingReady;
  const undoPickedDisabled = cancelledState === true || busy || !!undoingPicked;

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-[620px] max-h-[86vh] overflow-y-auto overflow-x-hidden p-7"
        // Radix auto-focuses the first tabbable element on open, which for
        // most orders is the internal-note textarea - looked like it was
        // already "active"/being edited the instant the modal opened.
        // Nothing here needs focus by default, so just don't move it.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{t("adminOrderDetails")}</DialogTitle>

        <div className="mb-4 pr-6">
          <div className="text-[11px] text-[hsl(220_13%_55%)] uppercase tracking-wide mb-1">
            {t("adminOrderDetails")}
          </div>
          <div className="text-xl font-bold">{order.fullName}</div>
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

        <div className="flex flex-col gap-2 mb-4">
          <div className="flex flex-col gap-1.5 px-3 py-2 rounded-lg bg-[hsl(210_30%_97%)]">
            <div className="flex items-center gap-3 flex-wrap">
            <span className={ready.className}>{ready.label}</span>
            {cancelledState === true && (
              <span className="flex items-center gap-3 text-[12px] text-[hsl(220_13%_50%)]">
                <span className={cn("flex items-center gap-1", !order.cancelledAt && "italic")}>
                  <Clock size={12} className="shrink-0" />
                  {order.cancelledAt ? fmtDateTime(order.cancelledAt, language) : t("adminNoDateInfo")}
                </span>
                {order.cancelledBy && (
                  <span className="flex items-center gap-1">
                    <User size={12} className="shrink-0" />
                    {order.cancelledBy}
                  </span>
                )}
              </span>
            )}
            {readyState === true && cancelledState !== true && (
              <span className="flex items-center gap-3 text-[12px] text-[hsl(220_13%_50%)]">
                <span className={cn("flex items-center gap-1", !order.readyAt && "italic")}>
                  <Clock size={12} className="shrink-0" />
                  {order.readyAt ? fmtDateTime(order.readyAt, language) : t("adminNoDateInfo")}
                </span>
                {order.readyBy && (
                  <span className="flex items-center gap-1">
                    <User size={12} className="shrink-0" />
                    {order.readyBy}
                  </span>
                )}
              </span>
            )}
            {readyState === true && cancelledState !== true && (
              <button
                type="button"
                disabled={undoReadyDisabled}
                onClick={onUndoReady}
                className="ml-auto flex items-center gap-1 text-[12px] font-medium text-[hsl(220_13%_45%)] hover:text-[hsl(220_13%_20%)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Undo2 size={13} className="shrink-0" />
                {t("adminUndoReady")}
              </button>
            )}
            </div>
            {cancelledState === true && order.cancelled_note && (
              <div className="text-[12px] text-[hsl(220_13%_45%)] whitespace-pre-wrap">
                {order.cancelled_note}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-lg bg-[hsl(210_30%_97%)]">
            <span className={picked.className}>{picked.label}</span>
            {pickedState === true && (
              <span className="flex items-center gap-3 text-[12px] text-[hsl(220_13%_50%)]">
                <span className={cn("flex items-center gap-1", !order.pickedAt && "italic")}>
                  <Clock size={12} className="shrink-0" />
                  {order.pickedAt ? fmtDateTime(order.pickedAt, language) : t("adminNoDateInfo")}
                </span>
                {order.pickedBy && (
                  <span className="flex items-center gap-1">
                    <User size={12} className="shrink-0" />
                    {order.pickedBy}
                  </span>
                )}
              </span>
            )}
            {pickedState === true && (
              <button
                type="button"
                disabled={undoPickedDisabled}
                onClick={onUndoPicked}
                className="ml-auto flex items-center gap-1 text-[12px] font-medium text-[hsl(220_13%_45%)] hover:text-[hsl(220_13%_20%)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Undo2 size={13} className="shrink-0" />
                {t("adminUndoPickedUp")}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5 text-[13.5px]">
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminOrderNumber")}</div>
            <div>{order.order_number}</div>
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
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminPricePaid")}</div>
            <div>{fmtMoney(order.pricePaid)}</div>
          </div>
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminMoneyReceived")}</div>
            <div>{fmtMoney(order.moneyReceived)}</div>
          </div>
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminCostPrice")}</div>
            <div>{fmtMoney(order.costPriceTotal)}</div>
          </div>
          {order.costPricePaidTotal !== order.costPriceTotal && (
            <div>
              <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminStatCostPricePaid")}</div>
              <div>{fmtMoney(order.costPricePaidTotal)}</div>
            </div>
          )}
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
          <div className="sm:col-span-2">
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminInternalNote")}</div>
            <Textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder={t("adminInternalNotePlaceholder")}
              rows={3}
              className="text-[13.5px] resize-none"
            />
            {noteDirty && (
              <div className="flex justify-end mt-1.5">
                <Button type="button" size="sm" disabled={savingNote} onClick={() => onSaveNote(noteDraft)}>
                  {t("adminSaveNote")}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="text-[11px] text-[hsl(220_13%_55%)] uppercase tracking-wide mb-2">{t("adminItems")}</div>
        <div className="flex flex-col gap-1.5 mb-4">
          {order.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenArticle(item.articleNumber)}
              className="grid grid-cols-[40px_1fr_auto_auto_auto] gap-2.5 items-center px-3 py-2.5 bg-[hsl(210_30%_97%)] rounded-lg text-[13px] text-left w-full hover:bg-[hsl(210_30%_93%)] transition-colors cursor-pointer"
              title={t("adminOpenArticle")}
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
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center py-3 px-1 border-t border-[hsl(220_13%_90%)]">
          <span className="text-sm font-semibold">{t("adminTotal")}</span>
          <span className="text-lg font-bold">{fmtMoney(order.pricePaid)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
