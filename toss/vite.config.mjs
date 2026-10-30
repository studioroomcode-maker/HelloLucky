// vite 는 두 가지만 한다.
//  · npm run dev   — web/(build-src.mjs --dev 결과)를 띄운다. devtools 플러그인이 토스 SDK 를
//                    가짜(mock)로 바꾸고 패널(권한·뒤로가기 등 상태 조작)을 붙인다.
//  · npm run build — src/toss-bridge.js 를 SDK 와 함께 한 덩어리 IIFE(dist/toss-bridge.js)로 묶는다.
//                    앱 자체(Expo web export)는 vite 를 거치지 않는다.
import { defineConfig } from 'vite';
import aitDevtools from '@apps-in-toss/devtools/unplugin';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: 'web',
      plugins: [aitDevtools.vite()],
      server: { port: 5173, host: true, fs: { allow: ['..'] } },
    };
  }
  return {
    // 라이브러리 모드는 process.env.NODE_ENV 를 치환하지 않는다 — 브라우저에서 process 가 없어 멈추지 않게
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      outDir: 'dist',
      emptyOutDir: false, // build-src.mjs 가 먼저 채운 파일을 지우지 않는다
      target: 'es2018',
      lib: {
        entry: 'src/toss-bridge.js',
        formats: ['iife'],
        name: 'HlTossBridge',
        fileName: () => 'toss-bridge.js',
      },
    },
  };
});
