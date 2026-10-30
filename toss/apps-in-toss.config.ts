// 앱인토스 설정 — `npx ait init` 이 만드는 파일(SDK 3.x)과 같은 모양이다. appName·색은 constants.mjs 한 곳에서 고친다.
import { defineConfig } from '@apps-in-toss/web-framework/config';
import { APP_NAME, PRIMARY_COLOR } from './constants.mjs';

export default defineConfig({
  appName: APP_NAME,
  brand: {
    primaryColor: PRIMARY_COLOR,
  },
  // 비게임 미니앱 — 토스 흰 내비게이션 바(로고·이름·닫기). 뒤로가기 화살표는 앱 화면마다 이미 있어서
  // 토스 쪽은 끈다(두 개가 동시에 보이면 안 된다). 안드로이드 뒤로가기는 toss-bridge.js 가 받는다. TOSS.md 5장.
  navigationBar: {
    withBackButton: false,
    withTitle: true,
  },
  webView: {
    overScrollMode: 'never',
    bounces: false,
    pullToRefreshEnabled: false,
    allowsInlineMediaPlayback: true,          // 실시간 카메라 미리보기(<video playsinline>)
    mediaPlaybackRequiresUserAction: false,
    allowsBackForwardNavigationGestures: false,
  },
  // 검수 때 쓰인다 — 쓰는 권한만 적는다. 카메라(실시간 찾기·촬영), 앨범 읽기(사진으로 찾기), 위치(찾은 곳 기록·지도)
  permissions: [
    { name: 'camera', access: 'access' },
    { name: 'photos', access: 'read' },
    { name: 'geolocation', access: 'access' },
  ],
  webBundleDir: 'dist',
});
