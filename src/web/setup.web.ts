/**
 * Web (Toss bundle) start-up patches, imported once by app/_layout.tsx:
 *  - Alert.alert: react-native-web's is a no-op, which would swallow errors and the map's report / block menu.
 *  - Linking.openURL: through the Toss SDK (outside browser), never navigating the mini-app's WebView away.
 *  - window.hlBack: the Toss back button / Android back (toss/src/toss-bridge.js) steps back through the router.
 */
import { router } from 'expo-router';
import { Alert, Linking, type AlertButton } from 'react-native';

// constants/theme.ts light palette (the Toss bundle is light only).
const COLORS = { text: '#16211A', muted: '#5B685D', primary: '#38A34A', danger: '#C2410C', button: '#E9F0E2' };

function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const list = buttons?.length ? buttons : [{ text: 'OK' }];
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.4)';
  const box = document.createElement('div');
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.style.cssText = `width:100%;max-width:340px;background:#fff;border-radius:20px;padding:22px 20px 16px;font-family:inherit;color:${COLORS.text};box-shadow:0 12px 32px rgba(0,0,0,.2)`;
  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.cssText = 'font-size:17px;font-weight:700;line-height:1.4;white-space:pre-line';
  box.appendChild(heading);
  if (message) {
    const body = document.createElement('div');
    body.textContent = message;
    body.style.cssText = `margin-top:8px;font-size:15px;line-height:1.5;color:${COLORS.muted};white-space:pre-line`;
    box.appendChild(body);
  }
  const row = document.createElement('div');
  row.style.cssText = `margin-top:18px;display:flex;flex-direction:${list.length > 2 ? 'column' : 'row'};gap:8px`;
  const close = (button?: AlertButton) => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    button?.onPress?.();
  };
  const cancel = list.find((b) => b.style === 'cancel');
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(cancel);
  for (const button of list) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = button.text ?? 'OK';
    const color = button.style === 'destructive' ? COLORS.danger : button.style === 'cancel' ? COLORS.muted : COLORS.primary;
    el.style.cssText = `flex:1;min-height:48px;border:0;border-radius:14px;font:inherit;font-size:16px;font-weight:700;cursor:pointer;color:${color};background:${COLORS.button}`;
    el.onclick = () => close(button);
    row.appendChild(el);
  }
  box.appendChild(row);
  overlay.appendChild(box);
  // A tap outside counts as cancel only when there is one, like the native sheet.
  overlay.onclick = (e) => e.target === overlay && cancel && close(cancel);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  (row.lastElementChild as HTMLButtonElement | null)?.focus();
}

Alert.alert = (title, message, buttons) => showAlert(title, message, buttons);

const openInBrowser = Linking.openURL.bind(Linking);
Linking.openURL = (url: string) => (window.hlToss ? window.hlToss.openURL(url) : openInBrowser(url));

/** True when the app stepped back; false at the first screen, where the bridge closes the mini-app. */
window.hlBack = () => {
  if (router.canGoBack()) {
    router.back();
    return true;
  }
  if (location.pathname !== '/') {
    router.replace('/');
    return true;
  }
  return false;
};
