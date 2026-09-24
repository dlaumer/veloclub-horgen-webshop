import { useMemo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { EnrichedArticle } from "@/types/admin";
import { fmtMoney } from "@/lib/adminFormat";
import { cn } from "@/lib/utils";

interface ArticlesPanelProps {
  articles: EnrichedArticle[];
  categories: string[];
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  onSelectArticle: (id: string) => void;
  // Product (not per-color-variant) reordering - only meaningful, and only
  // ever passed as true, when `articles` is the complete, unfiltered list
  // (category = "all" and the global search box is empty). sort_order is a
  // SINGLE GLOBAL ranking across every product (see /api/stock in
  // veloclub.pb.js), so reordering within a filtered/searched subset would
  // reintroduce exactly the "which number do I even pick" problem this
  // feature exists to avoid - AdminDashboard.tsx gates this off in that
  // case rather than this component guessing at it.
  reorderMode?: boolean;
  onMoveProduct?: (productId: string, direction: -1 | 1) => void;
  movingProductId?: string | null;
}

export const ArticlesPanel = ({
  articles,
  categories,
  activeCategory,
  onCategoryChange,
  onSelectArticle,
  reorderMode = false,
  onMoveProduct,
  movingProductId = null,
}: ArticlesPanelProps) => {
  const { t } = useTranslation();

  // In reorder mode, collapse the flat per-color-variant list down to one
  // row per product (using its first-seen color variant to represent it) -
  // `articles` arrives already in product sort_order sequence (it's built
  // from /api/stock, which is pre-sorted), so a product's colors are always
  // consecutive and "first occurrence" is stable.
  const productRows = useMemo(() => {
    if (!reorderMode) return [];
    const seen = new Set<string>();
    const rows: Array<{ article: EnrichedArticle; colorCount: number }> = [];
    for (const art of articles) {
      if (seen.has(art.productId)) continue;
      seen.add(art.productId);
      const colorCount = articles.filter((a) => a.productId === art.productId).length;
      rows.push({ article: art, colorCount });
    }
    return rows;
  }, [articles, reorderMode]);

  return (
    <div className="bg-white border border-[hsl(220_13%_90%)] rounded-2xl p-5 flex flex-col gap-3.5 h-full min-h-0 overflow-hidden">
      <div className="flex justify-between items-center gap-3 flex-wrap shrink-0">
        <h2 className="m-0 text-[17px] font-semibold">{t("adminArticlesTitle")}</h2>
        <div className="flex gap-1.5 flex-wrap">
          {["all", ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[12.5px] font-semibold cursor-pointer border",
                activeCategory === cat
                  ? "border-[hsl(227_69%_31%)] bg-[hsl(227_69%_31%)] text-white"
                  : "border-[hsl(220_13%_88%)] bg-white text-[hsl(220_13%_35%)]",
              )}
            >
              {cat === "all" ? t("adminAllCategories") : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[11.5px] text-[hsl(220_13%_55%)] -mt-1 shrink-0">
        {reorderMode ? t("adminReorderHint") : t("adminReorderUnavailable")}
      </div>

      <div className="flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
        {reorderMode
          ? productRows.map(({ article: art, colorCount }, index) => {
              const isMoving = movingProductId === art.productId;
              const isFirst = index === 0;
              const isLast = index === productRows.length - 1;
              return (
                <div
                  key={art.productId}
                  className={cn(
                    "flex gap-2.5 items-center px-3.5 py-2.5 border border-[hsl(220_13%_90%)] rounded-[10px] bg-white transition-opacity",
                    isMoving && "opacity-50",
                  )}
                >
                  <div className="flex flex-col shrink-0">
                    <button
                      type="button"
                      disabled={isFirst || isMoving}
                      onClick={() => onMoveProduct?.(art.productId, -1)}
                      aria-label={t("adminMoveSizeUp")}
                      title={t("adminMoveSizeUp")}
                      className="flex items-center justify-center h-4 w-4 text-[hsl(220_13%_55%)] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast || isMoving}
                      onClick={() => onMoveProduct?.(art.productId, 1)}
                      aria-label={t("adminMoveSizeDown")}
                      title={t("adminMoveSizeDown")}
                      className="flex items-center justify-center h-4 w-4 text-[hsl(220_13%_55%)] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  <div
                    onClick={() => onSelectArticle(art.id)}
                    className="flex gap-2.5 items-center min-w-0 flex-1 cursor-pointer"
                  >
                    <img
                      src={art.image}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[hsl(220_13%_90%)] bg-[hsl(210_30%_97%)]"
                    />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <span className="text-[13.5px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                          {art.name}
                        </span>
                        <span className="text-[13px] text-[hsl(220_13%_45%)] shrink-0">{fmtMoney(art.price)}</span>
                      </div>
                      <span className="text-[11.5px] text-[hsl(220_13%_55%)]">
                        {colorCount > 1 ? `${colorCount} ${t("adminColorsCount")}` : art.colorName}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          : articles.map((art) => {
              const totalStock = art.sizes.reduce((s, sz) => s + sz.stock, 0);
              const hasLow = art.sizes.some((sz) => sz.stock > 0 && sz.stock <= 3);
              const isOut = totalStock === 0;
              const flagLabel = isOut ? t("adminOutOfStock") : hasLow ? t("adminLowStock") : "";
              const flagColor = isOut ? "hsl(0 74% 45%)" : "hsl(35 80% 40%)";
              const stockSummary = art.sizes.map((sz) => `${sz.name}:${sz.stock}`).join("  ");

              return (
                <div
                  key={art.id}
                  onClick={() => onSelectArticle(art.id)}
                  className="flex gap-2.5 items-center px-3.5 py-2.5 border border-[hsl(220_13%_90%)] rounded-[10px] cursor-pointer bg-white hover:bg-[hsl(210_30%_97%)]"
                >
                  <img
                    src={art.image}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[hsl(220_13%_90%)] bg-[hsl(210_30%_97%)]"
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                    style={{ background: art.colorCode || "#e5e5e5" }}
                  />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-[13.5px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                        {art.name}
                      </span>
                      <span className="text-[13px] text-[hsl(220_13%_45%)] shrink-0">{fmtMoney(art.price)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-[11.5px] text-[hsl(220_13%_55%)] overflow-hidden text-ellipsis whitespace-nowrap">
                        {art.colorName} · {stockSummary}
                      </span>
                      {flagLabel && (
                        <span className="text-[11px] font-semibold shrink-0" style={{ color: flagColor }}>
                          {flagLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

        {articles.length === 0 && (
          <div className="py-4 text-center text-[hsl(220_13%_55%)] text-[13px]">{t("adminNoResults")}</div>
        )}
      </div>
    </div>
  );
};
