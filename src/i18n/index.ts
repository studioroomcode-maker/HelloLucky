import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import { ar } from './ar';
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
import { sw } from './sw';
import { th } from './th';
import { vi } from './vi';
import { zhHans } from './zh-Hans';
import { zhHant } from './zh-Hant';

export type { Strings };

const BY_LANGUAGE: Record<string, Strings> = { ar, de, en, es, fr, id, it, ja, ko, pt, ru, sw, th, vi };

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

// The language most people read in each country, for showing a letter the way it arrived there. Countries not
// listed read English.
const COUNTRY_LANGUAGE: Record<string, Strings> = {};
const speak = (strings: Strings, codes: string) => codes.split(' ').forEach((c) => (COUNTRY_LANGUAGE[c] = strings));
speak(ko, 'KR KP');
speak(ja, 'JP');
speak(zhHans, 'CN SG');
speak(zhHant, 'TW HK MO');
speak(es, 'ES MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR GQ');
speak(fr, 'FR MC SN CI ML BF NE TG BJ GA CG CD CM MG HT LU');
speak(de, 'DE AT CH LI');
speak(it, 'IT SM VA');
speak(pt, 'PT BR AO MZ CV GW ST TL');
speak(ru, 'RU BY KZ KG');
speak(ar, 'SA AE EG IQ JO KW LB LY MA OM QA SY TN YE BH DZ SD PS MR');
speak(id, 'ID');
speak(th, 'TH');
speak(vi, 'VN');
speak(sw, 'KE TZ UG');

/** The strings of the language spoken in a country ('KR' → Korean); English when unknown. */
export function stringsForCountry(code?: string | null): Strings {
  return COUNTRY_LANGUAGE[code?.trim().toUpperCase() ?? ''] ?? en;
}

/** Arabic lays the app out right to left (React Native mirrors the layout); arrows and chevrons follow the reading direction. */
export const rtl = I18nManager.isRTL;
export const ARROW = rtl ? '←' : '→';
export const CHEVRON_BACK = rtl ? 'chevron-forward' : 'chevron-back';
export const CHEVRON_FORWARD = rtl ? 'chevron-back' : 'chevron-forward';

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale?.languageTag ?? 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
