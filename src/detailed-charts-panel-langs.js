/* detailed-charts-panel-langs.js */
import { en } from './lang-en.js';
import { de } from './lang-de.js';

const translations = { en, de };
let currentLanguage = 'en';

export function setLanguage(lang) {
    if (!lang) return;
    // Handle cases like "en-US", "de-DE" by taking the first part
    const shortLang = lang.split('-')[0];
    currentLanguage = translations[shortLang] ? shortLang : 'en';
}

export function t(key) {
    // 1. Try current language
    const val = translations[currentLanguage]?.[key];
    if (val !== undefined) return val;

    // 2. Fallback to English
    const fallback = translations.en?.[key];
    if (fallback !== undefined) return fallback;

    // 3. Fallback to key itself
    return key;
}
