import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/hooks/useTranslation";
import { fmtMoney } from "@/lib/adminFormat";
import { EnrichedArticle } from "@/types/admin";

interface ArticleModalProps {
  article: EnrichedArticle | null;
  onClose: () => void;
}

export const ArticleModal = ({ article, onClose }: ArticleModalProps) => {
  const { t } = useTranslation();

  if (!article) return null;

  return (
    <Dialog open={!!article} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px] max-h-[86vh] overflow-y-auto p-7">
        <DialogTitle className="sr-only">{t("adminArticleDetails")}</DialogTitle>

        <div className="flex gap-3 items-center mb-4.5">
          <img
            src={article.image}
            alt=""
            className="w-14 h-14 rounded-[10px] object-cover shrink-0 border border-[hsl(220_13%_90%)] bg-[hsl(210_30%_97%)]"
          />
          <div>
            <div className="text-[11px] text-[hsl(220_13%_55%)] uppercase tracking-wide mb-1">
              {t("adminArticleDetails")}
            </div>
            <div className="text-lg font-bold">{article.name}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5 mb-5 text-[13.5px]">
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminArticleNumber")}</div>
            <div>{article.articleNumber}</div>
          </div>
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminPriceLabel")}</div>
            <div>{fmtMoney(article.price)}</div>
          </div>
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminColor")}</div>
            <div>{article.colorName}</div>
          </div>
          <div>
            <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminCategory")}</div>
            <div>{article.category}</div>
          </div>
          {article.description && (
            <div className="col-span-2">
              <div className="text-[hsl(220_13%_55%)] text-[11.5px] mb-0.5">{t("adminDescription")}</div>
              <div>{article.description}</div>
            </div>
          )}
        </div>

        <div className="text-[11px] text-[hsl(220_13%_55%)] uppercase tracking-wide mb-2">
          {t("adminStockLabel")}
        </div>
        <div className="flex flex-col gap-1.5">
          {article.sizes.map((sz) => {
            const color = sz.stock === 0 ? "hsl(0 74% 45%)" : sz.stock <= 3 ? "hsl(35 80% 40%)" : "hsl(150 45% 30%)";
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
      </DialogContent>
    </Dialog>
  );
};
