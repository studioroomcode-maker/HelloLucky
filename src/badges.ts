/**
 * 500 collectible badges, derived purely from the journal (+ a few counters) so they never drift.
 * 100 hand-named ones plus 400 tiers of growing families; half are hidden until earned.
 * Tiers start out of reach for a first day, so early play earns only a couple.
 */

export type BadgeFind = {
  createdAt: string;
  aiDetected: boolean;
  latitude?: number;
  longitude?: number;
  place?: string;
  city?: string;
  note?: string;
  sharedId?: string;
  fortune?: number;
};

export type BadgeCounters = {
  sentLuck: number;
  receivedLuck: number;
  fortunes: number;
  relayed?: number;
  thanksGot?: number;
  thanksGiven?: number;
  homecomings?: number;
};

type Stats = {
  n: number;
  ai: number;
  manual: number;
  streak: number;
  days: number;
  maxPerDay: number;
  cities: number;
  maxKm: number;
  notes: number;
  longNote: boolean;
  pins: number;
  sent: number;
  received: number;
  fortunesSeen: number;
  dates: Date[];
  weekdays: Set<number>;
  months: Set<number>;
  seasons: Set<number>;
  /** Days with 2+ / 3+ finds. */
  days2: number;
  days3: number;
  /** Days with two finds within a minute. */
  quickDays: number;
  /** Distinct calendar months (year + month) with a find. */
  monthsActive: number;
  /** Distinct days with a find, per month of year (0–11), hour (0–23) and weekday (0 = Sunday). */
  monthDays: number[];
  hourDays: number[];
  weekdayDays: number[];
  seasonDays: number[];
  weekendDays: number;
  windowDays: Record<string, number>;
  /** Whole years between the first and the latest find. */
  yearsSpan: number;
  /** Most distinct days spent finding at one spot (50 m). */
  spotDays: number;
  longNotes: number;
  relayed: number;
  thanksGot: number;
  thanksGiven: number;
  homecomings: number;
  comeback: boolean;
  sameSpot: boolean;
  lats: number[];
  lngs: number[];
};

const at = (h: number, m?: number) => (s: Stats) => s.dates.some((d) => d.getHours() === h && (m === undefined || d.getMinutes() === m));
// Ambient badges (season, weekday, time of day) need 3 different days, so one busy session doesn't unlock a pile.
const AMBIENT = 3;
const thrice = (when: (d: Date) => boolean) => (s: Stats) => new Set(s.dates.filter(when).map(dayKey)).size >= AMBIENT;
const between = (from: number, to: number) => thrice((d) => d.getHours() >= from && d.getHours() < to);
const season = (d: Date) => Math.floor(((d.getMonth() + 10) % 12) / 3);
const onDate = (month: number, day: number) => (s: Stats) => s.dates.some((d) => d.getMonth() + 1 === month && d.getDate() === day);

type Badge = { id: string; hidden?: true; test: (s: Stats) => boolean };

export const BADGES: Badge[] = [
  // ── Visible (50) ──
  { id: 'count1', test: (s) => s.n >= 1 },
  { id: 'count3', test: (s) => s.n >= 3 },
  { id: 'count5', test: (s) => s.n >= 5 },
  { id: 'count10', test: (s) => s.n >= 10 },
  { id: 'count20', test: (s) => s.n >= 20 },
  { id: 'count30', test: (s) => s.n >= 30 },
  { id: 'count50', test: (s) => s.n >= 50 },
  { id: 'count100', test: (s) => s.n >= 100 },
  { id: 'count200', test: (s) => s.n >= 200 },
  { id: 'count500', test: (s) => s.n >= 500 },
  { id: 'streak2', test: (s) => s.streak >= 2 },
  { id: 'streak3', test: (s) => s.streak >= 3 },
  { id: 'streak5', test: (s) => s.streak >= 5 },
  { id: 'streak7', test: (s) => s.streak >= 7 },
  { id: 'streak14', test: (s) => s.streak >= 14 },
  { id: 'streak30', test: (s) => s.streak >= 30 },
  { id: 'days10', test: (s) => s.days >= 10 },
  { id: 'days30', test: (s) => s.days >= 30 },
  { id: 'days100', test: (s) => s.days >= 100 },
  { id: 'ai1', test: (s) => s.ai >= 1 },
  { id: 'ai10', test: (s) => s.ai >= 10 },
  { id: 'ai50', test: (s) => s.ai >= 50 },
  { id: 'manual1', test: (s) => s.manual >= 1 },
  { id: 'manual10', test: (s) => s.manual >= 10 },
  { id: 'city2', test: (s) => s.cities >= 2 },
  { id: 'city3', test: (s) => s.cities >= 3 },
  { id: 'city5', test: (s) => s.cities >= 5 },
  { id: 'city10', test: (s) => s.cities >= 10 },
  { id: 'km10', test: (s) => s.maxKm >= 10 },
  { id: 'km100', test: (s) => s.maxKm >= 100 },
  { id: 'km1000', test: (s) => s.maxKm >= 1000 },
  { id: 'note1', test: (s) => s.notes >= 1 },
  { id: 'note10', test: (s) => s.notes >= 10 },
  { id: 'note30', test: (s) => s.notes >= 30 },
  { id: 'pin1', test: (s) => s.pins >= 1 },
  { id: 'pin5', test: (s) => s.pins >= 5 },
  { id: 'pin20', test: (s) => s.pins >= 20 },
  { id: 'send1', test: (s) => s.sent >= 1 },
  { id: 'send5', test: (s) => s.sent >= 5 },
  { id: 'send20', test: (s) => s.sent >= 20 },
  { id: 'send50', test: (s) => s.sent >= 50 },
  { id: 'recv1', test: (s) => s.received >= 1 },
  { id: 'recv5', test: (s) => s.received >= 5 },
  { id: 'recv20', test: (s) => s.received >= 20 },
  { id: 'fortune10', test: (s) => s.fortunesSeen >= 10 },
  { id: 'fortune25', test: (s) => s.fortunesSeen >= 25 },
  { id: 'spring', test: thrice((d) => season(d) === 0) },
  { id: 'summer', test: thrice((d) => season(d) === 1) },
  { id: 'autumn', test: thrice((d) => season(d) === 2) },
  { id: 'winter', test: thrice((d) => season(d) === 3) },
  // ── Hidden (50) ──
  { id: 'count7', hidden: true, test: (s) => s.n >= 7 },
  { id: 'count13', hidden: true, test: (s) => s.n >= 13 },
  { id: 'count44', hidden: true, test: (s) => s.n >= 44 },
  { id: 'count77', hidden: true, test: (s) => s.n >= 77 },
  { id: 'count777', hidden: true, test: (s) => s.n >= 777 },
  { id: 'count1000', hidden: true, test: (s) => s.n >= 1000 },
  { id: 'streak100', hidden: true, test: (s) => s.streak >= 100 },
  { id: 'days365', hidden: true, test: (s) => s.days >= 365 },
  { id: 'ai100', hidden: true, test: (s) => s.ai >= 100 },
  { id: 'city20', hidden: true, test: (s) => s.cities >= 20 },
  { id: 'km5000', hidden: true, test: (s) => s.maxKm >= 5000 },
  { id: 'fortuneAll', hidden: true, test: (s) => s.fortunesSeen >= 50 },
  { id: 'allSeasons', hidden: true, test: (s) => s.seasons.size === 4 },
  { id: 'allMonths', hidden: true, test: (s) => s.months.size === 12 },
  { id: 'allWeekdays', hidden: true, test: (s) => s.weekdays.size === 7 },
  { id: 'monday', hidden: true, test: thrice((d) => d.getDay() === 1) },
  { id: 'friday', hidden: true, test: thrice((d) => d.getDay() === 5) },
  { id: 'weekend', hidden: true, test: (s) => s.weekdays.has(0) && s.weekdays.has(6) },
  { id: 'earlyBird', hidden: true, test: between(6, 8) },
  { id: 'lunch', hidden: true, test: between(12, 13) },
  { id: 'goldenHour', hidden: true, test: between(17, 19) },
  { id: 'time707', hidden: true, test: at(7, 7) },
  { id: 'time1111', hidden: true, test: at(11, 11) },
  { id: 'time1234', hidden: true, test: at(12, 34) },
  { id: 'time444', hidden: true, test: (s) => at(4, 44)(s) || at(16, 44)(s) },
  { id: 'newYear', hidden: true, test: onDate(1, 1) },
  { id: 'valentine', hidden: true, test: onDate(2, 14) },
  { id: 'leapDay', hidden: true, test: onDate(2, 29) },
  { id: 'patrick', hidden: true, test: onDate(3, 17) },
  { id: 'cloverDay', hidden: true, test: onDate(4, 4) },
  { id: 'earthDay', hidden: true, test: onDate(4, 22) },
  { id: 'childrensDay', hidden: true, test: onDate(5, 5) },
  { id: 'luckySeven', hidden: true, test: onDate(7, 7) },
  { id: 'halloween', hidden: true, test: onDate(10, 31) },
  { id: 'elevenEleven', hidden: true, test: onDate(11, 11) },
  { id: 'christmas', hidden: true, test: onDate(12, 25) },
  { id: 'yearEnd', hidden: true, test: onDate(12, 31) },
  { id: 'friday13', hidden: true, test: (s) => s.dates.some((d) => d.getDate() === 13 && d.getDay() === 5) },
  { id: 'double', hidden: true, test: (s) => s.days2 >= AMBIENT },
  { id: 'triple', hidden: true, test: (s) => s.days3 >= AMBIENT },
  { id: 'jackpot', hidden: true, test: (s) => s.maxPerDay >= 5 },
  { id: 'quickPair', hidden: true, test: (s) => s.quickDays >= AMBIENT },
  { id: 'comeback', hidden: true, test: (s) => s.comeback },
  { id: 'sameSpot', hidden: true, test: (s) => s.sameSpot },
  { id: 'novelist', hidden: true, test: (s) => s.longNote },
  { id: 'southern', hidden: true, test: (s) => s.lats.some((v) => v < 0) },
  { id: 'farNorth', hidden: true, test: (s) => s.lats.some((v) => v >= 60) },
];

const HAND_NAMED = BADGES.length;

const steps = (from: number, to: number, by: number) => Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => from + i * by);
const upTo = (n: number) => steps(0, n - 1, 1);

type Family = {
  key: string;
  /** Tiered family: the stat that must reach n. */
  value?: (s: Stats) => number;
  /** Parametric family (month / hour / weekday): n is the parameter. */
  test?: (s: Stats, n: number) => boolean;
  ns: number[];
  /** Every tier hidden (surprises); otherwise the top tiers are hidden to fill half of all badges. */
  hidden?: true;
};

// Hand-named time-of-day badges (3 days) grow into 10- and 30-day tiers. Daylight hours only: nothing rewards
// being out in the dark, which is not safe everywhere.
const WINDOWS = [
  ['earlyBird', 6, 8],
  ['lunch', 12, 13],
  ['goldenHour', 17, 19],
] as const;

// Each family starts beyond what a first day can reach; the count family absorbs the rest so the total is exactly 500.
const FAMILIES: Family[] = [
  { key: 'ai', value: (s) => s.ai, ns: [15, 20, 25, 30, 35, 40, 45, 60, 70, 77, 80, 90, 150, 200, 250, 300, 400, 500, 600, 700, 777, 800, 900, 1000, 2000] },
  { key: 'manual', value: (s) => s.manual, ns: [20, 30, 50, 100, 200] },
  { key: 'days', value: (s) => s.days, ns: [3, 5, 7, 15, 20, 25, 40, 50, 60, 70, 80, 90, 120, 150, 200, 250, 300, 400, 500, 730, 1000] },
  { key: 'streak', value: (s) => s.streak, ns: [4, 6, 8, 10, 12, 15, 18, 21, 25, 28, 35, 40, 45, 50, 60, 77, 90, 120, 150, 200, 365] },
  { key: 'city', value: (s) => s.cities, ns: [4, 6, 7, 8, 9, 12, 15, 25, 30, 35, 40, 50, 60, 70, 77, 80, 90, 100] },
  { key: 'km', value: (s) => s.maxKm, ns: [20, 30, 50, 70, 150, 200, 300, 500, 700, 1500, 2000, 3000, 8000, 10000, 12000, 15000, 20000] },
  { key: 'note', value: (s) => s.notes, ns: [15, 20, 40, 50, 60, 77, 100, 150, 200, 250, 300, 400, 500] },
  { key: 'pin', value: (s) => s.pins, ns: [10, 15, 30, 40, 50, 60, 77, 100, 150, 200, 300] },
  { key: 'send', value: (s) => s.sent, ns: [10, 15, 30, 40, 60, 77, 100, 150, 200, 300, 500, 777, 1000] },
  { key: 'recv', value: (s) => s.received, ns: [10, 15, 30, 40, 50, 60, 70, 77, 100, 150, 200, 300, 365, 500] },
  { key: 'fortune', value: (s) => s.fortunesSeen, ns: [15, 20, 30, 35, 40, 45] },
  { key: 'best', value: (s) => s.maxPerDay, ns: [7, 10, 15, 20], hidden: true },
  { key: 'months', value: (s) => s.monthsActive, ns: [2, 3, 4, 5, 6, 9, 10, 12, 18, 24, 30, 36, 48, 60, 72, 84, 96, 120] },
  { key: 'month', test: (s, n) => s.monthDays[n - 1] >= AMBIENT, ns: steps(1, 12, 1) },
  { key: 'hour', test: (s, n) => s.hourDays[n] >= AMBIENT, ns: steps(6, 19, 1), hidden: true },
  { key: 'wday', test: (s, n) => s.weekdayDays[n] >= 5, ns: upTo(7) },
  { key: 'year', value: (s) => s.yearsSpan, ns: [1, 2, 3, 5, 10], hidden: true },
  { key: 'relay', value: (s) => s.relayed, ns: [1, 2, 3, 5, 7, 10, 15, 20, 30, 40, 50, 77, 100, 150, 200, 300, 500] },
  { key: 'thanked', value: (s) => s.thanksGot, ns: [1, 2, 3, 5, 7, 10, 15, 20, 30, 40, 50, 77, 100, 150, 200, 300, 500] },
  { key: 'thank', value: (s) => s.thanksGiven, ns: [1, 3, 5, 10, 20, 30, 50, 77, 100, 200, 300] },
  { key: 'home', value: (s) => s.homecomings, ns: [1, 2, 3, 5, 10], hidden: true },
  { key: 'spot', value: (s) => s.spotDays, ns: [3, 5, 7, 10, 15, 20, 30, 40, 50, 77, 100] },
  { key: 'essay', value: (s) => s.longNotes, ns: [3, 5, 10, 20, 30, 50] },
  // Days with a find in a season / on weekends / in a time window.
  ...(['spring', 'summer', 'autumn', 'winter'] as const).map((key, i) => ({
    key,
    value: (s: Stats) => s.seasonDays[i],
    ns: [5, 10, 20, 30, 50],
  })),
  { key: 'weekend', value: (s) => s.weekendDays, ns: [5, 10, 20, 50, 100] },
  ...WINDOWS.map(([key]) => ({ key, value: (s: Stats) => s.windowDays[key], ns: [10, 30] })),
];
// Thresholds a hand-named badge already covers (e.g. ai50) are not repeated.
for (const f of FAMILIES) f.ns = f.ns.filter((n) => !BADGES.some((b) => b.id === `${f.key}${n}`));
// Finds: every 5 to 100, every 10 to 300, every 25 to 1000, then wider steps.
const countTiers = [...steps(15, 100, 5), ...steps(110, 300, 10), ...steps(325, 1000, 25), ...steps(1100, 3000, 100), 3333, 4000, 5000, 7777, 10000]
  .filter((n) => !BADGES.some((b) => b.id === `count${n}`));
const countSlots = 500 - BADGES.length - FAMILIES.reduce((sum, f) => sum + f.ns.length, 0);
if (countTiers.length < countSlots) throw new Error('not enough count tiers');
FAMILIES.unshift({
  key: 'count',
  value: (s) => s.n,
  // Keep the climb even: spread the available slots over the whole tier list.
  ns: Array.from({ length: countSlots }, (_, i) => countTiers[Math.round((i * (countTiers.length - 1)) / Math.max(1, countSlots - 1))]),
});

for (const f of FAMILIES) {
  f.ns.forEach((n, i) => {
    const id = `${f.key}${n}`;
    if (BADGES.some((b) => b.id === id)) throw new Error(`duplicate badge ${id}`);
    BADGES.push({
      id,
      hidden: f.hidden,
      test: f.test ? (s) => f.test!(s, n) : (s) => f.value!(s) >= n,
    });
  });
}
// Hide top tiers round-robin across tiered families until half of all badges are hidden.
{
  const open = FAMILIES.filter((f) => !f.hidden && f.value).map((f) => f.ns.map((n) => `${f.key}${n}`));
  let hiddenCount = BADGES.filter((b) => b.hidden).length;
  for (let round = 1; hiddenCount < BADGES.length / 2; round++) {
    let moved = false;
    for (const ids of open) {
      if (hiddenCount >= BADGES.length / 2) break;
      if (ids.length - round < 1) continue; // keep each family's first tier visible
      BADGES.find((b) => b.id === ids[ids.length - round])!.hidden = true;
      hiddenCount++;
      moved = true;
    }
    if (!moved) break;
  }
}

export type BadgeId = (typeof BADGES)[number]['id'];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Longest run of consecutive local calendar days with at least one find. */
export function longestStreak(dates: Date[]) {
  const days = new Set(dates.map(dayKey));
  let best = 0;
  for (const d of dates) {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    if (days.has(dayKey(prev))) continue; // only count from the first day of a run
    let run = 1;
    const next = new Date(d);
    for (;;) {
      next.setDate(next.getDate() + 1);
      if (!days.has(dayKey(next))) break;
      run++;
    }
    best = Math.max(best, run);
  }
  return best;
}

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function stats(finds: BadgeFind[], counters: BadgeCounters): Stats {
  const dates = finds.map((f) => new Date(f.createdAt)).sort((a, b) => a.getTime() - b.getTime());
  const perDay = new Map<string, number>();
  dates.forEach((d) => perDay.set(dayKey(d), (perDay.get(dayKey(d)) ?? 0) + 1));
  const located = finds.filter((f) => f.latitude != null && f.longitude != null);
  let maxKm = 0;
  let sameSpot = false;
  let spotDays = 0;
  // shortcut: O(n²) pair scan, fine for a personal journal (hundreds of finds); bucket by grid if it ever grows to 10k+.
  for (let i = 0; i < located.length; i++) {
    for (let j = i + 1; j < located.length; j++) {
      const a = located[i];
      const b = located[j];
      const d = km(a.latitude!, a.longitude!, b.latitude!, b.longitude!);
      maxKm = Math.max(maxKm, d);
      if (d < 0.05 && dayKey(new Date(a.createdAt)) !== dayKey(new Date(b.createdAt))) sameSpot = true;
    }
    const here = new Set(
      located
        .filter((b) => km(located[i].latitude!, located[i].longitude!, b.latitude!, b.longitude!) < 0.05)
        .map((b) => dayKey(new Date(b.createdAt))),
    );
    spotDays = Math.max(spotDays, here.size);
  }
  const daysBy = (size: number, part: (d: Date) => number) => {
    const sets = Array.from({ length: size }, () => new Set<string>());
    dates.forEach((d) => sets[part(d)].add(dayKey(d)));
    return sets.map((set) => set.size);
  };
  const gaps = dates.slice(1).map((d, i) => d.getTime() - dates[i].getTime());
  const month = (d: Date) => d.getMonth();
  return {
    n: finds.length,
    ai: finds.filter((f) => f.aiDetected).length,
    manual: finds.filter((f) => !f.aiDetected).length,
    streak: longestStreak(dates),
    days: perDay.size,
    maxPerDay: Math.max(0, ...perDay.values()),
    cities: new Set(finds.map((f) => f.city ?? f.place?.split(' ')[0]).filter(Boolean)).size,
    maxKm,
    notes: finds.filter((f) => f.note?.trim()).length,
    longNote: finds.some((f) => (f.note?.trim().length ?? 0) >= 100),
    pins: finds.filter((f) => f.sharedId).length,
    sent: counters.sentLuck,
    received: counters.receivedLuck,
    fortunesSeen: new Set(finds.filter((f) => f.fortune != null).map((f) => f.fortune! % counters.fortunes)).size,
    dates,
    weekdays: new Set(dates.map((d) => d.getDay())),
    months: new Set(dates.map(month)),
    // Northern-hemisphere seasons by month: 0 spring (Mar–May) … 3 winter (Dec–Feb).
    seasons: new Set(dates.map(season)),
    days2: [...perDay.values()].filter((c) => c >= 2).length,
    days3: [...perDay.values()].filter((c) => c >= 3).length,
    quickDays: new Set(gaps.flatMap((g, i) => (g <= 60_000 ? [dayKey(dates[i + 1])] : []))).size,
    monthsActive: new Set(dates.map((d) => `${d.getFullYear()}-${d.getMonth()}`)).size,
    monthDays: daysBy(12, month),
    hourDays: daysBy(24, (d) => d.getHours()),
    weekdayDays: daysBy(7, (d) => d.getDay()),
    seasonDays: daysBy(4, season),
    weekendDays: new Set(dates.filter((d) => d.getDay() === 0 || d.getDay() === 6).map(dayKey)).size,
    windowDays: Object.fromEntries(
      WINDOWS.map(([key, from, to]) => [key, new Set(dates.filter((d) => d.getHours() >= from && d.getHours() < to).map(dayKey)).size]),
    ),
    yearsSpan: dates.length ? Math.floor((dates[dates.length - 1].getTime() - dates[0].getTime()) / (365.25 * 86_400_000)) : 0,
    spotDays,
    longNotes: finds.filter((f) => (f.note?.trim().length ?? 0) >= 100).length,
    relayed: counters.relayed ?? 0,
    thanksGot: counters.thanksGot ?? 0,
    thanksGiven: counters.thanksGiven ?? 0,
    homecomings: counters.homecomings ?? 0,
    comeback: gaps.some((g) => g >= 30 * 86_400_000),
    sameSpot,
    lats: located.map((f) => f.latitude!),
    lngs: located.map((f) => f.longitude!),
  };
}

/** Badge counters from saved settings; `fortunes` is the number of fortune lines in the UI language. */
export function badgeCounters(
  s: { sentLuck: number; receivedLuck: number; relayed: number; thanksGot: number; thanksGiven: number; homecomings: number },
  fortunes: number,
): BadgeCounters {
  const { sentLuck, receivedLuck, relayed, thanksGot, thanksGiven, homecomings } = s;
  return { sentLuck, receivedLuck, relayed, thanksGot, thanksGiven, homecomings, fortunes };
}

export function earnedBadges(finds: BadgeFind[], counters: BadgeCounters): Set<BadgeId> {
  const s = stats(finds, counters);
  return new Set(BADGES.filter((b) => b.test(s)).map((b) => b.id));
}

/** Localized title/description for a badge; hidden badges stay '???' until earned. */
export function badgeText(
  strings: { badges: object; badgeFamilies: object; hiddenTitle: string; hiddenDesc: string },
  id: BadgeId,
  earned: boolean,
) {
  const badge = BADGES.find((b) => b.id === id);
  if (badge?.hidden && !earned) return { title: strings.hiddenTitle, desc: strings.hiddenDesc };
  const named = (strings.badges as Record<string, { title: string; desc: string }>)[id];
  if (named) return named;
  // Family tiers: "count250" → badgeFamilies.count.title(250) / desc(250).
  const [, key, n] = /^([a-zA-Z]+)(\d+)$/.exec(id) ?? [];
  const family = (strings.badgeFamilies as Record<string, { title: (n: number) => string; desc: (n: number) => string }>)[key];
  return family ? { title: family.title(Number(n)), desc: family.desc(Number(n)) } : { title: id, desc: '' };
}

/** Family keys of the 400 tiered badges; every language provides a title/desc builder for each. */
export const BADGE_FAMILIES = FAMILIES.map((f) => f.key);
export const HAND_NAMED_BADGES = HAND_NAMED;

/**
 * How a badge medal looks: one white glyph per kind of badge on a medal whose colour climbs with the tier.
 * Pure, so every one of the 500 badges is checked to get a real glyph (tests/badges.test.mts).
 */
export const GLYPHS = [
  'clover', 'sprout', 'crown', 'flame', 'calendar', 'robot', 'eye', 'pin', 'globe', 'pencil', 'book', 'letter', 'gift',
  'sparkle', 'trophy', 'clock', 'cake', 'arrows', 'heart', 'house', 'blossom', 'sun', 'leaf', 'snowflake', 'star',
  'bolt', 'return',
] as const;
export type Glyph = (typeof GLYPHS)[number];

/** Medal colours from first steps to the rarest tiers. */
export const TIER_COLORS = ['#5FB86B', '#3FA7A0', '#E9B23B', '#EE8A5A', '#9B7BD8', '#E06C9F'] as const;

const SEASON_OF_MONTH: Glyph[] = ['snowflake', 'snowflake', 'blossom', 'blossom', 'blossom', 'sun', 'sun', 'sun', 'leaf', 'leaf', 'leaf', 'snowflake'];

const BY_PREFIX: Record<string, Glyph> = {
  count: 'clover', ai: 'robot', manual: 'eye', days: 'calendar', streak: 'flame', city: 'pin', km: 'globe',
  note: 'pencil', pin: 'pin', send: 'letter', recv: 'gift', fortune: 'sparkle', best: 'trophy', months: 'calendar',
  hour: 'clock', wday: 'calendar', year: 'cake', relay: 'arrows', thanked: 'heart', thank: 'heart', home: 'house',
  spot: 'house', essay: 'book', spring: 'blossom', summer: 'sun', autumn: 'leaf', winter: 'snowflake', weekend: 'sun',
  earlyBird: 'sun', lunch: 'clock', goldenHour: 'sun', time: 'clock',
};

const BY_ID: Record<string, Glyph> = {
  newYear: 'star', valentine: 'heart', leapDay: 'calendar', patrick: 'clover', cloverDay: 'clover', earthDay: 'globe',
  childrensDay: 'star', luckySeven: 'star', halloween: 'star', elevenEleven: 'star', christmas: 'star', yearEnd: 'sparkle',
  friday13: 'sparkle', double: 'trophy', triple: 'trophy', jackpot: 'trophy', quickPair: 'bolt', comeback: 'return',
  sameSpot: 'house', novelist: 'book', southern: 'globe', farNorth: 'globe', allSeasons: 'leaf', allMonths: 'calendar',
  allWeekdays: 'calendar', monday: 'calendar', friday: 'calendar', count3: 'sprout', note10: 'book', note30: 'book',
};

const split = (id: string) => {
  const m = /^([a-zA-Z]+?)(\d+)$/.exec(id);
  return m ? { prefix: m[1], n: Number(m[2]) } : { prefix: id, n: NaN };
};

// Tier rank within each numbered kind (count1 … count10000), computed once.
const RANK = new Map<string, number>();
{
  const groups = new Map<string, { id: string; n: number }[]>();
  for (const { id } of BADGES) {
    const { prefix, n } = split(id);
    if (Number.isNaN(n) || prefix === 'month' || prefix === 'hour' || prefix === 'wday' || prefix === 'time') continue;
    groups.set(prefix, [...(groups.get(prefix) ?? []), { id, n }]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.n - b.n).forEach(({ id }, i) => RANK.set(id, list.length > 1 ? i / (list.length - 1) : 0));
  }
}

export function badgeLook(id: string): { glyph: Glyph; color: string } {
  const { prefix, n } = split(id);
  const rank = RANK.get(id);
  let glyph: Glyph = BY_ID[id] ?? (prefix === 'month' ? SEASON_OF_MONTH[(n - 1) % 12] : BY_PREFIX[prefix]) ?? 'star';
  if (glyph === 'clover' && rank !== undefined && rank >= 0.85) glyph = 'crown'; // the top find counts
  const color =
    rank !== undefined
      ? TIER_COLORS[Math.min(TIER_COLORS.length - 1, Math.floor(rank * TIER_COLORS.length))]
      : TIER_COLORS[[...id].reduce((h, c) => h + c.charCodeAt(0), 0) % TIER_COLORS.length];
  return { glyph, color };
}
