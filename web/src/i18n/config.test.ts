import { describe, it, expect } from 'vitest';
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, currentLanguage, isSupported } from './config';
import en from './locales/en.json';
import de from './locales/de.json';

/** Every leaf key, flattened to "a.b.c" so the two files can be compared. */
function keysOf(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object' ? keysOf(v as Record<string, unknown>, path) : [path];
  });
}

describe('locale catalogues', () => {
  it('define exactly the same keys', () => {
    // A key present in one file and not the other renders as a raw
    // "questions.draftFailed" to whoever picked the other language.
    const enKeys = keysOf(en).sort();
    const deKeys = keysOf(de).sort();
    expect(deKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !deKeys.includes(k))).toEqual([]);
  });

  it('leave no value empty', () => {
    for (const cat of [en, de]) {
      for (const key of keysOf(cat)) {
        expect(i18n.getFixedT(cat === en ? 'en' : 'de')(key), key).toBeTruthy();
      }
    }
  });
});

describe('default language', () => {
  it('is English', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('is what a first-time visitor gets, rather than their browser locale', () => {
    // The bug this replaced: a German browser was served a German UI it never
    // asked for. Nothing here may consult navigator.language.
    expect(i18n.options.lng).toBe('en');
  });
});

describe('currentLanguage', () => {
  it('narrows a region tag to a language we actually support', async () => {
    await i18n.changeLanguage('en-GB');
    expect(currentLanguage()).toBe('en');
    await i18n.changeLanguage('en');
  });

  it('falls back rather than returning something the API would reject', async () => {
    await i18n.changeLanguage('klingon');
    expect(currentLanguage()).toBe('en');
    await i18n.changeLanguage('en');
  });

  it('accepts every supported language', async () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      await i18n.changeLanguage(lang);
      expect(currentLanguage()).toBe(lang);
    }
    await i18n.changeLanguage('en');
  });
});

describe('isSupported', () => {
  it('rejects anything outside the union', () => {
    expect(isSupported('en')).toBe(true);
    expect(isSupported('de')).toBe(true);
    expect(isSupported('fr')).toBe(false);
    expect(isSupported(null)).toBe(false);
    expect(isSupported(undefined)).toBe(false);
  });
});

describe('persistence', () => {
  it('remembers the choice, so a reload does not reset it to English', async () => {
    await i18n.changeLanguage('de');
    expect(localStorage.getItem('lang')).toBe('de');
    await i18n.changeLanguage('en');
    expect(localStorage.getItem('lang')).toBe('en');
  });

  it('keeps <html lang> in step, for screen readers and hyphenation', async () => {
    await i18n.changeLanguage('de');
    expect(document.documentElement.lang).toBe('de');
    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
