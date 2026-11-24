import { en, TranslationKey } from './en';
import { km } from './km';

export const translations = {
  en,
  km,
};

export type Language = 'en' | 'km';

export function t(key: TranslationKey, lang: Language = 'en'): string {
  const dict = translations[lang] || translations.en;
  return dict[key] || translations.en[key] || key;
}

export { en, km };
