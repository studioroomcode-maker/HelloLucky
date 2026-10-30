// 앱인토스 SDK 브리지 — 웹 번들(Expo web export)이 쓰는 토스 기능만 골라 window 에 내놓는다.
//
// vite build 가 이 파일을 SDK 와 함께 한 덩어리 IIFE(dist/toss-bridge.js)로 묶고,
// build-src.mjs 가 index.html 의 앱 스크립트보다 먼저 싣는다 — 앱이 시작할 때 이미 있다.
// 개발 서버(npm run dev)에서는 모듈로 붙고, devtools 플러그인이 SDK 를 가짜(mock)로 바꾼다.
//
// 앱이 쓰는 것(앱 쪽 코드는 window.hlToss 가 없으면 브라우저 기본 동작으로 간다):
//   hlToss.photo(how)          'camera' | 'album' → {dataUri} · {canceled} · {denied} · {unsupported} · {error}
//                              src/services/stillPhoto.web.ts — 실시간 카메라(getUserMedia)를 못 쓸 때
//   hlToss.openURL(url)        외부 링크(길찾기)를 토스 밖 브라우저로 — src/web/setup.web.ts 의 Linking.openURL
//   hlTossSave(dataUri, name)  이미지를 기기에 저장(File.saveBase64) → true/false — src/web/share.ts
//   (뒤로가기)                 backEvent → window.hlBack() 이 한 단계 돌아갔으면 끝, 아니면 미니앱을 닫는다
//   (위치)                     navigator.geolocation.getCurrentPosition 을 토스 위치(Device.getLocation)로 먼저 받는다
import {
  Device,
  graniteEvent,
  Screen,
  File as TossFile,
  Accuracy,
  OpenCameraPermissionError,
  FetchAlbumPhotosPermissionError,
  GetCurrentLocationPermissionError,
} from '@apps-in-toss/web-framework';

// 토스 앱 웹뷰 안(또는 devtools 가 SDK 를 흉내 내는 개발 서버)에서만 붙는다. 그냥 브라우저로 dist 를 열면
// 아무것도 안 바꾼다 — 앱은 브라우저 기본 동작(파일 선택·window.open·웹 위치)으로 간다.
const IN_TOSS = import.meta.env.DEV || !!window.ReactNativeWebView;

// 인식에 쓰는 해상도 — 웹 카메라 1920 과 맞춘다(SDK 기본 1024 는 네잎이 너무 작게 찍힌다)
const MAX_WIDTH = 1920;

function isPermissionError(e, Cls) {
  try { if (Cls && e instanceof Cls) return true; } catch (_) {}
  const n = (e && e.name) || '';
  return /PermissionError/.test(n) || (e && e.code === 'NOT_ALLOWED');
}

async function takePhoto(how, retried) {
  try {
    if (how === 'album') {
      const items = Device.getAlbumItems && Device.getAlbumItems.isSupported && Device.getAlbumItems.isSupported()
        ? await Device.getAlbumItems({ types: ['PHOTO'], maxCount: 1, maxWidth: MAX_WIDTH, base64: true })
        : await Device.getPhotos({ maxCount: 1, maxWidth: MAX_WIDTH, base64: true });
      if (!items || !items.length || !items[0].dataUri) return { canceled: true };
      return { dataUri: items[0].dataUri };
    }
    const img = await Device.openCamera({ base64: true, maxWidth: MAX_WIDTH });
    if (!img || !img.dataUri) return { canceled: true };
    return { dataUri: img.dataUri };
  } catch (e) {
    if (e && e.code === 'UNSUPPORTED_APP_VERSION') return { unsupported: true };
    const Cls = how === 'album' ? FetchAlbumPhotosPermissionError : OpenCameraPermissionError;
    if (isPermissionError(e, Cls)) {
      // 한 번은 토스 권한 창으로 다시 묻는다. 거절하면 앱이 안내 문구를 보여 준다.
      if (!retried) {
        try {
          const fn = how === 'album' ? Device.getPhotos : Device.openCamera;
          const st = fn && fn.openPermissionDialog ? await fn.openPermissionDialog() : 'denied';
          if (st === 'allowed') return takePhoto(how, true);
        } catch (_) {}
      }
      return { denied: true };
    }
    return { error: true };
  }
}

async function saveImage(dataUri, fileName) {
  try {
    if (!TossFile.saveBase64 || (TossFile.saveBase64.isSupported && !TossFile.saveBase64.isSupported())) return false;
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUri));
    if (!m) return false;
    await TossFile.saveBase64({ data: m[3], fileName: fileName || 'hello-luck.jpg', mimeType: m[1] || 'image/jpeg' });
    return true;
  } catch (_) { return false; }
}

// ── 뒤로가기 — 구독하면 토스의 기본 동작(닫기)이 막히고 여기로 온다 ──
function onBack() {
  try { if (typeof window.hlBack === 'function' && window.hlBack()) return; } catch (_) {}
  Screen.close().catch(() => {});
}
if (IN_TOSS) {
  try {
    graniteEvent.addEventListener('backEvent', { onEvent: onBack, onError: () => {} });
  } catch (_) {}
}

// ── 위치 — expo-location(웹)은 navigator.geolocation 을 쓴다. 토스 위치를 먼저 쓰고, 안 되면 웹뷰 기본값 ──
// 위치는 사진을 저장할 때만 묻는다(src/services/location.ts) — 진입 시 권한 창 없음.
if (IN_TOSS) try {
  const geo = navigator.geolocation;
  const original = geo && geo.getCurrentPosition && geo.getCurrentPosition.bind(geo);
  if (original) {
    geo.getCurrentPosition = (ok, fail, options) => {
      Device.getLocation({ accuracy: Accuracy.Balanced })
        .then((loc) => ok({ coords: { ...loc.coords, speed: null }, timestamp: loc.timestamp }))
        .catch((e) => {
          // 토스가 권한을 거절했으면 거절로 끝낸다(웹뷰에 다시 묻지 않는다). 그 밖의 실패는 웹뷰 위치로.
          if (isPermissionError(e, GetCurrentLocationPermissionError)) {
            if (fail) fail({ code: 1, message: 'permission denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
          } else original(ok, fail, options);
        });
    };
  }
} catch (_) {}

if (IN_TOSS) {
  window.hlToss = {
    photo: (how) => takePhoto(how === 'album' ? 'album' : 'camera', false),
    openURL: (url) => Device.openURL(url),
  };
  window.hlTossSave = saveImage;
}
