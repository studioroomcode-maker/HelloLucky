// 앱인토스 번들 만들기 — Expo 앱을 웹으로 내보내고(EXPO_PUBLIC_TOSS=1) 토스용 껍데기만 손본다.
//
//   node build-src.mjs         → dist/  (배포 번들. 이어서 vite build 가 dist/toss-bridge.js 를 더한다)
//   node build-src.mjs --dev   → web/   (개발 서버 루트. 브리지는 모듈로 싣고 devtools 가 SDK 를 가짜로 바꾼다)
//
// 토스는 우리 사이트를 불러올 수 없다(자사 도메인 이동·임베드 금지) — 화면·모델·런타임을 전부 번들에 담는다.
// 앱 코드는 하나뿐이다. 토스 전용 동작은 IS_TOSS(src/config/toss.ts)와 *.web.ts 파일, metro.config.js 의 웹 대체 모듈에 있다.
// 원본 구조가 바뀌어 치환이 빗나가면 조용히 넘어가지 않고 빌드를 멈춘다.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..'); // Expo 앱(저장소 루트)
const DEV = process.argv.includes('--dev');
const OUT = join(HERE, DEV ? 'web' : 'dist');
const LIMIT_MB = 100; // 토스 번들 한도(압축 전)

// LiteRT.js 런타임 — 브라우저가 relaxed SIMD 를 지원하면 internal, 아니면 compat 을 고른다(스레드·JSPI 판은 안 쓴다).
const LITERT = ['litert_wasm_internal.js', 'litert_wasm_internal.wasm', 'litert_wasm_compat_internal.js', 'litert_wasm_compat_internal.wasm'];

// 번들에 남으면 안 되는 것 — 앱 마켓·자사 설치 유도(검수 '자사 앱 설치 유도 금지')
const FORBIDDEN = [/apps\.apple\.com/, /play\.google\.com\/store/, /helloluck\.studioroomkr\.com\/go/];

function must(s, from, to, what) {
  if (!s.includes(from)) throw new Error(`[build-src] 웹 내보내기 결과에서 '${what}' 을(를) 찾지 못했어요 — Expo 의 index.html 이 바뀌었는지 확인하세요.`);
  return s.split(from).join(to);
}

function sizeOf(dir) {
  let n = 0;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    n += st.isDirectory() ? sizeOf(p) : st.size;
  }
  return n;
}

function filesUnder(dir, ext) {
  return readdirSync(dir, { recursive: true }).map((f) => join(dir, f)).filter((p) => p.endsWith(ext) && statSync(p).isFile());
}

rmSync(OUT, { recursive: true, force: true });
const exp = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PUBLIC_TOSS: '1' },
});
if (exp.status !== 0) throw new Error(`[build-src] expo export 실패 (종료 코드 ${exp.status})`);

const wasmDir = join(ROOT, 'node_modules', '@litertjs', 'core', 'wasm');
mkdirSync(join(OUT, 'litert'), { recursive: true });
for (const f of LITERT) {
  if (!existsSync(join(wasmDir, f))) throw new Error(`[build-src] LiteRT 런타임 파일이 없어요: ${f} — 루트에서 npm install`);
  cpSync(join(wasmDir, f), join(OUT, 'litert', f));
}

let html = readFileSync(join(OUT, 'index.html'), 'utf8');
html = must(html, '<html lang="en">', '<html lang="ko">', 'html lang');
// 토스 검수: 지도 말고는 핀치 확대를 막는다(지도는 Leaflet 이 자체 제스처로 확대한다). 안전 영역 env() 를 쓰려면 viewport-fit=cover.
html = must(
  html,
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />\n    <meta name="color-scheme" content="light" />',
  'viewport 메타',
);
// 브리지는 앱 스크립트(defer)보다 먼저 — 앱이 시작할 때 window.hlToss 가 이미 있다
const bridge = DEV ? '<script type="module" src="/toss-bridge.dev.js"></script>' : '<script src="/toss-bridge.js"></script>';
html = must(html, '<meta charset="utf-8" />', `<meta charset="utf-8" />\n    ${bridge}`, 'charset 메타');
writeFileSync(join(OUT, 'index.html'), html);
if (DEV) writeFileSync(join(OUT, 'toss-bridge.dev.js'), "import '../src/toss-bridge.js';\n");

for (const file of [join(OUT, 'index.html'), ...filesUnder(join(OUT, '_expo'), '.js')]) {
  const text = readFileSync(file, 'utf8');
  const hit = FORBIDDEN.find((re) => re.test(text));
  if (hit) throw new Error(`[build-src] 번들에 금지된 링크가 있어요(${hit}): ${relative(OUT, file)}`);
}

const mb = sizeOf(OUT) / 1048576;
if (mb > LIMIT_MB) throw new Error(`[build-src] 번들이 ${mb.toFixed(1)} MB 예요 — 토스 한도 ${LIMIT_MB} MB 를 넘어요.`);
console.log(`[build-src] ${relative(HERE, OUT)}/ 준비 — ${mb.toFixed(2)} MB (토스 한도: 압축 전 ${LIMIT_MB} MB)`);
