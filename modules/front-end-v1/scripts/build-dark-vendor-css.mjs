// Generates src/styles-dark-vendor.css by prefixing every selector in
// ng-zorro-antd's precompiled dark theme with `html[data-theme="dark"]`.
//
// Why: importing ng-zorro-antd.dark.less inside a LESS selector wrapper causes
// `&` references in compound selectors (e.g. `:not(.x)&`) to expand into
// invalid CSS like `:not(.x)html[data-theme="dark"]`. Prefixing the already-
// compiled CSS sidesteps LESS nesting altogether.
//
// Run via `npm run build:dark-css` whenever ng-zorro-antd is upgraded.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import postcss from 'postcss';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const SRC = resolve(root, 'node_modules/ng-zorro-antd/ng-zorro-antd.dark.min.css');
const DST = resolve(root, 'src/styles-dark-vendor.css');
const PREFIX = 'html[data-theme="dark"]';

const css = readFileSync(SRC, 'utf8');
const ast = postcss.parse(css);

function prefixSelector(sel) {
  const trimmed = sel.trim();
  if (!trimmed) return trimmed;

  if (trimmed === ':root' || trimmed === 'html') {
    return PREFIX;
  }
  if (trimmed.startsWith(':root')) {
    return PREFIX + trimmed.slice(':root'.length);
  }
  if (/^html(?![\w-])/.test(trimmed)) {
    return PREFIX + trimmed.slice(4);
  }

  return `${PREFIX} ${trimmed}`;
}

ast.walkRules((rule) => {
  let parent = rule.parent;
  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule') {
      const n = parent.name.toLowerCase();
      if (n === 'keyframes' || n === '-webkit-keyframes' ||
          n === 'font-feature-values' || n === 'page' ||
          n === 'counter-style' || n === 'property') {
        return;
      }
    }
    parent = parent.parent;
  }

  rule.selectors = rule.selectors.map(prefixSelector);
});

const out = ast.toResult().css;

// Replace ng-zorro dark theme's default blue accent with FeatBit's green
// (matches @primary-color from variables.less). Covers primary, hover,
// active, and the tinted backgrounds antd derives for the dark palette.
const ACCENT_REPLACEMENTS = [
  // Primary palette
  [/#177ddc/gi, '#3CC798'], // primary-6 (base)
  [/#165996/gi, '#23AD7F'], // primary-7 (active/border)
  [/#388ed3/gi, '#5CE6B8'], // hover-derived blue
  [/#3c9ae8/gi, '#5CE6B8'], // primary-7 light variant
  [/#3c9be8/gi, '#5CE6B8'], // active variant
  [/#65b7f3/gi, '#76EBC5'], // primary-8
  [/#8dcff8/gi, '#90F0D0'], // primary-9
  [/#b7e3fa/gi, '#C8FAE9'], // primary-10
  [/#0958d9/gi, '#0E8F64'], // active dark
  [/#095cb5/gi, '#0E8F64'], // hover dark variant
  [/#003eb3/gi, '#00754E'], // pressed
  // Tinted dark backgrounds derived from primary in antd's dark algorithm
  [/#111b26/gi, '#0a1a14'],
  [/#112545/gi, '#0e2a1f'],
  [/#15325b/gi, '#11402d'],
];

let patched = out;
for (const [re, dst] of ACCENT_REPLACEMENTS) {
  patched = patched.replace(re, dst);
}

writeFileSync(DST, patched, 'utf8');

console.log(`Wrote ${DST} (${patched.length.toLocaleString()} bytes)`);
