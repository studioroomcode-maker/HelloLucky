/**
 * Web stand-in for react-native-share (metro.config.js aliases it on web only): the Web Share API with the picture,
 * and in Toss, where WebViews often lack it, saving the picture to the phone instead (toss-bridge saveImage).
 * shortcut: no Toss friend-message share yet (Share.sendMessage / intoss:// links), see TOSS.md §8.
 */
import { Alert } from 'react-native';

import { t } from '@/src/i18n';

type Options = { url?: string; message?: string; type?: string; failOnCancel?: boolean };

declare global {
  interface Window {
    hlTossSave?: (dataUri: string, fileName: string) => Promise<boolean>;
  }
}

async function open({ url, message, type = 'image/jpeg' }: Options) {
  // Callers add file:// to what view-shot returns; on web that is a data: URI.
  const src = url?.replace(/^file:\/\/(?=data:|blob:)/, '');
  const blob = src ? await (await fetch(src)).blob() : undefined;
  const name = `hello-luck.${type.split('/')[1] ?? 'jpg'}`;
  const data: ShareData = { text: message || undefined, files: blob ? [new File([blob], name, { type })] : undefined };
  if (navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
      return { success: true, message: '' };
    } catch {
      return { success: false, dismissedAction: true, message: '' };
    }
  }
  if (src && window.hlTossSave && (await window.hlTossSave(src, name))) {
    Alert.alert(t.journeySaved);
    return { success: false, message: '' };
  }
  throw new Error('share: not available here');
}

export default { open };
