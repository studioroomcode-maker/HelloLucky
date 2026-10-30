/**
 * The Apps in Toss (토스 미니앱) bundle: a web export built by toss/ with EXPO_PUBLIC_TOSS=1 (see TOSS.md).
 * Native builds never set it, so every `IS_TOSS` branch is dead code there.
 */
export const IS_TOSS = process.env.EXPO_PUBLIC_TOSS === '1';

export type TossPhoto = { dataUri?: string; canceled?: boolean; denied?: boolean; unsupported?: boolean; error?: boolean };

// What toss/src/toss-bridge.js puts on window inside the Toss WebView (absent everywhere else), and the app's back hook.
declare global {
  interface Window {
    hlToss?: {
      photo(how: 'camera' | 'album'): Promise<TossPhoto>;
      openURL(url: string): Promise<unknown>;
      /** A https link that opens this mini-app in Toss (intoss://<appName><path>), or undefined. */
      shareLink(path?: string): Promise<string | undefined>;
      /** Toss's share sheet with a text message. */
      sendMessage(message: string): Promise<void>;
    };
    hlTossSave?: (dataUri: string, fileName: string) => Promise<boolean>;
    hlBack?: () => boolean;
  }
}
