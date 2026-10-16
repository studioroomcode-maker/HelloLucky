# Hello Luck — 스토어 정책 항목 답변서

갱신 2026-10-16 · 온디바이스 탐지 + 기기 내 저장 + 행운 지도(사용자가 고른 기록의 위치만 공개) + 랜덤 행운 편지(정해진 문구·카드·도시만) + 푸시 알림.

## 요약

- 대상 연령: 전체 (어린이 대상 앱 아님)
- 로그인 · 광고 · 결제 · 분석 SDK: 없음 (앱을 열 때 Supabase 익명 계정 자동 생성 — 행운 편지 우체통용)
- 네트워크: 행운 지도·행운 편지(Supabase, 서울 리전) + Google 지도 SDK + Expo 푸시(FCM/APNs)
- 카메라: 실시간 프리뷰를 **기기 안에서** 분석, 영상·사진 전송 없음 · 마이크: 사용 안 함 (권한 차단)
- 위치: 선택 사항. 촬영 위치를 기기에 저장, 사용자가 "행운 지도에 공유"를 누른 기록만 정확한 좌표·지역명·날짜를 서버에 공개
- 사용자 생성 콘텐츠: 사진·글은 공유되지 않음 (지도 핀 = 위치·날짜·OS가 만든 지역명뿐, 행운 편지 = 앱에 정해진 문구 번호·카드 번호·도시 이름뿐)
- 알림: 행운 편지가 도착했을 때만. 처음 "모르는 누군가에게" 보낼 때 권한 요청
- 개인정보처리방침: `docs/privacy-policy.html` 을 공개 URL 로 호스팅 후 입력 (예: GitHub Pages)
- 지원 이메일: studioroomcode@gmail.com

## Google Play

### 데이터 보안 (Data safety)

- 데이터 수집: **예**
  - **위치 → 정확한 위치**: 수집 · 선택 사항(사용자가 공유할 때만) · 목적: 앱 기능 · 처리: 일시적 아님
  - **기기 또는 기타 ID**: 익명 사용자 ID + 푸시 토큰(알림 허용 시) · 필수(앱을 열면 우체통 등록) · 목적: 앱 기능
  - **앱 활동 → 기타 사용자 생성 콘텐츠**: 행운 편지(정해진 문구 번호·카드 번호)·고마움 스티커 번호 · 선택 사항 · 목적: 앱 기능
  - **위치 → 대략적인 위치**: 행운 편지에 붙는 도시 이름 + 약 10km 단위로 반올림한 위치(행운의 여정 지도) · 선택 사항 · 목적: 앱 기능
- 데이터 공유(제3자 전송): **아니요** (지도 핀·행운 편지는 사용자가 직접 시작한 전달, 푸시는 서비스 제공자 처리라 '공유' 아님)
- 전송 중 암호화: **예** (HTTPS)
- 삭제 요청: **예** — 앱 안의 "공유 취소", "내가 공유한 위치 모두 내리기", "모든 기록 삭제" / 이메일 요청

### 콘텐츠 등급 (IARC)

폭력 · 성적 · 비속어 · 약물 · 도박 · 공포: 없음 / 사용자 간 상호작용: **예 — 정해진 문구 카드만** (자유 채팅·글·사진 없음) / **사용자 위치 공유: 예** (사용자가 선택한 발견 위치를 지도에 공개) / 디지털 구매: 아니요

### 기타 선언

광고 포함 아니요 · 광고 ID 아니요 · 뉴스/금융/건강/정부 앱 아니요 · 포그라운드 서비스 없음 · 앱 액세스 제한 없음(로그인 없음)

## App Store

### 앱 개인정보 (App Privacy)

- 수집하는 데이터:
  - **위치 → 정확한 위치**: 앱 기능 · **사용자와 연결되지 않음** · 추적 아님
  - **위치 → 대략적인 위치**(행운 편지의 도시 이름·약 10km 단위 위치): 앱 기능 · 사용자와 연결되지 않음 · 추적 아님
  - **식별자 → 사용자 ID**(익명) · **식별자 → 기기 ID**(푸시 토큰): 앱 기능 · 사용자와 연결되지 않음 · 추적 아님
  - **사용자 콘텐츠 → 기타 사용자 콘텐츠**(정해진 문구 번호·카드 번호): 앱 기능 · 사용자와 연결되지 않음 · 추적 아님
- 추적(Tracking): 아니요 → ATT 팝업 불필요
- 계정 삭제(5.1.1(v)): 로그인 없는 익명 계정. "내가 공유한 위치 모두 내리기"로 서버 데이터 삭제 가능

### 연령 등급

모든 항목 "없음" → 예상 **4+**

### 수출 규정 (암호화)

`ITSAppUsesNonExemptEncryption = false` 가 app.json 에 설정됨 → 빌드마다 질문 없음

### 심사 노트 (복붙용)

> Hello Luck finds four-leaf clovers using an on-device ML model running on the live camera preview. No account is required. Photos and notes never leave the device; only when the user taps "Share to Lucky Map" on an AI-confirmed find (after accepting a notice) are its coordinates, area name and date published as a pin on the shared map. No user-written text or images are shared. "Send luck to a stranger" delivers only a preset message number, card design and city name to a random user (max 5 sent / 1 received per day); a push notification announces it if allowed. To test without a clover patch, point the camera at a photo of a four-leaf clover on another screen; the shutter button also works without a detection to record a find manually (manual finds cannot be shared to the map).

## 학습 데이터 출처 표기 (CC BY 4.0 — 앱 설정 화면 하단에 표기됨)

스토어 설명 끝에도 아래 문장을 넣으세요:
"AI model trained in part on '4 Leaf Clover Detect' by test-ara07 and 'Hunting for Four Leaf Clovers' by adam-fonagy (Roboflow Universe, CC BY 4.0), modified."
(SoLucky 데이터셋은 Public Domain 이라 표기 의무 없음)
