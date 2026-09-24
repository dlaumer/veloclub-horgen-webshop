import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  PromoCodeRecord,
  PromoCodeType,
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} from "@/lib/adminApi";

interface PromoCodesModalProps {
  open: boolean;
  onClose: () => void;
}

const PROMO_TYPES: PromoCodeType[] = ["return_category", "percentage", "free_order"];

// Empty draft used both for the "new code" form and reset after a
// successful create - kept outside the component so it's a stable
// reference we don't need to useMemo.
const emptyDraft = { code: "", type: "return_category" as PromoCodeType, percentage: "10", active: true };

export const PromoCodesModal = ({ open, onClose }: PromoCodesModalProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { auth } = useAdminAuth();
  const queryClient = useQueryClient();
  const token = auth?.token;

  const [draft, setDraft] = useState(emptyDraft);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const promoQuery = useQuery({
    queryKey: ["admin-promo-codes"],
    queryFn: () => listPromoCodes(token!),
    enabled: open && !!token,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });

  const createMutation = useMutation({
    mutationFn: () =>
      createPromoCode(token!, {
        code: draft.code.trim().toUpperCase(),
        type: draft.type,
        percentage: draft.type === "percentage" ? Number(draft.percentage) || 0 : 0,
        active: draft.active,
      }),
    onSuccess: () => {
      invalidate();
      setDraft(emptyDraft);
      toast({ description: t("adminSaveSuccess") });
    },
    onError: () => toast({ variant: "destructive", description: t("adminPromoCodeSaveError") }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (promo: PromoCodeRecord) => updatePromoCode(token!, promo.id, { active: !promo.active }),
    onSuccess: invalidate,
    onError: () => toast({ variant: "destructive", description: t("adminPromoCodeSaveError") }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePromoCode(token!, id),
    onMutate: (id) => setDeletingId(id),
    onSuccess: invalidate,
    onError: () => toast({ variant: "destructive", description: t("adminPromoCodeSaveError") }),
    onSettled: () => setDeletingId(null),
  });

  const handleDelete = (promo: PromoCodeRecord) => {
    if (!window.confirm(t("adminDeletePromoCodeConfirm"))) return;
    deleteMutation.mutate(promo.id);
  };

  const typeLabel = (type: PromoCodeType) =>
    type === "return_category"
      ? t("adminPromoTypeReturnCategory")
      : type === "percentage"
        ? t("adminPromoTypePercentage")
        : t("adminPromoTypeFreeOrder");

  const canSubmit = draft.code.trim().length > 0 && (draft.type !== "percentage" || Number(draft.percentage) > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] max-h-[86vh] overflow-y-auto overflow-x-hidden p-7">
        <DialogTitle className="text-lg font-bold mb-1">{t("adminPromoCodes")}</DialogTitle>
        <p className="text-[13px] text-[hsl(220_13%_55%)] mb-5">{t("adminPromoCodesDesc")}</p>

        <div className="flex flex-col gap-2 mb-6">
          {promoQuery.isLoading && (
            <div className="text-[13px] text-[hsl(220_13%_55%)]">{t("adminLoadingDetails")}</div>
          )}
          {!promoQuery.isLoading && (promoQuery.data?.length || 0) === 0 && (
            <div className="text-[13px] text-[hsl(220_13%_55%)]">{t("adminNoPromoCodes")}</div>
          )}
          {(promoQuery.data || []).map((promo) => (
            <div
              key={promo.id}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[hsl(210_30%_97%)] rounded-lg text-[13.5px]"
            >
              <div className="min-w-0">
                <div className="font-semibold font-mono truncate">{promo.code}</div>
                <div className="text-[11.5px] text-[hsl(220_13%_55%)]">
                  {typeLabel(promo.type)}
                  {promo.type === "percentage" ? ` — ${promo.percentage}%` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleActiveMutation.mutate(promo)}
                  disabled={toggleActiveMutation.isPending}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    promo.active
                      ? "bg-[hsl(150_45%_94%)] text-[hsl(150_45%_28%)] border-[hsl(150_45%_80%)]"
                      : "bg-[hsl(220_13%_93%)] text-[hsl(220_13%_45%)] border-[hsl(220_13%_85%)]"
                  }`}
                >
                  {promo.active ? t("adminPromoActive") : t("adminPromoInactive")}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={deletingId === promo.id}
                  onClick={() => handleDelete(promo)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[hsl(220_13%_91%)] pt-5">
          <div className="text-[11px] text-[hsl(220_13%_55%)] uppercase tracking-wide mb-3">
            {t("adminNewPromoCode")}
          </div>
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <Label className="text-[11.5px] text-[hsl(220_13%_55%)]">{t("adminPromoCodeLabel")}</Label>
              <Input
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                placeholder="PROMOWEBSHOP"
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11.5px] text-[hsl(220_13%_55%)]">{t("adminPromoCodeType")}</Label>
              <select
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as PromoCodeType }))}
                className="w-full h-9 rounded-md border border-[hsl(220_13%_88%)] px-2.5 text-[13.5px] bg-white"
              >
                {PROMO_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            {draft.type === "percentage" && (
              <div className="flex flex-col gap-1">
                <Label className="text-[11.5px] text-[hsl(220_13%_55%)]">{t("adminPromoPercentageLabel")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.percentage}
                  onChange={(e) => setDraft((d) => ({ ...d, percentage: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-[13.5px]">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
              />
              {t("adminPromoActive")}
            </label>
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}
              className="gap-1.5 self-start"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("adminAddPromoCode")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
