/**
 * Web (Toss bundle): no push. expo-notifications has no web implementation of these calls (it throws on start-up),
 * and Toss pushes go through its own console messaging, not Expo tokens (TOSS.md).
 */
export function useJourneyTaps(_ready: boolean) {}

export async function notificationsGranted() {
  return false;
}

export async function enableLuckNotifications() {
  return false;
}
