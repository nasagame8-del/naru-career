/** Refresh locally hosted font subsets after changing diagnosis copy. Run: node scripts/sync-shindan-fonts.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = [
  'src/app/shindan/page.tsx',
  'src/app/shindan/_lib/data.ts',
  'src/app/shindan/_lib/matching.ts',
  'src/app/shindan/_lib/cta-data.ts',
  'src/app/shindan/_components/ResultContent.tsx',
];
const text = (await Promise.all(sources.map(file => readFile(join(root, file), 'utf8')))).join('');
const characters = [...new Set(text)];
let css = '/* Local Google Fonts subsets. Refresh with node scripts/sync-shindan-fonts.mjs. OFL licenses accompany the fonts. */\n';

async function get(url, binary = false) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36' } });
  if (!response.ok) throw new Error(`Font request failed: ${response.status}`);
  return binary ? Buffer.from(await response.arrayBuffer()) : response.text();
}
for (const family of ['Lato', 'Noto Sans JP']) {
  // Separate Latin and Japanese text to stay within Google's subset request size.
  const subset = characters.filter(character => family === 'Lato' ? character.codePointAt(0) < 0x3000 : character.codePointAt(0) >= 0x3000).join('');
  const body = await get(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700;900&display=swap&text=${encodeURIComponent(subset)}`);
  const blocks = body.match(/@font-face\s*\{[^}]+\}/g) || [];
  if (blocks.length !== 3) throw new Error(`Unexpected subset response for ${family}; refusing to overwrite fonts.`);
  const seen = new Map();
  for (const block of blocks) {
    const weight = block.match(/font-weight:\s*(\d+)/)[1];
    const remote = block.match(/url\(([^)]+)\)/)[1];
    if (!block.includes("format('woff2')")) throw new Error('Expected WOFF2 font.');
    let filename = seen.get(remote);
    if (!filename) {
      filename = `${family.toLowerCase().replaceAll(' ', '-')}-${weight}-quest-v3.woff2`;
      await writeFile(join(root, 'public/shindan/fonts', filename), await get(remote, true));
      seen.set(remote, filename);
    }
    css += `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url('/shindan/fonts/${filename}') format('woff2'); }\n`;
  }
}
await writeFile(join(root, 'src/app/shindan/fonts.css'), css);
console.log('Updated diagnosis font subsets.');
