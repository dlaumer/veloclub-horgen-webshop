import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FilterBarProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const FilterBar = ({ activeCategory, onCategoryChange }: FilterBarProps) => {
  const { t } = useTranslation();

  const categories = [
    { id: "all", label: t("all") },
    { id: "men", label: t("men") },
    { id: "women", label: t("women") },
    { id: "kids", label: t("kids") },
    { id: "others", label: t("others") },

  ];

  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-sm text-muted-foreground">{t("filterBy")}:</span>
      <Select value={activeCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
