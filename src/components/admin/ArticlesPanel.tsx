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
}

export const ArticlesPanel = ({
  articles,
  categories,
  activeCategory,
  onCategoryChange,
  onSelectArticle,
}: ArticlesPanelProps) => {
  const { t } = useTranslation();

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

      <div className="flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
        {articles.map((art) => {
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
