import { useTranslation } from "@/hooks/useTranslation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FilterOption {
  id: string;
  labelKey: string;
}

interface FilterBarProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  filters: FilterOption[];
}

export const FilterBar = ({ activeCategory, onCategoryChange, filters }: FilterBarProps) => {
  const { t } = useTranslation();

  // Don't render if no filters available
  if (!filters || filters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-sm text-muted-foreground">{t("filterBy")}:</span>
      <Select value={activeCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {filters.map((filter) => (
            <SelectItem key={filter.id} value={filter.id}>
              {t(filter.labelKey as any)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
