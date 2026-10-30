// app.json 이 원본이다. 앱인토스 번들(EXPO_PUBLIC_TOSS=1, TOSS.md)만 서버 사전 렌더링 없이 한 페이지로 내보낸다
// (토스는 SSR 금지·카메라/IndexedDB 같은 브라우저 API는 Node 에서 못 돈다). 그 밖에는 설정을 그대로 돌려준다.
module.exports = ({ config }) =>
  process.env.EXPO_PUBLIC_TOSS === '1' ? { ...config, web: { ...config.web, output: 'single' } } : config;
