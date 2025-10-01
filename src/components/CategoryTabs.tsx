import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  categories: Array<{ id: string; label: string; count?: number }>;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategoryTabs = ({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) => {
  return (
    <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
      <div className="flex space-x-6 sm:space-x-8 border-b border-border mb-6 sm:mb-8 min-w-max sm:min-w-0">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              "pb-3 px-1 text-sm sm:text-base font-medium transition-colors relative whitespace-nowrap",
              activeCategory === category.id
                ? "text-tab-active"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {category.label}
            {activeCategory === category.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-tab-active" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};