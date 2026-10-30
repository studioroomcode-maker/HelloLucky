// Keep in sync with docs/privacy-policy.html (the public URL submitted to the stores).
export const CONTACT_EMAIL = 'studioroomcode@gmail.com';
export const POLICY_DATE = '2026-10-30';

export const privacy = {
  ko: [
    ['요약', 'Hello Luck은 회원가입, 광고, 분석 도구가 없습니다. 행운 지도 안내에 동의한 뒤 지도에 찍힌 기록(새로 찾은 기록은 자동, 그 밖의 기록은 “행운 지도에 콕 찍기”를 누른 경우)의 위치와 날짜, 네잎클로버 부분만 잘라낸 작은 사진, 그리고 행운 편지를 주고받는 데 필요한 최소한의 정보(익명 식별자, 정해진 문구 번호, 도시 이름과 약 10km 단위로 반올림한 위치, 시간대, 알림 토큰)만 서버에 저장되며, 원본 사진과 메모는 기기 밖으로 나가지 않습니다.'],
    ['카메라', '카메라 영상은 행운을 찾기 위해 기기 안에서만 실시간 분석되며, 어떤 서버로도 전송되지 않습니다.'],
    ['사진과 메모', '직접 찍은 사진과 메모는 앱 전용 저장공간(기기 내부)에만 저장되며, 행운 지도에 콕 찍기해도 전송되지 않습니다. AI가 네잎클로버를 찾은 사진은 그 부분만 정사각형으로 잘라낸 작은 사진도 함께 기기에 저장됩니다. 앱을 삭제하면 함께 삭제됩니다.'],
    ['위치', '“찾은 장소 함께 저장”을 켠 경우, 사진을 찍는 순간의 위치를 기기에 저장합니다. 장소 이름 표시를 위해 기기 운영체제의 주소 변환 기능(Apple/Google)이 좌표를 사용할 수 있습니다. 설정에서 언제든 끌 수 있습니다.'],
    ['행운 지도', '행운 지도 안내에 동의한 경우에만(동의한 뒤 새로 찾은 기록은 자동으로, 그 밖의 기록은 “행운 지도에 콕 찍기”를 누르면), 그 기록의 정확한 위치(위도·경도), 지역 이름, 찾은 날짜, 네잎클로버 부분만 잘라낸 작은 사진(있는 경우)이 서버(Supabase, 서울 리전)에 저장되어 모든 앱 사용자에게 지도로 공개됩니다. 다른 사용자는 부적절한 사진을 신고할 수 있고, 여러 사람에게 신고된 사진은 모든 사용자에게 숨겨집니다. 신고 기록(익명 식별자)은 서버에 저장됩니다. 이때 기기마다 익명 식별자가 자동으로 만들어지며, 이름·이메일·전화번호 같은 정보는 받지 않습니다. 지도 화면은 Google 지도를 사용합니다.'],
    ['공유 삭제', '각 기록의 “지도에서 빼기”, 설정의 “지도에 찍은 행운 모두 빼기” 또는 “모든 기록 삭제”로 서버의 위치 정보와 클로버 사진을 즉시 삭제할 수 있습니다. 앱을 먼저 삭제하면 익명 식별자가 사라져 앱에서 지울 수 없으니, 아래 메일로 요청해 주세요.'],
    ['행운 편지', '앱을 열면 다른 사용자가 보낸 응원을 받을 수 있도록 익명 식별자, 앱 언어, 기기 시간대(쉬어 가기 좋은 시간에 맞춰 배달하기 위해), 마지막 접속 시각이 서버에 저장됩니다. “응원이 필요한 누군가에게” 행운을 보내거나 받은 행운을 이어 보내면 앱에 정해진 문구 번호, 카드 디자인 번호, 가장 최근 기록의 도시 이름과 약 10km 단위로 반올림한 위치가 저장되어 무작위로 고른 다른 사용자에게 전달됩니다. 기록에서 보내면 그 기록의 네잎클로버 부분만 잘라낸 작은 사진도 함께 전달되고, 이어 보낸 행운에도 그대로 실려 갑니다. 이 도시 정보는 같은 행운을 주고받은 사람들이 “행운의 여정” 지도에서 볼 수 있지만, 누가 보냈는지는 알 수 없습니다. 받은 행운에 고마움 스티커를 보내면 스티커 번호와 도시 이름이 보낸 사람에게 전달됩니다. 원본 사진, 직접 쓴 글, 정확한 위치는 보내지 않습니다. 알림을 허용하면 행운이 도착했을 때 알림을 보내기 위해 기기의 푸시 토큰이 저장되며, 알림은 Expo 푸시 서비스(Apple·Google)를 통해 전달됩니다. 받은 편지는 신고할 수 있으며, 신고 기록(익명 식별자)은 서버에 저장되고 보낸 사람의 행운은 더 이상 나에게 오지 않으며 그 편지의 네잎클로버 사진은 지워집니다.'],
    ['사진 보내기', '공유 버튼을 누를 때에만, 사용자가 고른 앱으로 사진이 전달됩니다.'],
    ['아동', '이 앱은 아동의 개인정보를 의도적으로 수집하지 않습니다.'],
    ['문의', `${CONTACT_EMAIL}`],
  ],
  en: [
    ['Summary', 'Hello Luck has no accounts, ads or analytics. Only the spot, date and a small close-up of just the four-leaf clover for finds pinned on the Lucky Map after you accept its notice (new finds automatically, others when you tap), plus the minimum needed for lucky letters (an anonymous identifier, a curated message number, a city name with a point rounded to about 10 km, your time zone and a push token), are stored on our server; your original photos and notes never leave your device.'],
    ['Camera', 'The camera feed is analyzed in real time on your device only, to find luck in clover patches. Camera video is never uploaded.'],
    ['Photos and notes', 'Photos and notes you save stay in the app’s private storage on your device, even when you share to the Lucky Map, and are removed when you uninstall the app. When the AI found the clover, a small square close-up cut around it is saved on your device too.'],
    ['Location', 'If “Save where you found it” is on, the location at capture time is stored on your device. To show a place name, your operating system’s geocoder (Apple/Google) may process the coordinates. You can turn this off in Settings at any time.'],
    ['Lucky Map', 'Only after you accept the Lucky Map notice (from then on new finds are pinned automatically, and other finds when you tap “Pin it on the Lucky Map”), a find’s exact location (latitude/longitude), area name, date and the small clover close-up (if any) are stored on our server (Supabase, Seoul region) and shown on a map to all app users. Other users can report an inappropriate photo; a photo reported by several people is hidden for everyone. Reports (with an anonymous identifier) are stored on our server. An anonymous identifier is created for your device; we never ask for your name, email or phone number. The map is provided by Google Maps.'],
    ['Removing shares', 'Use “Unpin” on a find, “Unpin all my luck” or “Delete all finds” in Settings to delete shared locations and clover photos from the server immediately. If you uninstall first, the anonymous identifier is lost; email us and we will remove them.'],
    ['Lucky letters', 'So you can receive cheers from other users, an anonymous identifier, your app language, your device time zone (to deliver at a restful moment) and when you last opened the app are stored on our server. When you send luck “to someone who needs a cheer” or pass on luck you received, a curated message number, a card design number, and the city of your latest find with a point rounded to about 10 km are stored and delivered to a randomly chosen user. A letter sent from a find also carries a small close-up of just its four-leaf clover, which stays with the letter as it is passed on. People who passed the same luck along can see these cities on the “Journey of luck” map, but never who sent it. If you send a thank-you sticker, its number and your city reach the sender. No original photos, free text or exact locations are sent. If you allow notifications, your device push token is stored so we can tell you when luck arrives; notifications are delivered through the Expo push service (Apple/Google). You can report a letter you received: the report (with anonymous identifiers) is stored on our server, the sender’s letters no longer reach you, and its clover photo is removed from the letter.'],
    ['Sending photos', 'A photo leaves the app only when you tap Share and choose an app.'],
    ['Children', 'This app does not knowingly collect personal information from children.'],
    ['Contact', `${CONTACT_EMAIL}`],
  ],
} as const;
