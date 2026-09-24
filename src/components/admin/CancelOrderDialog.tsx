import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { EnrichedOrder } from "@/types/admin";

interface CancelOrderDialogProps {
  order: EnrichedOrder | null;
  note: string;
  onNoteChange: (note: string) => void;
  // CHF, string so the input can hold an in-progress/empty value while typing.
  refundAmount: string;
  onRefundAmountChange: (amount: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
}

export const CancelOrderDialog = ({
  order,
  note,
  onNoteChange,
  refundAmount,
  onRefundAmountChange,
  onClose,
  onConfirm,
  submitting,
}: CancelOrderDialogProps) => {
  const { t } = useTranslation();

  if (!order) return null;

  // Only real Zahls payments have anything to refund - legacy (Excel-
  // imported) and free/promo orders never went through Zahls at all, so
  // there's no transaction to refund and the amount field doesn't apply.
  const hasRefundablePayment = order.payment_provider === "zahls";
  const amountPaid = order.amount_paid || 0;
  const parsedAmount = Number(refundAmount);
  const amountValid =
    !hasRefundablePayment || (isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= amountPaid + 0.005);

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[480px]">
        <DialogTitle>{t("adminCancelDialogTitle")}</DialogTitle>

        <div className="text-sm text-[hsl(220_13%_45%)]">{order.order_number} — {order.fullName}</div>

        <div className="mt-1">
          <label className="text-[hsl(220_13%_55%)] text-[11.5px] mb-1 block">{t("adminCancelReasonLabel")}</label>
          <Textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={t("adminCancelReasonPlaceholder")}
            rows={3}
            className="text-[13.5px] resize-none"
          />
        </div>

        {hasRefundablePayment ? (
          <div className="mt-2">
            <label className="text-[hsl(220_13%_55%)] text-[11.5px] mb-1 block">
              {t("adminRefundAmountLabel")}
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={amountPaid}
              value={refundAmount}
              onChange={(e) => onRefundAmountChange(e.target.value)}
              className="text-[13.5px]"
            />
            <div className="text-[11.5px] text-[hsl(220_13%_55%)] mt-1">
              {t("adminRefundAmountHint")} {amountPaid.toFixed(2)} CHF
            </div>
          </div>
        ) : (
          <div className="text-[12px] text-[hsl(220_13%_55%)] italic mt-2">{t("adminRefundNoPayment")}</div>
        )}

        <div className="flex items-start gap-2.5 mt-2 px-3 py-2.5 rounded-lg bg-[hsl(0_74%_97%)] text-[hsl(0_74%_38%)] text-[13px]">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{t("adminCancelConfirmQuestion")}</span>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            {t("adminCancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!amountValid || submitting}
            onClick={onConfirm}
          >
            {t("adminConfirmCancelOrder")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
