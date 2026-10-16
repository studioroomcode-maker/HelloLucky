import { t } from './i18n';

/** The fortune line for a find; older finds without a stored seed get a stable one from their id. */
export function fortuneFor(find: { id: string; fortune?: number }) {
  const seed = find.fortune ?? [...find.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return t.fortunes[seed % t.fortunes.length];
}
