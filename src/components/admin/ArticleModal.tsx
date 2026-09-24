import { useState, useRef, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, ArrowUp, ArrowDown, Upload, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { fmtMoney } from "@/lib/adminFormat";
import { cn } from "@/lib/utils";
import { EnrichedArticle } from "@/types/admin";
import { CategorySelect } from "@/components/admin/CategorySelect";
import {
  ArticleRecord,
  findArticleByNumber,
  listArticleItemsForArticle,
  updateArticle,
  updateArticleItem,
  createArticleItem,
  deleteArticleItem,
  deleteArticle,
  articleFileUrl,
  addArticleImages,
  setArticleImageOrder,
} from "@/lib/adminApi";

interface ArticleModalProps {
  article: EnrichedArticle | null;
  onClose: () => void;
  mainCategoryOptions: string[];
  categoryOptions: string[];
  returnCategoryOptions: string[];
}

// Every editable article field except id/article_number/images -
// article_number is the storefront sku (unique index, referenced by
// historical order_items), so it's shown read-only rather than editable
// here. images is managed separately (imageFilenames state below), since
// it saves immediately on each change rather than through the main
// Save/Cancel flow (see the "Images" section for why).
type EditForm = Omit<ArticleRecord, "id" | "article_number" | "images">;

// A row in the size/stock editor. `id` present = an existing article_items
// record (edit or mark for delete); `id` absent = a new size not yet saved.
type EditItem = { id?: string; size: string; stock: number; removed?: boolean };

// The selling price isn't hand-entered anymore - it's derived from the
// cost/wholesale price so that, after the payment processor's cut, the
// club nets exactly the cost price back. Fees match the club's own
// pricing spreadsheet (Zahls/Payrexx: CHF 0.30 fixed + 2.9% per
// transaction). Formula, rounded up to the next whole franc:
//   price = FLOOR((cost + 0.30) / (1 - 0.029)) + 1
const PAYMENT_FIXED_FEE = 0.3;
const PAYMENT_PERCENT_FEE = 0.029;

function calcPriceFromCost(costPrice: number): number {
  const cost = Number(costPrice) || 0;
  return Math.floor((cost + PAYMENT_FIXED_FEE) / (1 - PAYMENT_PERCENT_FEE)) + 1;
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <Label className="text-[11.5px] text-[hsl(220_13%_55%)]">{label}</Label>
    {children}
  </div>
);

export const ArticleModal = ({
  article,
  onClose,
  mainCategoryOptions,
  categoryOptions,
  returnCategoryOptions,
}: ArticleModalProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { auth } = useAdminAuth();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [items, setItems] = useState<EditItem[]>([]);
  const [dragItemIndex, setDragItemIndex] = useState<number | null>(null);
  const [newSize, setNewSize] = useState("");
  const [newStock, setNewStock] = useState("");
  const [imageFilenames, setImageFilenames] = useState<string[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [detail, setDetail] = useState<ArticleRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reset the view-mode carousel back to the first slide whenever a
  // different article is opened (or the modal is opened fresh) - without
  // this, switching articles while the modal is open would keep showing
  // whatever slide index was left over from the previous article.
  useEffect(() => {
    setGalleryIndex(0);
  }, [article?.id]);

  // The read-only view is normally built from `article` (an EnrichedArticle
  // sourced from the public /api/stock endpoint), which deliberately omits
  // internal-only fields (cost_price, notes, product_id, color_code, sort
  // order, return category, just-stock flag, raw 3D embed code - see
  // adminApi.ts's header comment) so the public storefront API never leaks
  // them. To show everything that's actually editable, fetch the real
  // article record (same lookup startEdit() already does) whenever a
  // different article is opened, and layer those extra fields into the
  // view below once loaded.
  useEffect(() => {
    setDetail(null);
    if (!auth || !article) return;
    let cancelled = false;
    setDetailLoading(true);
    findArticleByNumber(auth.token, article.articleNumber)
      .then((rec) => {
        if (!cancelled) setDetail(rec);
      })
      .catch(() => {
        /* view-mode extras are a bonus, not critical - silently keep showing
           just the public fields if this lookup fails */
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.articleNumber, auth]);

  if (!article) return null;

  // Same gallery pattern as the storefront's ProductModal: the 3D embed
  // (if present) comes first, followed by the ordered images. Falls back
  // to the single list-thumbnail image if the article has no images array
  // populated (e.g. stale cached data).
  const galleryItems: Array<{ type: "3d" | "image"; content: string }> = [];
  if (article.image3d && article.image3d.trim() !== "") {
    galleryItems.push({ type: "3d", content: article.image3d });
  }
  const galleryImages = article.images && article.images.length ? article.images : article.image ? [article.image] : [];
  galleryImages.forEach((img) => galleryItems.push({ type: "image", content: img }));
  const currentGalleryItem = galleryItems[galleryIndex] || galleryItems[0];
  const handlePrevImage = () =>
    setGalleryIndex((prev) => (prev === 0 ? galleryItems.length - 1 : prev - 1));
  const handleNextImage = () =>
    setGalleryIndex((prev) => (prev === galleryItems.length - 1 ? 0 : prev + 1));

  const resetEditState = () => {
    setEditing(false);
    setForm(null);
    setItems([]);
    setRecordId(null);
    setNewSize("");
    setNewStock("");
    setImageFilenames([]);
    setImageBusy(false);
  };

  const handleClose = () => {
    resetEditState();
    onClose();
  };

  const startEdit = async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const rec = await findArticleByNumber(auth.token, article.articleNumber);
      if (!rec) {
        toast({ variant: "destructive", description: t("adminSaveError") });
        return;
      }
      const rawItems = await listArticleItemsForArticle(auth.token, rec.id);
      setRecordId(rec.id);
      setForm({
        product_id: rec.product_id,
        name: rec.name,
        price: rec.price,
        cost_price: rec.cost_price,
        main_category: rec.main_category,
        category: rec.category,
        color_name: rec.color_name,
        color_code: rec.color_code,
        embed_3d: rec.embed_3d || "",
        just_stock: rec.just_stock || "no",
        return_category: rec.return_category || "no",
        description: rec.description || "",
        notes: rec.notes || "",
        sort_order: rec.sort_order,
      });
      setItems(rawItems.map((it) => ({ id: it.id, size: it.size, stock: it.stock })));
      setImageFilenames(rec.images || []);
      setEditing(true);
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : t("adminSaveError") });
    } finally {
      setLoading(false);
    }
  };

  const updateField = <K extends keyof EditForm>(key: K, value: EditForm[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const updateItemStock = (index: number, stock: number) => {
    setItems((its) => its.map((it, i) => (i === index ? { ...it, stock } : it)));
  };

  const removeItem = (index: number) => {
    setItems((its) => its.map((it, i) => (i === index ? { ...it, removed: true } : it)));
  };

  // Sizes only have a persisted order (sort_order) once Save is clicked -
  // see save() below - so all of this just reshuffles local state.

  /** Moves the item at `index` past its next visible (non-removed)
   * neighbor in `direction` - used by the up/down arrow buttons. */
  const moveSizeItem = (index: number, direction: -1 | 1) => {
    setItems((its) => {
      const next = [...its];
      let target = index + direction;
      while (target >= 0 && target < next.length && next[target].removed) {
        target += direction;
      }
      if (target < 0 || target >= next.length) return its;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  /** Moves the item at `fromIndex` to sit at `toIndex` - used by the drag
   * handle. Unlike moveSizeItem this doesn't swap, it inserts, which is the
   * behavior people expect from actually dragging a row somewhere. */
  const reorderSizeItems = (fromIndex: number, toIndex: number) => {
    setItems((its) => {
      const next = [...its];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const addSize = () => {
    const size = newSize.trim();
    if (!size) return;
    setItems((its) => [...its, { size, stock: Number(newStock) || 0 }]);
    setNewSize("");
    setNewStock("");
  };

  // Images save immediately (not deferred to the Save/Cancel buttons
  // below) - unlike plain text fields, each change here is its own real
  // request (a file upload, or a field-order update), so batching them
  // behind a single "Save" click would mean either re-uploading files
  // that didn't actually change or building fairly involved diffing logic
  // for no real benefit. This keeps each action simple and immediately
  // visible/undoable on its own.

  const handleAddImageFiles = async (fileList: FileList | null) => {
    if (!auth || !recordId || !fileList || !fileList.length) return;
    setImageBusy(true);
    try {
      const updated = await addArticleImages(auth.token, recordId, imageFilenames, Array.from(fileList));
      setImageFilenames(updated.images || []);
      await queryClient.invalidateQueries({ queryKey: ["admin-stock"] });
      toast({ description: t("adminSaveSuccess") });
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : t("adminSaveError") });
    } finally {
      setImageBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteImage = async (filename: string) => {
    if (!auth || !recordId) return;
    setImageBusy(true);
    try {
      const next = imageFilenames.filter((fn) => fn !== filename);
      const updated = await setArticleImageOrder(auth.token, recordId, next);
      setImageFilenames(updated.images || []);
      await queryClient.invalidateQueries({ queryKey: ["admin-stock"] });
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : t("adminSaveError") });
    } finally {
      setImageBusy(false);
    }
  };

  const handleMoveImage = async (index: number, direction: -1 | 1) => {
    if (!auth || !recordId) return;
    const target = index + direction;
    if (target < 0 || target >= imageFilenames.length) return;
    const next = [...imageFilenames];
    [next[index], next[target]] = [next[target], next[index]];
    setImageBusy(true);
    try {
      const updated = await setArticleImageOrder(auth.token, recordId, next);
      setImageFilenames(updated.images || next);
      await queryClient.invalidateQueries({ queryKey: ["admin-stock"] });
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : t("adminSaveError") });
    } finally {
      setImageBusy(false);
    }
  };

  const save = async () => {
    if (!auth || !recordId || !form) return;
    setSaving(true);
    try {
      // price is never hand-edited (see the disabled field above) - always
      // send the freshly-computed value so it can't drift from cost_price.
      await updateArticle(auth.token, recordId, { ...form, price: calcPriceFromCost(form.cost_price) });

      // sort_order is assigned here from each item's current position in
      // the (possibly just reordered) list, skipping removed ones so the
      // surviving items end up as a clean 0, 1, 2, ... sequence.
      let sortOrder = 0;
      for (const it of items) {
        if (it.removed) {
          if (it.id) await deleteArticleItem(auth.token, it.id);
          continue;
        }
        const order = sortOrder++;
        if (it.id) {
          await updateArticleItem(auth.token, it.id, { size: it.size, stock: it.stock, sort_order: order });
        } else {
          await createArticleItem(auth.token, {
            article: recordId,
            size: it.size,
            stock: it.stock,
            sort_order: order,
          });
        }
      }

      // the read-only view (ArticlesPanel/this modal's display mode) is
      // built from the public /api/stock endpoint - refetch it so the
      // change shows up immediately instead of on the next 30s poll.
      await queryClient.invalidateQueries({ queryKey: ["admin-stock"] });
      toast({ description: t("adminSaveSuccess") });
      resetEditState();
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : t("adminSaveError") });
    } finally {
      setSaving(false);
    }
  };

  // article_items rows cascade-delete with the article automatically (see
  // deleteArticle's own comment in adminApi.ts) - nothing extra to do here
  // for those. An article that's already been ordered can't be deleted
  // though (order_items.article intentionally blocks it to protect
  // historical order data), which surfaces as a thrown error below.
  const handleDelete = async () => {
    if (!auth || !recordId) return;
    if (!window.confirm(t("adminDeleteArticleConfirm"))) return;
    setDeleting(true);
    try {
      await deleteArticle(auth.token, recordId);
      await queryClient.invalidateQueries({ queryKey: ["admin-stock"] });
      toast({ description: t("adminDeleteArticleSuccess") });
      handleClose();
    } catch {
      toast({ variant: "destructive", description: t("adminDeleteArticleError") });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!article} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[520px] max-h-[86vh] overflow-y-auto overflow-x-hidden p-7">
        <DialogTitle className="sr-only">{t("adminArticleDetails")}</DialogTitle>

        <div className="flex gap-3 items-center mb-4.5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-[hsl(220_13%_55%)] uppercase tracking-wide mb-1">
              {t("adminArticleDetails")}
            </div>
            <div className="text-lg font-bold truncate">{article.name}</div>
          </div>
          {!editing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={startEdit}
              disabled={loading}
              className="shrink-0 h-8 w-8 mr-5 text-[hsl(220_13%_45%)] hover:text-foreground"
              aria-label={t("adminEdit")}
              title={t("adminEdit")}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>

        {!editing && (
          <>
            {galleryItems.length > 0 && currentGalleryItem && (
              <div className="mb-5">
                <div className="relative">
                  {currentGalleryItem.type === "3d" ? (
                    <div
                      className="h-48 w-full sm:h-56 rounded-[10px] border border-[hsl(220_13%_90%)] bg-[hsl(210_30%_97%)] overflow-hidden [&>div]:h-full [&>div]:w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:rounded-[10px] [&_p]:hidden"
                      dangerouslySetInnerHTML={{ __html: currentGalleryItem.content }}
                    />
                  ) : (
                    <img
                      src={currentGalleryItem.content}
                      alt={article.name}
                      className="h-48 w-full sm:h-56 rounded-[10px] border border-[hsl(220_13%_90%)] bg-[hsl(210_30%_97%)] object-contain"
                    />
                  )}
                  {galleryItems.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrevImage}
                        aria-label={t("adminPrevImage")}
                        className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 border border-[hsl(220_13%_90%)] shadow-sm"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextImage}
                        aria-label={t("adminNextImage")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 border border-[hsl(220_13%_90%)] shadow-sm"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
                {galleryItems.length > 1 && (
                  <div className="mt-2.5 flex justify-center gap-2">
                    {galleryItems.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setGalleryIndex(index)}
                        aria-label={`${t("adminGalleryItem")} ${index + 1}`}
                        className={cn(
                          "h-2 w-2 rounded-full transition-all",
                          index === galleryIndex ? "w-6 bg-[hsl(220_13%_35%)]" : "bg-[hsl(220_13%_85%)]"
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3.5 mb-5 text-[13.5px]">
              <div>
                <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminArticleNumber")}</div>
                <div>{article.articleNumber}</div>
              </div>
              <div>
                <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminProductId")}</div>
                <div>{detail?.product_id || article.productId}</div>
              </div>
              <div>
                <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminPriceLabel")}</div>
                <div>{fmtMoney(article.price)}</div>
              </div>
              {detail && (
                <div>
                  <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminCostPrice")}</div>
                  <div>{fmtMoney(detail.cost_price)}</div>
                </div>
              )}
              <div>
                <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminMainCategory")}</div>
                <div>{article.mainCategory}</div>
              </div>
              <div>
                <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminCategory")}</div>
                <div>{article.category}</div>
              </div>
              <div>
                <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminColor")}</div>
                <div>{article.colorName}</div>
              </div>
              <div>
                <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminColorCode")}</div>
                <div className="flex items-center gap-1.5">
                  {article.colorCode && (
                    <span
                      className="inline-block w-3.5 h-3.5 rounded-full border border-[hsl(220_13%_85%)] shrink-0"
                      style={{ backgroundColor: article.colorCode }}
                    />
                  )}
                  <span>{article.colorCode || "—"}</span>
                </div>
              </div>
              {detail && (
                <>
                  <div>
                    <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminReturnCategory")}</div>
                    <div>{detail.return_category || "no"}</div>
                  </div>
                  <div>
                    <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminJustStock")}</div>
                    <div>{detail.just_stock === "yes" ? t("adminYes") : t("adminNo")}</div>
                  </div>
                  <div>
                    <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminSortOrder")}</div>
                    <div>{detail.sort_order}</div>
                  </div>
                </>
              )}
              {article.description && (
                <div className="col-span-2">
                  <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminDescription")}</div>
                  <div>{article.description}</div>
                </div>
              )}
              {detail?.notes && (
                <div className="col-span-2">
                  <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminNotes")}</div>
                  <div>{detail.notes}</div>
                </div>
              )}
              {detail?.embed_3d && (
                <div className="col-span-2">
                  <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminEmbed3d")}</div>
                  <div className="text-[11.5px] font-mono text-[hsl(220_13%_45%)] break-all line-clamp-3">
                    {detail.embed_3d}
                  </div>
                </div>
              )}
              {detailLoading && !detail && (
                <div className="col-span-2 text-[11.5px] text-[hsl(220_13%_55%)]">{t("adminLoadingDetails")}</div>
              )}
            </div>

            <div className="text-[11px] text-[hsl(220_13%_55%)] uppercase tracking-wide mb-2">
              {t("adminStockLabel")}
            </div>
            <div className="flex flex-col gap-1.5">
              {article.sizes.map((sz) => {
                const color =
                  sz.stock === 0 ? "hsl(0 74% 45%)" : sz.stock <= 3 ? "hsl(35 80% 40%)" : "hsl(150 45% 30%)";
                return (
                  <div
                    key={sz.name}
                    className="flex justify-between items-center px-3.5 py-2.5 bg-[hsl(210_30%_97%)] rounded-lg text-[13.5px]"
                  >
                    <span className="font-semibold">
                      {t("adminSize")} {sz.name}
                    </span>
                    <span className="font-semibold" style={{ color }}>
                      {sz.stock} {t("adminInStock")}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {editing && form && (
          <div className="flex flex-col gap-3.5">
            <Field label={t("adminArticleNumber")}>
              <Input value={article.articleNumber} disabled />
            </Field>
            <Field label={t("adminProductId")}>
              <Input value={form.product_id} onChange={(e) => updateField("product_id", e.target.value)} />
            </Field>
            <Field label={t("adminNameLabel")}>
              <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("adminPriceLabel")}>
                <Input type="number" step="0.01" value={calcPriceFromCost(form.cost_price)} disabled />
                <span className="text-[11px] text-[hsl(220_13%_55%)]">{t("adminPriceAutoCalculated")}</span>
              </Field>
              <Field label={t("adminCostPrice")}>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => updateField("cost_price", Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("adminMainCategory")}>
                <CategorySelect
                  value={form.main_category}
                  options={mainCategoryOptions}
                  onChange={(v) => updateField("main_category", v)}
                />
              </Field>
              <Field label={t("adminCategory")}>
                <CategorySelect
                  value={form.category}
                  options={categoryOptions}
                  onChange={(v) => updateField("category", v)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("adminColor")}>
                <Input value={form.color_name} onChange={(e) => updateField("color_name", e.target.value)} />
              </Field>
              <Field label={t("adminColorCode")}>
                <div className="flex items-center gap-2">
                  {/* Native color picker - browser-provided, no library
                      needed. It only understands full 6-digit hex, so it
                      falls back to black when the stored value isn't one
                      (blank, a named color, shorthand #abc, ...) rather
                      than breaking; the text field next to it still shows
                      - and can still hold - whatever's actually stored. */}
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(form.color_code) ? form.color_code : "#000000"}
                    onChange={(e) => updateField("color_code", e.target.value)}
                    title={t("adminColorCode")}
                    aria-label={t("adminColorCode")}
                    className="h-10 w-10 shrink-0 rounded-md border border-input cursor-pointer p-0.5 bg-background"
                  />
                  <Input
                    value={form.color_code}
                    onChange={(e) => updateField("color_code", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("adminReturnCategory")}>
                <CategorySelect
                  value={form.return_category}
                  options={returnCategoryOptions}
                  onChange={(v) => updateField("return_category", v)}
                />
              </Field>
              <Field label={t("adminSortOrder")}>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => updateField("sort_order", Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[13.5px]">
              <input
                type="checkbox"
                checked={form.just_stock === "yes"}
                onChange={(e) => updateField("just_stock", e.target.checked ? "yes" : "no")}
              />
              {t("adminJustStock")}
            </label>
            <Field label={t("adminDescription")}>
              <textarea
                className="w-full min-h-[70px] rounded-md border border-[hsl(220_13%_88%)] px-3 py-2 text-[13.5px]"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </Field>
            <Field label={t("adminNotes")}>
              <textarea
                className="w-full min-h-[60px] rounded-md border border-[hsl(220_13%_88%)] px-3 py-2 text-[13.5px]"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11.5px] text-[hsl(220_13%_55%)]">
                {t("adminImages")} <span className="normal-case font-normal">— {t("adminImagesSaveNote")}</span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {imageFilenames.map((fn, i) => (
                  <div
                    key={fn}
                    className="relative group rounded-lg overflow-hidden border border-[hsl(220_13%_88%)] bg-[hsl(210_30%_97%)] aspect-square"
                  >
                    <img
                      src={recordId ? articleFileUrl(recordId, fn) : ""}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={imageBusy || i === 0}
                          onClick={() => handleMoveImage(i, -1)}
                          className="p-1.5 rounded-md bg-white/90 disabled:opacity-40"
                          aria-label={t("adminMoveImageLeft")}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={imageBusy || i === imageFilenames.length - 1}
                          onClick={() => handleMoveImage(i, 1)}
                          className="p-1.5 rounded-md bg-white/90 disabled:opacity-40"
                          aria-label={t("adminMoveImageRight")}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={imageBusy}
                          onClick={() => handleDeleteImage(fn)}
                          className="p-1.5 rounded-md bg-white/90 disabled:opacity-40"
                          aria-label={t("adminDeleteImage")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={imageBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border border-dashed border-[hsl(220_13%_80%)] flex flex-col items-center justify-center gap-1 text-[hsl(220_13%_55%)] hover:bg-[hsl(210_30%_97%)] disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-[11px]">{t("adminAddImage")}</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleAddImageFiles(e.target.files)}
              />
            </div>
            <Field label={t("adminEmbed3d")}>
              <textarea
                className="w-full min-h-[50px] rounded-md border border-[hsl(220_13%_88%)] px-3 py-2 text-[12.5px] font-mono"
                value={form.embed_3d}
                onChange={(e) => updateField("embed_3d", e.target.value)}
              />
            </Field>

            <div className="text-[11px] text-[hsl(220_13%_55%)] uppercase tracking-wide mt-2">
              {t("adminStockLabel")}
            </div>
            <div className="flex flex-col gap-1.5">
              {(() => {
                // Positions among the currently-visible (non-removed) rows
                // only - used so the up/down arrows correctly disable at
                // the true first/last visible row, even when a removed-but-
                // not-yet-saved item is sitting in between in the array.
                const visibleIndices = items.reduce<number[]>((acc, it, i) => {
                  if (!it.removed) acc.push(i);
                  return acc;
                }, []);
                return items.map((it, i) => {
                  if (it.removed) return null;
                  const visiblePos = visibleIndices.indexOf(i);
                  const isFirstVisible = visiblePos === 0;
                  const isLastVisible = visiblePos === visibleIndices.length - 1;
                  return (
                  <div
                    key={it.id || `new-${i}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragItemIndex !== null && dragItemIndex !== i) reorderSizeItems(dragItemIndex, i);
                      setDragItemIndex(null);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md transition-opacity",
                      dragItemIndex === i && "opacity-40",
                    )}
                  >
                    {/* Drag handle - only this small area is draggable, so
                        grabbing it doesn't fight with selecting text in the
                        stock input right next to it. */}
                    <span
                      draggable
                      onDragStart={() => setDragItemIndex(i)}
                      onDragEnd={() => setDragItemIndex(null)}
                      title={t("adminDragToReorder")}
                      aria-label={t("adminDragToReorder")}
                      className="flex items-center justify-center w-5 h-8 shrink-0 cursor-grab active:cursor-grabbing text-[hsl(220_13%_65%)] touch-none"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <div className="flex flex-col shrink-0">
                      <button
                        type="button"
                        disabled={isFirstVisible}
                        onClick={() => moveSizeItem(i, -1)}
                        aria-label={t("adminMoveSizeUp")}
                        title={t("adminMoveSizeUp")}
                        className="flex items-center justify-center h-4 w-4 text-[hsl(220_13%_55%)] disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={isLastVisible}
                        onClick={() => moveSizeItem(i, 1)}
                        aria-label={t("adminMoveSizeDown")}
                        title={t("adminMoveSizeDown")}
                        className="flex items-center justify-center h-4 w-4 text-[hsl(220_13%_55%)] disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-[13px] font-semibold w-14 shrink-0">{it.size}</span>
                    <Input
                      type="number"
                      value={it.stock}
                      onChange={(e) => updateItemStock(i, Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      className="h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  );
                });
              })()}
              <div className="flex items-center gap-2 mt-1">
                <Input
                  placeholder={t("adminSize")}
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  className="h-8 w-20"
                />
                <Input
                  type="number"
                  placeholder="0"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={addSize}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 mt-3">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? t("adminDeleting") : t("adminDeleteArticle")}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={resetEditState} disabled={saving || deleting}>
                  {t("adminCancel")}
                </Button>
                <Button type="button" onClick={save} disabled={saving || deleting}>
                  {saving ? t("adminSaving") : t("adminSave")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
