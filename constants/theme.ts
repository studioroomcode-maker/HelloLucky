import { Platform, useColorScheme } from 'react-native';

import { lang } from '@/src/i18n';
import { useSettings } from '@/src/services/findsStore';

const light = {
  background: '#F5F7F0',
  surface: '#FFFFFF',
  surfaceAlt: '#E9F0E2',
  text: '#16211A',
  muted: '#5B685D',
  border: '#DCE5D5',
  primary: '#2F7D3A',
  onPrimary: '#FFFFFF',
  gold: '#E8B931',
  danger: '#C2410C',
};

const dark: typeof light = {
  background: '#0D130F',
  surface: '#172019',
  surfaceAlt: '#1F2B22',
  text: '#E8F1E8',
  muted: '#9CAB9E',
  border: '#2A372D',
  primary: '#72CF7E',
  onPrimary: '#0D130F',
  gold: '#F2C94C',
  danger: '#FB923C',
};

export type Palette = typeof light;

/** Light by default; Settings can switch to dark or follow the system. */
export function useIsDark() {
  const system = useColorScheme();
  const { theme } = useSettings();
  return theme === 'dark' || (theme === 'system' && system === 'dark');
}

export function usePalette(): Palette {
  return useIsDark() ? dark : light;
}

// Camera UI is always drawn over a live preview, so it uses fixed colors.
export const CameraColors = {
  lock: '#8EF14A',
  candidate: '#FFD76A',
  scrim: 'rgba(8, 14, 10, 0.62)',
  chip: 'rgba(255,255,255,0.16)',
};

/** SD Gothic Neo Round (owner-licensed, assets/fonts), loaded under these names in app/_layout.tsx. */
export const BRAND_FONT = { body: 'SDRound-Regular', medium: 'SDRound-Medium', cute: 'SDRound-ExtraBold' } as const;

/** Faces carry their own weight, so styles pick one instead of fontWeight. The brand face only has Hangul,
 * basic Latin and Cyrillic; other languages use system faces of the same weights rather than mixing fonts mid-word. */
export const FONT: { body: string; medium: string; cute: string } = ['ko', 'en', 'id', 'ru'].includes(lang)
  ? BRAND_FONT
  : Platform.select({
      ios: { body: 'HelveticaNeue', medium: 'HelveticaNeue-Medium', cute: 'HelveticaNeue-Bold' },
      default: { body: 'sans-serif', medium: 'sans-serif-medium', cute: 'sans-serif-black' },
    });
