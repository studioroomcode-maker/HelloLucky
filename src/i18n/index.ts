import { getLocales } from 'expo-localization';

import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { id } from './id';
import { it } from './it';
import { ja } from './ja';
import { ko, type Strings } from './ko';
import { pt } from './pt';
import { ru } from './ru';
import { th } from './th';
import { vi } from './vi';
import { zhHans } from './zh-Hans';
import { zhHant } from './zh-Hant';

export type { Strings };

const BY_LANGUAGE: Record<string, Strings> = { de, en, es, fr, id, it, ja, ko, pt, ru, th, vi };

const locale = getLocales()[0];

function pickLanguage(): string {
  const code = locale?.languageCode ?? 'en';
  if (code === 'zh') {
    // Traditional script for Taiwan / Hong Kong / Macau or an explicit Hant tag, Simplified otherwise.
    const tag = locale?.languageTag ?? '';
    return /Hant|TW|HK|MO/i.test(tag) || /^(TW|HK|MO)$/.test(locale?.regionCode ?? '') ? 'zh-Hant' : 'zh-Hans';
  }
  return code in BY_LANGUAGE ? code : 'en';
}

/** Active UI language code (also sent to the server so pushes arrive in a fitting language). */
export const lang = pickLanguage();
export const t: Strings = lang === 'zh-Hant' ? zhHant : lang === 'zh-Hans' ? zhHans : BY_LANGUAGE[lang];

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale?.languageTag ?? 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
