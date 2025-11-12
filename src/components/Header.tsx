import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

interface HeaderProps {
  activeMainCategory: string;
  onMainCategoryChange: (category: string) => void;
}

export const Header = ({ activeMainCategory, onMainCategoryChange }: HeaderProps) => {
  const { t } = useTranslation();

  const mainCategories = [
    { id: "velokleider", label: "Velokleider" },
    { id: "thomus", label: "Thömus Bike & Parts" },
    { id: "vch", label: "VCH Bike & Parts" },
    { id: "sonderkationen", label: "Sonderkationen" },
  ];

  return (
    <header className="border-b border-border bg-background sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-3 sm:px-6">
        <nav className="flex items-center justify-between py-4">
          <div className="flex items-center space-x-8">
            {mainCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => onMainCategoryChange(category.id)}
                className={cn(
                  "text-sm sm:text-base font-semibold transition-colors relative pb-1 whitespace-nowrap",
                  activeMainCategory === category.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {category.label}
                {activeMainCategory === category.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
};
