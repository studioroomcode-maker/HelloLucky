/**
 * Push for lucky letters. Android needs Firebase (google-services.json) for push tokens; until that is
 * configured registration fails quietly and the in-app mailbox still delivers letters.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { lang } from '../i18n';
import { savePushToken } from './sharing';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** A tapped "your luck is traveling" push opens that journey's map; other pushes just open the app (home has the mail). */
export function useJourneyTaps(ready: boolean) {
  const response = Notifications.useLastNotificationResponse();
  const router = useRouter();
  useEffect(() => {
    const chain = response?.notification.request.content.data?.journey;
    // Navigating before the root Stack mounts throws, so wait until the layout renders it.
    if (!ready || typeof chain !== 'string') return;
    // Handled once: without clearing, the next cold start would reopen the same journey.
    Notifications.clearLastNotificationResponse();
    router.push({ pathname: '/journey/[chain]', params: { chain } });
  }, [ready, response, router]);
}

export async function notificationsGranted() {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Asks for permission (if needed) and registers this device's push token. Returns whether push is on. */
export async function enableLuckNotifications(): Promise<boolean> {
  try {
    if (!Device.isDevice) return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('luck', {
        name: 'Lucky letters',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await savePushToken(data, lang);
    return true;
  } catch (error) {
    console.warn('notifications: registration failed', error);
    return false;
  }
}
