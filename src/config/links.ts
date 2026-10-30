/**
 * Link shared with every photo and journey card: the site's /go page sends a phone to its store, where the listing
 * offers Install, or Open when the app is already there (desktops get both store buttons).
 * None in the Toss bundle: a mini-app may not send people to app stores. The env check is inline (not IS_TOSS) so the
 * minifier drops the URL from that bundle entirely (toss/build-src.mjs refuses a bundle that still has it).
 */
export const SHARE_URL = process.env.EXPO_PUBLIC_TOSS === '1' ? '' : 'https://helloluck.studioroomkr.com/go';

/** The invite line under a shared picture: the store page, or in Toss a link that opens this mini-app; '' without one. */
export async function shareLine(t: { shareLink(url: string): string }) {
  const url = SHARE_URL || (await globalThis.window?.hlToss?.shareLink().catch(() => undefined));
  return url ? t.shareLink(url) : '';
}
