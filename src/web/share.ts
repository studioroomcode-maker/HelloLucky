/**
 * Web stand-in for react-native-share (metro.config.js aliases it on web only): the Web Share API with the picture,
 * and in Toss, where WebViews often lack it, saving the picture to the phone and opening Toss's share sheet with the
 * text, whose invite line carries the intoss:// mini-app link (src/config/links.ts shareLine).
 */
import { Alert } from 'react-native';

import { t } from '@/src/i18n';

type Options = { url?: string; message?: string; type?: string; failOnCancel?: boolean };

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
  // Toss WebViews often lack the Web Share API: save the picture, then share the text (with the mini-app link).
  if (src && window.hlTossSave && (await window.hlTossSave(src, name))) {
    if (message && window.hlToss) {
      await window.hlToss.sendMessage(message);
      return { success: true, message: '' };
    }
    Alert.alert(t.journeySaved);
    return { success: false, message: '' };
  }
  throw new Error('share: not available here');
}

export default { open };
