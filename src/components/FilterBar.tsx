import { useTranslation } from "@/hooks/useTranslation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { translations } from "@/lib/translations";

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

  // Helper to get label - use translation if exists, otherwise use the key directly
  const getLabel = (labelKey: string): string => {
    if (labelKey in translations) {
      return t(labelKey as keyof typeof translations);
    }
    // Capitalize first letter for display if no translation exists
    return labelKey.charAt(0).toUpperCase() + labelKey.slice(1);
  };

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
              {getLabel(filter.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
