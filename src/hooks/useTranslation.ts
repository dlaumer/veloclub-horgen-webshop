import { useLanguage } from '@/contexts/LanguageContext';
import { translations, TranslationKey } from '@/lib/translations';

export const useTranslation = () => {
  const { language } = useLanguage();

  const t = (key: TranslationKey): string => {
    return translations[key][language];
  };

  return { t };
};
