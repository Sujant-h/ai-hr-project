import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
// Without this, useTranslation has no instance to read and every component
// renders its raw key ("candidates.fallback") instead of the string a recruiter
// would see — so an assertion on visible text tests nothing.
import i18n from '../i18n/config';
import { DEFAULT_LANGUAGE } from '../i18n/config';

// The language is global and persists across a file's tests, so a test that
// switches it would otherwise leak into the next one.
beforeEach(async () => {
  await i18n.changeLanguage(DEFAULT_LANGUAGE);
});

afterEach(() => {
  cleanup();
});
