import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslations from './locales/en.json';
import deTranslations from './locales/de.json';

export const SUPPORTED_LANGUAGES = ['en', 'de'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * English is the default for a first-time visitor, deliberately: the browser's
 * own locale is NOT consulted. The product is presented in English, and a German
 * browser landing on a German UI it never asked for is the bug this replaced.
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const STORAGE_KEY = 'lang';

export function isSupported(value: unknown): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

/**
 * The only language the app is allowed to act on. i18n.language can carry a
 * region ("en-GB") or a value restored from a stale localStorage entry, and it
 * is also sent to the API, whose `lang` is a strict enum.
 */
export function currentLanguage(): SupportedLanguage {
  return isSupported(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

function storedLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isSupported(saved) ? saved : DEFAULT_LANGUAGE;
  } catch {
    // Private mode / disabled storage must not stop the app from rendering.
    return DEFAULT_LANGUAGE;
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    de: { translation: deTranslations },
  },
  lng: storedLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    escapeValue: false, // react already safes from xss
  },
});

// Persisted here rather than in the switcher so that every way of changing the
// language — including a future deep link — is remembered the same way.
i18n.on('languageChanged', (lng) => {
  if (!isSupported(lng)) return;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // A language that cannot be persisted still applies to this session.
  }
  document.documentElement.lang = lng;
});

document.documentElement.lang = currentLanguage();

export default i18n;
