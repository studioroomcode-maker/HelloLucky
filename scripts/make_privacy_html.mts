// Regenerates docs/privacy-policy.html (the public URL for the stores) from src/privacyText.ts.
// Usage: node scripts/make_privacy_html.mts
import { readFileSync, writeFileSync } from 'node:fs';
import { CONTACT_EMAIL, POLICY_DATE, privacy } from '../src/privacyText.ts';

const out = new URL('../docs/privacy-policy.html', import.meta.url);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const body = (rows: readonly (readonly [string, string])[]) =>
  rows.map(([h, b]) => `  <h2>${esc(h)}</h2><p>${esc(b)}</p>`).join('\n');

const head = readFileSync(out, 'utf8').split('<main>')[0];
writeFileSync(
  out,
  `${head}<main>
  <!-- Generated from src/privacyText.ts by scripts/make_privacy_html.mts -->
  <h1>Hello Luck 개인정보처리방침</h1>
  <p class="date">시행일 ${POLICY_DATE}</p>
${body(privacy.ko)}

  <hr>

  <h1>Hello Luck Privacy Policy</h1>
  <p class="date">Effective ${POLICY_DATE}</p>
${body(privacy.en)}
</main>
</body>
</html>
`,
);
console.log(`docs/privacy-policy.html ← ${privacy.ko.length} sections, contact ${CONTACT_EMAIL}`);
