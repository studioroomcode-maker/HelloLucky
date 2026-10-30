# 로컬 박스 라벨링 워크플로우

네잎클로버 **물체감지(object-detection)** 모델을 만들기 위한 라벨링 과정입니다.
iNaturalist 이미지에는 박스 좌표가 없으므로, 네잎클로버의 위치는 사람이 박스로 표시해야 합니다.
이 문서는 그 작업을 **로컬 도구(LabelImg)** 로 하는 흐름을 정리합니다.
(웹에서 하고 싶으면 Roboflow Annotate 를 써도 됩니다 — 이 경우 이 문서는 건너뛰세요.)

## 전체 흐름

```
1. python collect_and_train.py            # 이미지 수집 → clover_dataset/four_leaf
2. python label_local.py launch           # LabelImg 로 네잎에 박스 그리기 → labels/
3. python label_local.py check            # 라벨 검증 (형식 / 클래스 이름)
4. python collect_and_train.py --no-collect  # 이미지 + 박스 Roboflow 업로드
5. Roboflow: Generate 버전 → Train → 모델 ID 를 .env 에 입력
```

## 폴더 구조

```
clover_dataset/
├── four_leaf/            # 네잎 이미지 (박스를 그릴 대상)
├── three_leaf/           # 세잎 이미지 (박스 없는 배경/네거티브)
├── labels/               # 여기에 라벨 저장 (LabelImg 가 생성)
│   ├── four_leaf_0001.xml   # Pascal VOC (권장)
│   └── ...
└── predefined_classes.txt   # 클래스 이름 고정: four_leaf
```

## 1단계 · 도구 설치

```bash
pip install labelImg
```

> 설치가 잘 안 되면(PyQt 의존성 문제) 로컬 라벨링 대신 **Roboflow 웹 Annotate** 를 쓰는 게 빠릅니다.

## 2단계 · 박스 그리기

```bash
python label_local.py launch
```

LabelImg 가 `four_leaf/` 폴더를 열고, 저장 위치는 `labels/`, 클래스는 `four_leaf` 로 미리 설정됩니다.

- 저장 포맷: 좌하단에서 **PascalVOC** 선택 (권장)
- 단축키: `W` 박스 그리기 · `D` 다음 이미지 · `A` 이전 · `Ctrl+S` 저장
- 한 이미지에 네잎이 여러 개면 박스도 여러 개
- **클래스 이름은 반드시 `four_leaf`** — predefined_classes.txt 에서 자동 로드되므로 목록에서 고르면 됩니다

### 세잎(배경) 이미지는?

세잎 이미지에는 **박스를 그리지 않습니다.** 네잎이 아니므로 "여기엔 찾을 게 없다"를 학습시키는
hard negative 입니다. 업로드 후 Roboflow 에서 `background` 배치를 골라 **Mark as Null** 처리하면 됩니다.

## 3단계 · 검증

```bash
python label_local.py check
```

확인 항목:
- 라벨 파일 형식(VOC XML / YOLO txt) 파싱 가능 여부
- **클래스 이름이 `four_leaf` 인지** (오타 시 앱 `.env` 필터를 통과 못 함)
- 박스 0개인 라벨, 라벨 없는 이미지, 배경에 실수로 붙은 라벨

출력 예:
```
✅ 정상 라벨:      2장 (박스 2개)
⬜ 라벨 없음:      197장
❌ 클래스 이름 오류: 1장
```

## 4단계 · 업로드

```bash
python collect_and_train.py --no-collect
```

`labels/{이미지이름}.xml`(또는 `.txt`)이 있으면 이미지와 박스를 함께 Roboflow 에 올립니다.
라벨이 없는 이미지는 박스 없이 올라가고, Roboflow 웹에서 이어서 그릴 수 있습니다.

## 5단계 · 학습 & 앱 연결

1. Roboflow → **Generate** 로 새 버전 생성 (Train/Valid/Test 자동 분할)
2. **Train Model** → 완료되면 모델 ID 확인 (예: `hellolucky/3`)
3. 앱 `.env` 에 입력:
   ```env
   EXPO_PUBLIC_ROBOFLOW_DETECTION_MODEL_ID=hellolucky/3
   ```
   Roboflow API 키는 앱 `.env` 에 넣지 않는다 — `EXPO_PUBLIC_` 값은 앱 번들에 그대로 들어가 누구나 꺼내 볼 수 있다.

## 팁

- 처음엔 30~50장만 정성껏 라벨링 → 학습 → 실제 잔디밭 테스트 → 틀린 것 수집 → 재라벨링/재학습.
  한 번에 200장 다 하지 말고 이 루프를 돌리는 게 훨씬 빠릅니다.
- 박스는 잎 4장 전체를 여유 있게 감싸되, 배경 잔디는 최소화.
- 클래스 이름(`four_leaf`)은 `.env` 의 `EXPO_PUBLIC_ROBOFLOW_TARGET_LABELS` 와 항상 일치시켜야 합니다.
