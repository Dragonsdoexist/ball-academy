import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveLanguage, translations } from '../../src/i18n/index.js';
import glossary from '../../src/i18n/glossary.json';

describe('release language coverage', () => {
  it('ships the same complete dictionary for both languages', () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.zh).sort());
    for (const dictionary of Object.values(translations)) {
      for (const value of Object.values(dictionary)) expect(value.trim()).not.toBe('');
    }
  });
  it('resolves every label declared in the viewer', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    for (const match of html.matchAll(/data-(?:text|label)="([^"]+)"/g)) {
      expect(translations.en).toHaveProperty(match[1]);
    }
  });
  it('uses the project terms in the Chinese subtitle', () => {
    for (const term of ['scrotum','testis','spermatic_cord']) expect(translations.zh.subtitle).toContain(glossary[term]);
  });
  it.each([
    ['zh', 'en', 'zh'], ['en', 'zh', 'en'], [null, 'zh', 'zh'],
    ['fr', 'zh', 'zh'], [null, null, 'en'], ['toString', 'invalid', 'en']
  ])('resolves URL %s and preference %s to %s', (query, saved, expected) => {
    expect(resolveLanguage(query, saved)).toBe(expected);
  });
});
