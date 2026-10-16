/** Small moments on the home screen: special days and "on this day" memories. Local dates throughout. */

export type SpecialDay = 'cloverDay' | 'patrick' | 'newYear';

/** Card designs used for letters sent on a special day (src/ui/LuckCard.tsx CARDS 8–9). */
export const SPECIAL_CARD: Record<SpecialDay, number> = { cloverDay: 8, patrick: 8, newYear: 9 };

export function specialDay(now: Date): SpecialDay | undefined {
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if (m === 4 && d === 4) return 'cloverDay';
  if (m === 3 && d === 17) return 'patrick';
  if (m === 1 && d === 1) return 'newYear';
  return undefined;
}

export const dayStamp = (now: Date) => `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

/** A find from this calendar day in an earlier year (the most recent such year), if any. */
export function memoryOfToday<T extends { createdAt: string }>(finds: readonly T[], now: Date): { find: T; years: number } | undefined {
  let best: { find: T; years: number } | undefined;
  for (const find of finds) {
    const d = new Date(find.createdAt);
    const years = now.getFullYear() - d.getFullYear();
    if (years < 1 || d.getMonth() !== now.getMonth() || d.getDate() !== now.getDate()) continue;
    if (!best || years < best.years) best = { find, years };
  }
  return best;
}
