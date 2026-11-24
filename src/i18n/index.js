import en from './en.json';
import zh from './zh-Hans.json';

export const translations = { en, zh };
const storageKey = 'ball-academy.language';

export function resolveLanguage(query, saved) {
  return [query, saved].find(value => value === 'en' || value === 'zh') ?? 'en';
}

export function readLanguage() {
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch { /* Storage can be disabled. */ }
  return resolveLanguage(new URL(location.href).searchParams.get('lang'), saved);
}

export function setLanguage(lang, persist = false) {
  const strings = translations[lang];
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en';
  document.title = strings.documentTitle;
  document.querySelector('meta[name="description"]').content = strings.subtitle;
  for (const element of document.querySelectorAll('[data-text]')) {
    element.textContent = strings[element.dataset.text];
  }
  for (const element of document.querySelectorAll('[data-label]')) {
    element.setAttribute('aria-label', strings[element.dataset.label]);
  }
  for (const button of document.querySelectorAll('[data-language]')) {
    button.setAttribute('aria-pressed', String(button.dataset.language === lang));
  }
  if (persist) {
    const url = new URL(location.href);
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
    try { localStorage.setItem(storageKey, lang); } catch { /* URL still retains the choice. */ }
  }
}
