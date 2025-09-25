import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  categories: Array<{ id: string; label: string; count?: number }>;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategoryTabs = ({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) => {
  return (
    <div className="flex space-x-8 border-b border-border mb-8">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          className={cn(
            "pb-3 px-1 text-base font-medium transition-colors relative",
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
  );
};