# Hello Luck 🍀

카메라로 클로버 밭을 비추면 **기기 안의 AI**가 네잎클로버 후보를 실시간으로 표시하고,
찾은 네잎을 사진·장소·메모로 기록하는 앱 (Expo / React Native, iOS + Android, 한국어/영어).

- 서버 없음 · 로그인 없음 · 광고 없음 — 영상/사진/위치는 기기 밖으로 나가지 않음
- 탐지: YOLOv8n TFLite (`assets/model/clover.tflite`) → VisionCamera 프레임 프로세서에서 직접 추론
- 저장: 앱 샌드박스의 JSON + 사진 파일 (`src/services/findsStore.ts`)

## 구조

| 경로 | 내용 |
|---|---|
| `app/index.tsx` | 홈 — 내 네잎 기록 그리드, "네잎 찾으러 가기" |
| `app/scan.tsx` | 카메라 스캔 — 실시간 박스, 잠금 시 햅틱, 촬영·저장 |
| `app/find/[id].tsx` | 기록 상세 — 메모, 장소(지도 앱 열기), 공유, 삭제 |
| `app/settings.tsx`, `app/privacy.tsx`, `app/onboarding.tsx` | 설정, 개인정보처리방침, 첫 실행 안내 |
| `src/services/detector/` | 프레임 → 모델 → YOLO 디코딩/NMS → 화면 좌표 매핑 |
| `src/services/detectionTracker.ts` | 박스 추적·평활화, N프레임 연속이면 "잠금" |
| `src/config/detector.ts` | 입력 크기, 임계값, 트래커 설정 |
| `training/` | 데이터 수집·병합·학습·TFLite 변환 |

## 개발

```bash
npm install
npm run typecheck && npm run lint && npm test
npx expo prebuild --clean
npx expo run:android        # 또는 run:ios (macOS)
```

Expo Go 에서는 동작하지 않습니다 (VisionCamera·TFLite 네이티브 모듈).

## 모델 재학습

```bash
# .env 에 ROBOFLOW_API_KEY (무료) 설정 후
python training/download_datasets.py
python training/merge_datasets.py
python training/train_local.py --epochs 120      # Windows CUDA 가능
wsl -d Ubuntu -- bash training/export_tflite.sh  # TFLite 변환은 Linux/macOS 전용 → WSL
```

입력 크기를 바꾸면 `src/config/detector.ts`의 `INPUT_SIZE`도 같이 바꾸세요.
학습 데이터 라이선스: `training/download_datasets.py`의 각 항목 참고 (CC BY 데이터는 앱 정보에 출처 표기).

## 빌드 / 출시

```bash
eas build -p android --profile production   # Play 스토어용 AAB (키스토어는 EAS 관리)
eas build -p ios --profile production       # App Store용 (Apple 계정 로그인 필요)
eas build -p android --profile preview      # 바로 설치 가능한 APK
```

스토어 제출용 자료: `store-listing/` (정책 답변서, 아이콘, 그래픽), 공개 개인정보처리방침: `docs/privacy-policy.html`.
