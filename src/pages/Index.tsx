import { Shop } from "@/components/Shop";
import { LanguageSelector } from "@/components/LanguageSelector";

const Index = () => {
  return (
    <div className="relative">
      <div className="fixed top-4 left-4 z-50">
        <LanguageSelector />
      </div>
      <Shop />
    </div>
  );
};

export default Index;
