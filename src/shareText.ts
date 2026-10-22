import * as Clipboard from 'expo-clipboard';
import { Platform, ToastAndroid } from 'react-native';

import { t } from './i18n';

/** Many apps (KakaoTalk, Instagram) keep only the image of an image + text share, so the text also goes to the clipboard. */
export async function copyShareText(message: string) {
  await Clipboard.setStringAsync(message).catch(() => {});
  if (Platform.OS === 'android') ToastAndroid.show(t.shareTextCopied, ToastAndroid.LONG);
}
