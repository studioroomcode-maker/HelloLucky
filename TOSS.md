# 앱인토스(토스 미니앱) 출시 준비 — Hello Luck

Hello Luck(Expo 앱)을 토스 앱 안의 미니앱(앱인토스, **WebView**)으로 올리는 절차다.
토스는 우리 사이트를 불러올 수 없다. 화면, AI 모델, 런타임을 **전부 `.ait` 번들에 담아** 콘솔에 올린다.
앱을 고치면 토스에 바로 반영되지 않는다. **번들을 다시 만들어 다시 올려야 한다.**

| 항목 | 값 |
|---|---|
| 방식 | **WebView**: `expo export --platform web` 결과를 번들로 만든다. Granite(RN)는 쓰지 않는다(1장) |
| SDK | `@apps-in-toss/web-framework` **3.9.0** (CLI `ait`). `toss/` 폴더에만 설치돼 있다 |
| 앱 종류 | **비게임**: 카메라 인식 도구, 기록장, 지도 서비스다. 게임이면 등급분류가 필요하다 |
| appName | **`helloluck`**: ⚠ 임시값이다. 콘솔에 등록하면 **바꿀 수 없다.** 바꾸는 곳은 `toss/constants.mjs` 한 곳이다 |
| 번들 | `toss/helloluck.ait` 약 **22 MB**(압축 전 `dist/` 43 MB, 한도 100 MB) |
| 결제 | 없음. 디지털 상품이 없어서 토스 IAP를 연동할 필요가 없다 |
| 브랜치 | `feat/toss`. `origin/feature/clover-map-photo`(1.0.5, 스토어에 있는 코드)에서 땄다 |

> 문서 작성: 2026-10-30. 콘솔 메뉴와 정책 수치는 자주 바뀐다. **콘솔이 그 자리에서 안내하는 값을 최종으로 삼는다.**

---

## 1. 왜 WebView인가 (Granite RN과 비교)

| | WebView(채택) | Granite RN(`@apps-in-toss/framework`) |
|---|---|---|
| 실시간 인식 | `getUserMedia` + 캔버스 루프로 같은 감지기를 돌린다 | vision-camera 프레임 프로세서, fast-tflite, nitro, worklets-core가 모두 네이티브 모듈이다. 토스가 허용하는 범위 밖일 가능성이 매우 크다 |
| 지도 | Leaflet + 타일 | react-native-maps(네이티브)라 쓸 수 없을 가능성이 크다 |
| 작업량 | 웹 대체 모듈 몇 개로 끝난다. 앱 코드는 하나 그대로다 | 카메라, 모델, 지도, 이미지 처리를 다시 짜야 한다 |

`react-native-web`이 이미 설치돼 있었고, 감지 파이프라인(`tiles.ts` · `yoloDecode.ts` · `frameMapping.ts`)은 순수 TS다.
그래서 웹에서 바뀌는 것은 **입력(카메라·이미지)과 실행기(LiteRT.js)뿐이다.**

## 2. 한 일 (이 브랜치)

**원칙: iOS와 Android의 동작은 그대로다.** 토스 전용 동작은 다음 셋 중 하나에 있다.

- `*.web.ts` 파일. Metro가 웹에서만 고른다.
- `metro.config.js` 의 `WEB_SHIMS`. 웹에서만 네이티브 모듈을 대체 모듈로 바꾼다.
- `IS_TOSS` 분기(`src/config/toss.ts`). 값은 `EXPO_PUBLIC_TOSS=1` 이고, 네이티브 빌드에서는 늘 false다.

| 파일 | 역할 |
|---|---|
| `src/services/detector/model.web.ts` | **같은 `clover.tflite`** 를 LiteRT.js로 돌린다. WebGPU가 있으면 쓰고, 없으면 WASM(XNNPack)으로 돈다. 입력·출력 모양이 네이티브와 같아서 `toModelInput` · `decodeYolo` 를 그대로 쓴다 |
| `src/services/detector/useCloverFrameProcessor.web.ts` | 실시간 인식. `<video>` 프레임 → 가운데 정사각형 → 960 → 감지 → 추적기. 네이티브와 같은 crop·decode를 쓴다 |
| `src/web/visionCamera.tsx` | `react-native-vision-camera` 대체. `getUserMedia`(후면, 4:3), 프레임 루프(초당 최대 6회), 셔터는 스트림에서 프레임을 떠서 찍는다 |
| `src/web/nitroImage.ts` | `react-native-nitro-image` 대체(캔버스). 그래서 `wideScan.ts`(넓게 훑기·셔터 사진 확인) · `cloverCrop.ts` 가 **고치지 않고** 웹에서 돈다 |
| `src/web/fileSystem.ts` | `expo-file-system/legacy` 대체(IndexedDB). 기록장 JSON을 담는다. 사진은 기록장 안에 data: URI로 들어간다(`findsStore.keepPhoto`) |
| `src/web/maps.tsx` | `react-native-maps` 대체(Leaflet). `map.tsx` 와 `journey/[chain].tsx` 가 쓰는 props와 카메라 이동을 지원한다 |
| `src/web/share.ts` | `react-native-share` 대체. Web Share API를 먼저 쓴다. 안 되면(토스 웹뷰) 그림은 토스 `File.saveBase64` 로 기기에 저장하고, 글은 **토스 공유 시트**(`Share.sendMessage`)로 보낸다. 글에는 미니앱 링크가 들어간다 |
| `src/web/viewShot.ts` | `react-native-view-shot` 대체(html2canvas). 원래 웹 빌드는 RN-web 0.21에서 `findNodeHandle` 오류로 멈춰서, 친구 공유 그림을 만들지 못했다 |
| `src/web/sensors.ts` | `expo-sensors` 대체. 웹 자이로가 깨져 있어서(아래 9장) 웹에서는 상자가 자이로를 따라가지 않는다 |
| `src/web/setup.web.ts` | `Alert.alert` 를 DOM 대화상자로 바꾼다(RN-web은 아무것도 안 한다. 지도의 **신고·차단 메뉴**가 이것에 달려 있다). `Linking.openURL` 은 토스 `openURL` 로 보낸다(웹뷰가 다른 사이트로 넘어가지 않게). 뒤로가기 처리 `window.hlBack` 도 여기 있다 |
| `src/services/stillPhoto(.web).ts` + `app/scan.tsx` | 카메라 권한을 거절했거나 `getUserMedia` 가 없을 때 쓴다. **토스 카메라**·**토스 앨범**으로 사진 한 장을 받아 '넓게 훑기' 화면(`/wide`)에서 감지한다. 일반 브라우저에서는 파일 선택을 쓴다 |
| `src/services/notifications.web.ts` | 푸시 없음(expo-notifications는 웹에서 시작하자마자 멈췄다) |
| `src/config/links.ts` | 공유 문구의 **스토어 링크(/go)를 토스 번들에서 뺀다.** 빌드 스크립트가 번들에 링크가 남았는지 검사한다. 대신 `shareLine()` 이 토스 공유 링크(`intoss://helloluck` → https)를 넣는다 |
| `app/find/[id].tsx` | 친구 공유 그림 아래의 **App Store·Google Play 배지를 토스에서 숨긴다**(자사 앱 설치 유도 금지). 문자열은 죽은 코드로 번들에 남아 있어 빌드 검사에는 넣지 않았다 |
| `constants/theme.ts`, `app/settings.tsx` | 토스는 **라이트 고정**이다. 테마 선택과 백업·복원(파일·공유 시트) 카드를 숨긴다 |
| `app.config.js` | 토스 빌드에서만 `web.output: 'single'` 로 바꾼다(SSR·사전 렌더링 없음). 그 밖에는 app.json을 그대로 돌려준다 |
| `toss/` | `build-src.mjs`(export → LiteRT wasm 복사 → index.html 손질 → 금지 링크·용량 검사), `src/toss-bridge.js`, `apps-in-toss.config.ts`, `constants.mjs` |

### toss-bridge.js가 하는 일

브리지는 토스 웹뷰 안(`window.ReactNativeWebView` 가 있을 때)이나 devtools 개발 서버에서만 붙는다.

- `hlToss.photo('camera'|'album')`
  - 토스 `Device.openCamera` · `getAlbumItems` 로 사진을 받는다. maxWidth는 1920이다.
  - 권한이 없으면 토스 권한 창으로 한 번 다시 묻는다.
- `hlToss.openURL`: 토스 `Device.openURL` 로 연다(길찾기, '지도에서 보기').
- `hlToss.shareLink(path)`: `intoss://<appName><path>` 를 토스에서 여는 https 링크로 바꾼다.
  - `Share.createLink` 를 먼저 쓴다.
  - 실패하면(옛 토스 앱) `getTossShareLink` 를 쓴다.
  - 둘 다 실패하면 링크 줄을 뺀다.
- `hlToss.sendMessage`: 토스 공유 시트(`Share.sendMessage`)로 글을 보낸다.
- `hlTossSave`: 토스 `File.saveBase64` 로 이미지를 저장한다.
- **backEvent**: 앱 안에서 한 단계 뒤로 간다. 첫 화면이면 `Screen.close()` 로 닫는다.
- **위치**
  - `navigator.geolocation.getCurrentPosition` 을 토스 `Device.getLocation` 으로 먼저 받는다.
  - 토스가 권한을 거절하면 거절로 끝낸다.
  - 그 밖의 실패는 웹뷰의 기본 위치로 넘긴다.

## 3. 빌드 · 테스트

```bash
npm install                 # 저장소 루트(앱). @litertjs/core·leaflet 이 추가됐다
cd toss && npm install

npm run build               # expo export(EXPO_PUBLIC_TOSS=1) → dist/ → 브리지 → ait build → toss/helloluck.ait
npm run build:web           # .ait 없이 dist/ 만
npm run dev                 # web/ + vite devtools(가짜 토스 SDK: 권한·뒤로가기 조작) http://localhost:5173
npx vite preview --outDir ../dist --port 4179   # 만든 dist/ 를 그대로 띄워 보기(브라우저 = 토스 밖 동작)

npx ait token add && npm run deploy   # 콘솔 API 키가 있을 때. 지금은 하지 않았다
```

- `npm run build` 는 로그인 없이 끝난다. 콘솔이 appName을 확인하는 때는 업로드할 때다.
- 빌드 스크립트는 두 경우에 **멈춘다.** ① 번들에 `apps.apple.com` · `play.google.com/store` · `helloluck.studioroomkr.com/go` 가 남은 경우. ② 100 MB를 넘은 경우.
- 콘솔의 검수 요청 버튼은 **토스 앱 QR 테스트를 한 번 이상 마쳐야** 켜진다.

## 4. 확인한 것 (2026-10-30, 데스크톱 Chrome, `npx vite preview` 로 띄운 `dist/`)

- 앱이 뜨고 라이트 테마로 보인다. 타이틀 화면과 온보딩이 나온다. 모델(LiteRT, WebGPU)이 로드된다.
- **정확도: 브라우저와 기준 출력이 같다.** 검증용 사진 `yolox_data/val2017/…12807…`(네잎 2개)로 넓게 훑기를 돌렸다.
  - 브라우저 후보: 중심 (0.307, 0.270)·(0.441, 0.506), 크기 0.18 × 0.24.
  - `yolox_luck.onnx`(tflite의 원본) 파이썬 기준과 소수 둘째 자리까지 같다. 정답 라벨 위치와도 맞는다.
  - 기준 쪽에 있는 0.377 후보 하나는 문턱(0.35) 근처라 리사이즈 방식 차이로 빠졌다.
  - 기준 스크립트: `python -I ref.py <사진>`. 내용은 7장 끝에 적었다.
- **실시간 인식**: 가짜 카메라(캔버스 스트림)로 확인했다.
  - 프레임 루프는 약 5.8회/초로 돈다(데스크톱 WebGPU).
  - 추적기가 잠기고 "찾았다! 지금 찰칵"이 뜬다.
  - 셔터를 누르면 사진 재확인(`findInPhoto`)을 거쳐 기록이 저장되고 상세 화면으로 간다.
- **권한 거절**: '사진 찍어서 찾기'와 '앨범에서 사진 고르기' 버튼이 나온다. 사진을 고르면 넓게 훑기가 돌고, 저장하면 기록이 생긴다.
  - IndexedDB에서 확인했다: 사진 127 KB, 네잎 크롭 9 KB가 data: URI로 들어 있다. 상자와 좌표도 저장됐다.
- **행운 지도(Leaflet)**: 운영 Supabase에서 핀을 읽어 와 띄운다(읽기만 했다). 핀을 누르면 사진 카드가 열린다.
  - ⋯ 메뉴(사진 신고 · 이 사람의 핀 숨기기 · 취소)가 DOM 대화상자로 뜬다. 신고는 누르지 않았다(운영 DB에 쓰기 때문).
- `tsc --noEmit` 통과, `npm test` 44개 통과.
  - eslint 경고 3개가 남았다(대체 모듈의 타입·값 같은 이름 2개, 훅 의존성 1개). 오류는 없다.
- **네이티브 번들**: `npx expo export -p android` 가 성공한다. 번들에 웹 대체 모듈(leaflet·LiteRT·IndexedDB)이 들어가지 않았다.
  - 스토어 링크(`/go`)는 네이티브 번들에 그대로 남아 있다.
- **`npm run dev`(devtools 가짜 SDK)**
  - `hlToss` 와 `hlBack` 이 붙는다.
  - 위치 요청이 토스 `Device.getLocation`(가짜)으로 간다.
  - 카메라를 거절한 뒤 '사진 찍어서 찾기'를 누르면 토스 `openCamera`(가짜 이미지) → 넓게 훑기 화면으로 간다.
  - **친구에게 행운 보내기**(Web Share 없음으로 가정):
    - 공유 그림(759 KB JPEG, 스토어 배지 없음)이 `saveBase64` 로 저장된다.
    - 이어서 `sendMessage` 로 "…나도 행운 찾으러 가기 👉 https://toss.im/share/mockintoss://helloluck" 가 나간다. 링크는 devtools 가짜 값이다.
  - `getTossShareLink` 대체 경로는 가짜 SDK에서 `createLink` 가 성공해서 타지 않았다.
- **확인하지 못한 것**: 실제 토스 앱(QR), 휴대폰 성능, 실제 토스 권한 창, backEvent.

## 5. 사용자가 할 일 (콘솔)

1. **콘솔 가입, 워크스페이스, 사업자 등록**: HelloBilliard `TOSS.md` 0장과 같다(만 19세 이상, 토스 비즈니스 계정).
   - 결제가 없으니 **정산 정보는 필요 없다.**
   - 사업자등록증의 **업종이 앱 서비스와 맞는지** 확인한다.
2. **앱 등록**
   - **비게임**으로 등록한다. 흰 내비게이션 바가 붙는다.
   - **appName** 을 정한다. 추천은 `helloluck` 이다(홈페이지 도메인과 같다).
   - 다른 값으로 정하면 `toss/constants.mjs` 의 `APP_NAME` 을 바꾸고 다시 빌드한다.
3. **앱 정보**
   - 한글 이름 '헬로럭', 영문 'Hello Luck'.
   - 부제, 상세 설명(접속 → 행동 → 결과 순서), 카테고리(라이프스타일), 검색 키워드(헬로럭 · 네잎클로버).
   - 고객문의 이메일 `contact@studioroomkr.com`.
   - 로고: 600×600 PNG, 불투명 배경, 둥근 모서리 없이. `assets/images/icon.png` 을 줄여 쓴다.
   - 스크린샷: 세로 636×1048, 3장 이상.
4. **권한**: `apps-in-toss.config.ts` 에 카메라, 앨범 읽기, 위치를 적었다. 콘솔에 같은 목록으로 사용 목적을 쓴다.
   - 카메라: 네잎클로버를 실시간으로 찾는다. 영상은 기기 안에서만 분석한다.
   - 앨범: 사진으로 찾기.
   - 위치: 찾은 곳을 기록하고, 행운 지도에 표시한다.
5. **개인정보처리방침 URL**: 지금 방침(`docs/privacy-policy.html` · 앱 안 `privacy`)에는 **토스 미니앱 항목이 없다.** 아래 내용을 추가한다.
   - 사진과 기록은 기기(토스 웹뷰 저장소)에만 남는다.
   - 지도에 올린 위치와 네잎 크롭은 Supabase에 저장된다.
   - 법률 문서라서 코드로 고치지 않았다.
6. `cd toss && npm run build` 로 만든 `helloluck.ait` 를 콘솔에 올린다. **QR로 실기기 테스트**(6장)를 한 뒤 검수를 요청한다.

## 6. 실기기에서 확인할 것 (토스 앱 QR)

- [ ] **실시간 카메라**
  - [ ] 토스 웹뷰에서 `getUserMedia` 미리보기가 뜨는지 본다. 후면 카메라인지, 4:3인지 확인한다.
  - [ ] 안 뜨면 권한 화면에 '사진 찍어서 찾기'가 나오는지 본다.
- [ ] **감지 속도**: 상단 상태줄이 따라오는지 본다.
  - WebGPU가 있으면 빠르다.
  - 없으면 WASM 단일 스레드로 돌아서 **프레임당 0.5–1.5초로 예상한다**(측정하지 않았다).
  - 너무 느리면 9장의 대안을 쓴다.
- [ ] **발열과 배터리**: 5분 동안 훑으면서 확인한다.
- [ ] **토스 카메라와 앨범**: 거절한 뒤 다시 묻는지 본다. 거절해도 앱이 멈추지 않는지 본다.
- [ ] **위치**: 사진을 저장할 때만 토스 위치 권한을 묻는지 본다. 거절해도 기록은 저장되는지 본다.
- [ ] **기록 유지**: 미니앱을 닫았다 다시 열어도 기록과 사진이 남아 있는지 본다.
  - 토스 '용량 삭제' 뒤에 어떻게 되는지도 본다(8장 2번).
- [ ] **뒤로가기(안드로이드)**: 화면마다 한 단계씩 돌아가는지 본다. 첫 화면에서는 미니앱이 닫혀야 한다.
- [ ] **안전 영역**: 셔터와 하단 버튼이 홈 인디케이터에 가리지 않는지 본다.
- [ ] **지도**: 두 손가락 확대와 이동이 되는지 본다(지도라서 허용된다). 핀 카드와 신고 메뉴가 열리는지 본다.
  - 저작권 표기를 눌러도 다른 사이트로 넘어가면 안 된다.
- [ ] **친구에게 행운 보내기와 여정 카드 공유**
  - [ ] 웹 공유 시트가 뜨는지 본다. 안 뜨면 이미지가 저장되고 토스 공유 시트가 뜨는지 본다.
  - [ ] 받은 링크를 눌렀을 때 토스에서 Hello Luck이 열리는지 본다.
  - [ ] 링크가 `intoss-private://` 가 아니라 `intoss://` 기반인지 본다.

## 7. 검수 반려 위험 (우리 앱에 해당하는 것)

1. **내비게이션 바 뒤로가기를 껐다**(`withBackButton: false`).
   - 앱 화면마다 이미 자체 뒤로가기(‹) 또는 닫기(×)가 있다. 두 개가 동시에 보이면 안 된다는 규칙 때문에 끈 것이다. 안드로이드 뒤로가기 키는 브리지가 받는다.
   - 체크리스트에 "닫기 버튼과 뒤로가기 버튼이 노출되고"라는 문장이 있다. 반려되면 이렇게 고친다.
     - 설정을 `true` 로 바꾼다.
     - `ScreenHeader`, `map.tsx`, `find/[id].tsx` 의 자체 ‹ 버튼을 `IS_TOSS` 일 때 숨긴다.
     - `find/[id]` 의 ‹ 버튼은 메모를 저장한 뒤 돌아간다. 이 저장을 언마운트 때로 옮겨야 한다.
2. **외부 링크**
   - 길찾기와 '지도에서 보기'는 Google 지도를 토스 밖 브라우저로 연다. "서비스 이용에 꼭 필요한 외부 링크"로 볼 수 있지만 반려될 수 있다. 그러면 버튼을 `IS_TOSS` 로 숨긴다.
   - 스토어 링크는 번들에서 뺐고, 빌드가 검사한다.
3. **지도 타일**: 지금은 `tile.openstreetmap.org` 를 쓴다(`src/web/maps.tsx` 의 `TILES`).
   - **OSM 타일 정책은 앱 규모의 트래픽을 금지한다.** 출시 전에 상용 타일로 바꿔야 한다(8장 1번).
   - 저작권 표기에는 링크를 넣지 않았다.
4. **진입 시 팝업**: 첫 실행에는 타이틀 → 온보딩(전체 화면)이 나온다. 그 뒤 홈에서 '오늘의 기억'과 행운 편지 팝업이 뜰 수 있다.
   - 바텀시트는 아니지만 "진입 시 팝업"으로 볼 수 있다.
5. **사용자 생성 콘텐츠(UGC)**: 행운 지도에 남의 네잎 사진이 보이고, 모르는 사람이 보낸 편지가 온다.
   - 신고 3회면 숨김, 사용자 차단, 핀 숨기기는 이미 있다. 웹에서도 동작한다(DOM 대화상자).
6. **로그인**
   - Supabase **익명 로그인**은 화면에 보이는 로그인이 아니다. 토스 로그인 외의 로그인을 금지하는 규칙에는 걸리지 않는다고 봤다.
   - 다만 익명 계정은 **토스 웹뷰 저장소에 묶여 있다.** 저장소를 지우면 지도 핀과 편지의 '내 것' 표시가 끊긴다.
   - "사용자 식별키" 체크리스트(종료 후 재접속해도 데이터 유지)는 IndexedDB로 지킨다. 기기를 바꾸면 유지되지 않는다(8장 3번).
7. **해요체**: 한국어 문구는 거의 해요체다. 합니다체는 '영상 렌더링 중입니다' 한 곳뿐이고, 영상 기능이 웹에 없어서 보이지 않는다.
8. **권한**: 카메라와 위치 모두 쓰기 직전에 묻는다. 거절해도 사진으로 찾기와 위치 없는 저장으로 계속 쓸 수 있다.
9. **19세 이상만**: 토스 사용자 정책상 그렇다. 앱 연령 등급(UGC)과 충돌하지 않는다.

<details><summary>정확도 기준 스크립트(ref.py)</summary>

```python
# app/wide.tsx 와 같은 처리(2/3 축소, 960 한 칸, 회색 114 패딩)를 yolox_luck.onnx 로 돌린다.
import sys, numpy as np, onnxruntime as ort
from PIL import Image
sess = ort.InferenceSession(r"training/yolox_luck.onnx")
for name in sys.argv[1:]:
    im = Image.open(name).convert("RGB")
    w, h = round(im.width * 2 / 3), round(im.height * 2 / 3)
    im = im.resize((w, h), Image.BILINEAR)
    x = np.full((960, 960, 3), 114 / 255, np.float32); x[:h, :w] = np.asarray(im, np.float32) / 255
    out = sess.run(None, {"images": x.transpose(2, 0, 1)[None]})[0][0]   # [6, N]: cx cy w h (0–1), 네잎, 세잎
    # 점수 0.35 이상, IoU 0.45 NMS → 상자를 (w, h) 비율로 출력
```
</details>

## 8. 확인하지 못한 것 (문서로 확정하지 못함)

1. **지도 타일 공급자**: 상용으로 쓸 수 있는 곳을 골라야 한다. 바꾸는 곳은 `src/web/maps.tsx` 의 `TILES` 한 줄이다.
   - Google Maps 키는 앱 전용으로 제한돼 있어서 웹에서 쓸 수 없다.
   - 후보: MapTiler, Stadia, Kakao/Naver 지도 JS(도메인 등록이 필요하다).
   - 토스 웹뷰가 외부 타일 도메인을 막는지는 문서에 없다. "일반 웹 API는 제한하지 않아요"라는 문장만 있다.
2. **저장소 수명**: 토스 메뉴의 '용량 삭제'나 웹뷰 캐시 정리 때 IndexedDB가 지워지는지 모른다.
   - 지워진다면 기록(사진 포함)이 사라진다.
   - 대안은 토스 `Storage`(네이티브 저장소, 문자열)다. 다만 사진을 담기에는 크기 한도를 모른다.
3. **사용자 식별키(`User.getAnonymousKey`) 연동**: 기기를 바꿔도 지도 핀과 편지가 이어지려면 필요하다.
   - Supabase 쪽에서 식별키와 익명 계정을 이어 주는 서버 작업이 필요하다. 이번 범위(스키마 변경 금지) 밖이다.
4. **번들이 서비스되는 경로**: Expo export는 `/_expo/…` · `/litert/…` 처럼 **루트 기준 절대 경로**를 쓴다.
   - `https://helloluck.apps.tossmini.com/` 처럼 루트에서 열리면 문제없다.
   - 하위 경로에서 열리면 화면이 비어 보인다. 그때는 `app.json` 에 `experiments.baseUrl` 을 쓴다.
5. 토스 웹뷰의 **WebGPU · `getUserMedia` · Web Share API · `<input capture>` 지원 여부**. 코드는 모두 실패해도 다음 길로 넘어가게 짰다.
6. **장소 이름**: `expo-location` 의 웹 역지오코딩에는 Google API 키가 필요해서 지금은 동작하지 않는다.
   - 그래서 기록에 동네 이름이 비고, 행운 편지의 '보낸 도시'도 빈다.
   - 고치려면 역지오코딩 API를 하나 붙여야 한다(키·약관 결정 필요).
7. **토스 친구 공유**: 구현했다(2장). 확인하지 못한 것이 셋 있다.
   - 토스 웹뷰가 Web Share API(파일 포함)를 지원하는지.
   - `Share.sendMessage` 가 끝났을 때 실제로 보냈는지 알 수 있는지. 지금은 끝나면 보낸 것으로 쳐서 배지 횟수를 올린다.
   - 공유 링크에 OG 이미지(`ogImageUrl`, 토스 5.240+)를 붙일지. 지금은 붙이지 않는다.
8. **푸시(행운 편지 알림)**: 토스는 콘솔의 스마트 발송만 쓸 수 있다. 미니앱에서는 알림 권한을 묻지 않게 했다. 편지는 앱 안 우편함으로만 받는다.

## 9. 알려진 한계 (이번에 일부러 안 한 것)

- **자이로 따라가기**: expo-sensors 웹 자이로는 `addListener` 가 없어서 화면이 멈췄다. 회전 속도가 아니라 가속도를 주기도 한다. 웹에서는 상자가 감지 프레임 사이에 움직이지 않는다.
- **줌, 플래시, 탭 초점**: 웹 카메라에서는 아직 안 된다.
- **여정 영상 만들기, 사진첩 저장(expo-media-library), 백업·복원**: 웹에 없다. 여정 영상과 백업은 처음부터 숨겨져 있거나 실패 시 안내가 뜬다.
- **실시간 감지가 너무 느릴 때(WASM)**
  - 실시간 감지를 끄고 '사진으로 찾기'(넓게 훑기)만 남기는 방법이 있다.
  - 모델을 640 입력으로 다시 내보내는 방법도 있다(`training/export_yolox.py`).

## 10. 출처

- https://developers-apps-in-toss.toss.im/llms.txt (문서 색인. 각 페이지 URL 끝에 `.md` 를 붙이면 원문)
- https://developers-apps-in-toss.toss.im/checklist/app-nongame.md
- https://developers-apps-in-toss.toss.im/documentation/integration/props.md
- https://developers-apps-in-toss.toss.im/documentation/common/screen/open-url.md
- https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/device/device.getlocation.md
- https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/device/device.opencamera.md
- https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/device/device.getalbumitems.md
- https://developers-apps-in-toss.toss.im/documentation/common/file-storage/storage.md
- https://developers-apps-in-toss.toss.im/guide/authentication/anon-key.md
- https://developers-apps-in-toss.toss.im/documentation/common/growth/share/miniapp-share-link.md
- HelloBilliard `TOSS.md`(계정·사업자 절차, 브리지 구조의 원본)
- 설치된 타입 정의 `toss/node_modules/@apps-in-toss/web-framework/dist/index.d.ts` · `config.d.ts` (3.9.0)
