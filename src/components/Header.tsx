import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

interface HeaderProps {
  activeMainCategory: string;
  onMainCategoryChange: (category: string) => void;
}

export const Header = ({ activeMainCategory, onMainCategoryChange }: HeaderProps) => {
  const { t } = useTranslation();

  const mainCategories = [
    // { id: "velokleider", labelKey: "velokleider" as const },
    { id: "thomus", labelKey: "thomus" as const },
    // { id: "vch", labelKey: "vch" as const },
    // { id: "sonderkationen", labelKey: "sonderkationen" as const },
  ];

  return (
    <header className="border-b border-border bg-background sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-3 sm:px-6">
        <nav className="py-4 pr-32 sm:pr-0">
          <div className="flex items-center space-x-6 sm:space-x-8 overflow-x-auto scrollbar-hide">
            <img src={logo} alt="Veloclub Horgen Logo" className="h-10 w-10 flex-shrink-0" />
            {mainCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => onMainCategoryChange(category.id)}
                className={cn(
                  "text-sm sm:text-base font-semibold transition-colors relative pb-1 whitespace-nowrap flex-shrink-0",
                  activeMainCategory === category.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(category.labelKey)}
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
