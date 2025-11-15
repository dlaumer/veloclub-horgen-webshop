import { useLanguage } from '@/contexts/LanguageContext';
import { Language } from '@/lib/translations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

export const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
      <SelectTrigger className="w-[80px] sm:w-[90px] h-9 sm:h-10 bg-background border-border flex-shrink-0">
        <Globe className="h-4 w-4 mr-1 flex-shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[60]">
        <SelectItem value="en">EN</SelectItem>
        <SelectItem value="de">DE</SelectItem>
      </SelectContent>
    </Select>
  );
};
