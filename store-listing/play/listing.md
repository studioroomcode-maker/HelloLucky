# Hello Luck — Google Play 스토어 등록정보

작성 2026-10-17 · Play 앱 ID 4972558626390584355 (`com.studioroomkr.HelloLucky`, 무료, 기본 언어 한국어).
올리기: `python ../HelloDashboard/tools/play-publish.py --package com.studioroomkr.HelloLucky --listing store-listing/play/listing.md --assets store-listing/assets/play --aab <AAB>` (HelloLucky 폴더에서)
assets: `icon-512.png`, `feature-graphic-<ko|en>-1024x500.png`, `screenshots/<ko|en>/*.png`

> **올리기 전에 다시 볼 것**
> - 기능 목록은 2026-10-17 작업 중 기준(넓게 훑기·행운 이어 보내기·여정 카드). 최종 빌드에서 빠진 기능은 지울 것. 배지 개수는 바뀌는 중이라 숫자를 쓰지 않았다.
> - 마지막 줄 학습 데이터 출처: 새 모델(YOLOX) 학습 데이터가 바뀌면 함께 고칠 것.

---

## 1. 앱 세부정보

### 앱 이름 (30자)
**ko**
```
Hello Luck: 행운 찾기
```
**en**
```
Hello Luck: Find Your Luck
```

### 간단한 설명 (80자)
**ko**
```
풀밭에 카메라를 비추면 AI가 행운을 찾아줘요. 찾은 행운은 기록하고, 모르는 누군가에게 보내요 🍀
```
**en**
```
Point your camera at clover and on-device AI spots your luck. Pass it on 🍀
```

### 자세한 설명 (4000자)
**ko**
```
산책길 풀밭에서 네잎클로버, 찾아본 적 있나요?
Hello Luck은 카메라를 클로버 밭에 비추기만 하면 휴대폰 안의 AI가 행운 후보를 실시간으로 표시해 주는 앱이에요.

■ 실시간으로 찾기
• 카메라 화면 위에 행운 후보를 바로 표시해요
• 손이 흔들려도 위치를 따라가다가, 확실해지면 "찰칵" 알려 줘요
• 넓게 훑기 — 넓은 풀밭을 한 장 찍으면 구석구석 나눠서 꼼꼼히 살펴봐요

■ 행운 기록장
• 찾은 행운을 사진·장소·메모와 함께 저장해요
• 행운마다 오늘의 한 줄 운세가 함께 와요
• 모을수록 행운 화분이 씨앗에서 꽃밭까지 자라고, 숨은 배지도 열려요

■ 행운은 나누는 것
• 친구에게 행운 카드를 사진으로 보내요
• "모르는 누군가에게" 행운을 보내면 세계 어딘가의 누군가에게 도착해요
• 받은 행운을 이어 보내면, 내 행운이 어디까지 여행했는지 여정 지도로 볼 수 있어요
• 행운 지도 — 전 세계 사람들이 찾은 행운 장소를 지도에서 만나요

■ 내 정보는 내 폰에
• 카메라 영상은 기기 안에서만 분석하고, 어디에도 보내지 않아요
• 원본 사진과 메모는 기기 밖으로 나가지 않아요 (행운 지도에는 클로버 부분만 잘라낸 작은 사진이 올라가요)
• 회원가입·광고·결제가 없어요
• 행운 지도에는 내가 직접 고른 기록의 장소와 날짜만 올라가요. 행운 편지에는 정해진 문구와 도시 이름만 담겨요

※ 인식 정확도는 빛, 거리, 풀 상태에 따라 달라질 수 있어요.

AI model trained in part on "4 Leaf Clover Detect" by test-ara07 and "Hunting for Four Leaf Clovers" by adam-fonagy (Roboflow Universe, CC BY 4.0), modified.
```
**en**
```
Ever looked for a four-leaf clover on a walk?
Hello Luck lets the AI inside your phone point out likely lucky clovers, live, as you sweep your camera over a clover patch.

■ Find it live
• Candidates are highlighted right on the camera view
• The box follows along even when your hand shakes, and lets you know once it is sure
• Wide scan: take one photo of a big patch and it is checked tile by tile

■ Your lucky journal
• Save each find with a photo, the place and a note
• Every find comes with a fortune line for the day
• Your luck pot grows from a seed to a flower field, and hidden badges unlock as you go

■ Luck is for giving
• Send a luck card photo to a friend
• Send luck "to a stranger" and it lands with someone somewhere in the world
• Pass on luck you received and watch how far it travels on the journey map
• Lucky Map: see where people around the world found their luck

■ Your data stays on your phone
• The camera feed is analyzed on your device and never uploaded
• Original photos and notes never leave your phone (the Lucky Map shows only a small close-up of the clover)
• No sign-up, no ads, no purchases
• Only the place and date of finds you choose go on the Lucky Map; lucky letters carry only a preset message and a city name

Detection accuracy depends on light, distance and the grass.

AI model trained in part on "4 Leaf Clover Detect" by test-ara07 and "Hunting for Four Leaf Clovers" by adam-fonagy (Roboflow Universe, CC BY 4.0), modified.
```

## 5. 버전 출시 노트 (500자)
**ko**
```
🍀 1.0.1 업데이트
· 행운의 여정을 영상(배경음악 포함)과 이미지로 저장할 수 있어요
· 보내는 이름(귀여운 동물 닉네임)과 내가 찾은 클로버 사진이 행운과 함께 여행해요
· 받은 응원에 클로버 사진이 보이고, 클로버 여권 도장을 누르면 그 도시의 클로버를 볼 수 있어요
· 카메라 화면이 더 선명해졌어요
· 아랍어·스와힐리어 추가, 여러 언어 화면 다듬기
```
**en**
```
🍀 What's new in 1.0.1
· Save your luck's journey as a video (with music) or an image
· A cute animal sender name and your clover photo now travel with your luck
· See clover photos on cheers you received, and tap a passport stamp to see that city's clovers
· A sharper camera view
· Arabic and Swahili, plus polish across languages
```
