import type { Journey, KeptLetter } from './services/sharing';

/** The developer's own anonymous account: the only one that sees WORLD_JOURNEY in a release build. */
export const OWNER_USER_ID = '56a11c19-0fbf-41b8-8a31-cdc771bd8d50';

/** My letter's trip around the world that comes home, shown to OWNER_USER_ID (and in __DEV__). `n`: sender name ids. */
export const WORLD_JOURNEY: Journey = {
  chain: 'sample-world',
  message_key: 1003,
  card_key: 3,
  hops: 10,
  route: [
    { c: '서울', la: 37.6, lo: 127.0, n: 0 },
    { c: '도쿄', la: 35.7, lo: 139.7, n: 169 },
    { c: '방콕', la: 13.8, lo: 100.5, n: 561 },
    { c: '두바이', la: 25.2, lo: 55.3, n: 1127 },
    { c: '이스탄불', la: 41.0, lo: 29.0, n: 405 },
    { c: '파리', la: 48.9, lo: 2.4, n: 1715 },
    { c: '런던', la: 51.5, lo: -0.1, n: 1560 },
    { c: '뉴욕', la: 40.7, lo: -74.0, n: 2270 },
    { c: '리우데자네이루', la: -22.9, lo: -43.2, n: 484 },
    { c: '시드니', la: -33.9, lo: 151.2, n: 203 },
    { c: '서울', la: 37.6, lo: 127.0 },
  ],
  came_home: true,
  started_by_me: true,
  updated_at: '2026-10-20T09:00:00Z',
};

/** Development-only journey (added in __DEV__ by myJourneys) that passes Seoul again so a stamp shows ×2. */
export const SAMPLE_JOURNEYS: Journey[] = [
  {
    chain: 'sample-nearby',
    message_key: 12,
    card_key: 1,
    hops: 2,
    route: [
      { c: '부산', la: 35.2, lo: 129.1 },
      { c: '오사카', la: 34.7, lo: 135.5 },
      { c: '서울', la: 37.6, lo: 127.0 },
    ],
    came_home: false,
    started_by_me: false,
    updated_at: '2026-10-18T09:00:00Z',
  },
];

/** A received cheer that carries its sender's clover, shown to OWNER_USER_ID (and in __DEV__); the list borrows my latest clover for it. */
export const SAMPLE_LETTER: KeptLetter = {
  letter: 'sample-letter',
  message_key: 1003,
  card_key: 2,
  origin: '도쿄',
  hops: 1,
  route: [
    { c: '부산', la: 35.2, lo: 129.1, n: 812 },
    { c: '도쿄', la: 35.7, lo: 139.7, n: 169 },
  ],
  homecoming: false,
  delivered_at: '2026-10-22T09:00:00Z',
  relayed: true,
  thanked: true,
};
