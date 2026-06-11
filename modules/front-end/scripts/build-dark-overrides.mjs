// Generates src/styles-dark-overrides.css by scanning all component-level
// `.less` files under src/, compiling them with LESS, and emitting
// dark-mode overrides for any grayscale (low-saturation) light colors used
// in background / border / color / box-shadow / outline / fill / stroke
// declarations.
//
// Heuristic, not exhaustive — covers the bulk of hardcoded `#fff` / light
// grey values across ~60 component LESS files. Hand-tuned overrides live in
// styles-dark.less alongside the import of this file and take precedence.

import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';
import less from 'less';
import postcss from 'postcss';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const SRC = resolve(root, 'src');
const DST = resolve(SRC, 'styles-dark-overrides.css');
const PREFIX = 'html[data-theme="dark"]';

// ---------------------------------------------------------------------------
// Color helpers

function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 4) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function parseRgb(str) {
  const m = str.match(/rgba?\s*\(\s*([0-9.]+)\s*[,\s]\s*([0-9.]+)\s*[,\s]\s*([0-9.]+)\s*(?:[,/]\s*([0-9.%]+))?\s*\)/i);
  if (!m) return null;
  const r = +m[1], g = +m[2], b = +m[3];
  let a = 1;
  if (m[4]) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r, g, b, a };
}

const NAMED = { white: '#ffffff', black: '#000000', transparent: 'transparent' };

function toRgb(token) {
  if (!token) return null;
  const t = token.trim().toLowerCase();
  if (t === 'transparent' || t === 'currentcolor' || t === 'inherit') return null;
  if (NAMED[t] && NAMED[t] !== 'transparent') return parseHex(NAMED[t]);
  if (t.startsWith('#')) return parseHex(t);
  if (t.startsWith('rgb')) return parseRgb(t);
  return null;
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

// Decide whether a color is "grayscale-ish enough" that we should flip it,
// or a colored accent that we should leave alone.
function isNearGray({ r, g, b }) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Loosened from <25 to <=35 so Featbit's slate-grays (e.g. @grey50-color
  // #717D8A with delta=25, @grey70-color #4F5B67 with delta=32) get
  // recognized as gray and flipped for readable contrast in dark mode.
  return max - min <= 35;
}

// Map a light grayscale color to its dark equivalent. Returns null if the
// color shouldn't be flipped.
function mapLightToDark(rgb, role) {
  if (!rgb) return null;
  if (!isNearGray(rgb)) return null;
  const { l } = rgbToHsl(rgb);

  if (role === 'background' || role === 'shadow') {
    // Pure or near-pure white in the source = page/app shell background.
    // Make this darker than container surfaces so containers stand out
    // against the page (mirroring light mode where page is #fff and
    // containers are #FAFAFA / #F1F1F1).
    if (l >= 0.99) return '#262626';      // page shell (#fff, #fefefe)
    if (l >= 0.92) return '#333333';      // container surface (#fafafa, #f1f1f1, #f4f5f7)
    if (l >= 0.85) return '#3d3d3d';      // hover / divider tints (#eaecee, #e8e8e8)
    if (l >= 0.75) return '#474747';      // raised pill / chip (#d6dade-ish)
    return null;
  }
  if (role === 'border') {
    // Borders should sit only slightly above the surface they outline so
    // they read as soft separators (matching how the original light-mode
    // borders use #EAECEE / #D6DADE on #FAFAFA — delta of just a few %).
    if (l >= 0.92) return '#363636';      // #EAECEE-ish on container
    if (l >= 0.80) return '#3d3d3d';      // #D6DADE-ish
    if (l >= 0.65) return '#454545';      // #A8B0B9-ish (medium contrast)
    return null;
  }
  if (role === 'text') {
    if (l <= 0.20) return 'rgba(255, 255, 255, 0.92)';
    if (l <= 0.40) return 'rgba(255, 255, 255, 0.85)';
    if (l <= 0.55) return 'rgba(255, 255, 255, 0.65)';
    if (l <= 0.70) return 'rgba(255, 255, 255, 0.45)';
    return null;
  }
  return null;
}

// Convert hex shorthand to a {r,g,b} triple. Returns null if not parseable.
function hexToRgb(hex) {
  const m = hex.match(/^#([0-9a-fA-F]{3,8})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// Replace each color token inside a CSS value string. role determines mapping.
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\([^)]*\)|\b(?:white|black)\b/g;

function rewriteValue(value, role) {
  let changed = false;
  const out = value.replace(COLOR_RE, (m) => {
    const rgb = toRgb(m);
    const dark = mapLightToDark(rgb, role);
    if (!dark) return m;
    changed = true;
    // Preserve the source alpha so subtle shadows / fades stay subtle.
    if (rgb && rgb.a !== undefined && rgb.a < 1) {
      const dst = hexToRgb(dark);
      if (dst) {
        return `rgba(${dst.r}, ${dst.g}, ${dst.b}, ${rgb.a})`;
      }
    }
    return dark;
  });
  return changed ? out : null;
}

const PROP_ROLES = new Map([
  ['background', 'background'],
  ['background-color', 'background'],
  ['background-image', 'background'],
  ['color', 'text'],
  ['border', 'border'],
  ['border-color', 'border'],
  ['border-top', 'border'],
  ['border-right', 'border'],
  ['border-bottom', 'border'],
  ['border-left', 'border'],
  ['border-top-color', 'border'],
  ['border-right-color', 'border'],
  ['border-bottom-color', 'border'],
  ['border-left-color', 'border'],
  ['outline', 'border'],
  ['outline-color', 'border'],
  ['box-shadow', 'shadow'],
  ['fill', 'text'],
  ['stroke', 'text'],
]);

// ---------------------------------------------------------------------------
// Selector prefixing (skips nothing — every selector becomes scoped under PREFIX)

function prefixSelector(sel) {
  const t = sel.trim();
  if (!t) return t;
  if (t.startsWith(':host')) return t; // shouldn't occur in compiled CSS, defensive
  if (/^html(?![\w-])/.test(t)) return PREFIX + t.slice(4);
  if (t === ':root') return PREFIX;
  return `${PREFIX} ${t}`;
}

// ---------------------------------------------------------------------------
// Process a single .less file

// Files that legitimately cannot be compiled standalone (e.g. they rely on
// mixins or context that LESS can't resolve outside their normal aggregator).
// Failures for any file NOT in this allowlist are treated as fatal so that a
// silently broken dark-mode theme can never sneak into a release.
const LESS_COMPILE_ALLOWLIST = new Set([
  // Add `relative(SRC, file).replace(/\\\\/g, '/')` paths here as needed.
]);

async function processFile(file) {
  let lessSrc = readFileSync(file, 'utf8');
  // For src/styles-common.less (and any aggregator file), strip imports of
  // ng-zorro's full LESS source. Otherwise the compiler emits the entire
  // ant-design light theme (e.g. `.ant-tag-pink { background: #fff0f6 }`)
  // and we then dutifully generate dark overrides for every vendor class —
  // overwriting the prefixed ng-zorro dark vendor stylesheet that already
  // handles those classes correctly. We only want to process featbit's own
  // declarations, not vendor LESS.
  lessSrc = lessSrc.replace(
    /@import\s+["'][^"']*ng-zorro-antd[^"']*["']\s*;\s*/g,
    ''
  );
  // Many shared partials in src/styles/ don't import `variables` themselves
  // (they're meant to be included from styles.less). Inject it so we can
  // compile any file standalone. Adding it twice is harmless.
  const wrapped = `@import "variables";\n` + lessSrc;
  let css;
  try {
    const result = await less.render(wrapped, {
      filename: file,
      paths: [SRC],
      javascriptEnabled: false,
    });
    css = result.css;
  } catch (e) {
    const rel = relative(SRC, file).replace(/\\/g, '/');
    const message = e.message.split('\n')[0];
    if (LESS_COMPILE_ALLOWLIST.has(rel)) {
      console.warn(`  skip (allowlisted less error): ${rel}: ${message}`);
      return [];
    }
    // Surface the failure to the caller so the build fails loudly. Silent
    // skips are how dark-mode regressions ship.
    const err = new Error(`LESS compile failed for ${rel}: ${message}`);
    err.cause = e;
    err.relativePath = rel;
    throw err;
  }

  const ast = postcss.parse(css);
  const overrides = [];

  ast.walkRules((rule) => {
    // Skip rules inside @keyframes / @font-face / @counter-style etc.
    let p = rule.parent;
    while (p && p.type !== 'root') {
      if (p.type === 'atrule') {
        const n = p.name.toLowerCase();
        if (['keyframes', '-webkit-keyframes', 'font-face', 'page',
             'font-feature-values', 'counter-style', 'property'].includes(n)) {
          return;
        }
      }
      p = p.parent;
    }

    const newDecls = [];
    rule.walkDecls((decl) => {
      const role = PROP_ROLES.get(decl.prop.toLowerCase());
      if (!role) return;
      const rewritten = rewriteValue(decl.value, role);
      if (rewritten !== null) {
        // Force !important so we beat Angular view-encapsulation specificity
        // (component selectors get an extra [_ngcontent-x] attribute that
        // would otherwise outweigh our html[data-theme="dark"] prefix).
        newDecls.push({ prop: decl.prop, value: rewritten, important: true });
      }
    });

    if (newDecls.length === 0) return;

    // For each selector in the comma list, emit a prefixed override rule.
    for (const sel of rule.selectors) {
      const prefixed = prefixSelector(sel);
      overrides.push({ selector: prefixed, decls: newDecls, atMedia: findMediaParent(rule) });
    }
  });

  return overrides;
}

function findMediaParent(rule) {
  let p = rule.parent;
  while (p && p.type !== 'root') {
    if (p.type === 'atrule' && p.name.toLowerCase() === 'media') {
      return p.params;
    }
    p = p.parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main

function walkDir(dir, suffix, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkDir(p, suffix, out);
    else if (ent.isFile() && p.endsWith(suffix)) out.push(p);
  }
  return out;
}

// Scan component styles AND shared partials under src/styles/ (which define
// reusable widgets like .body-container, .table-content-area, etc.) AND
// styles-common.less. Skip our own dark theme entries to avoid feedback.
const SKIP = new Set([
  'styles.less', 'styles-zh.less', 'styles-dark.less', 'variables.less',
]);

const componentFiles = walkDir(resolve(SRC, 'app'), '.component.less');
const partialFiles = walkDir(resolve(SRC, 'styles'), '.less');
const rootLess = ['styles-common.less']
  .map(n => resolve(SRC, n))
  .filter(p => {
    try { return statSync(p).isFile(); } catch { return false; }
  });

const files = [...componentFiles, ...partialFiles, ...rootLess]
  .filter(f => !SKIP.has(f.split(/[\\/]/).pop()));

console.log(`Scanning ${files.length} .less files…`);

const allOverrides = [];
const failures = [];
let processed = 0;
for (const f of files) {
  try {
    const out = await processFile(f);
    if (out.length) {
      allOverrides.push({ file: relative(SRC, f), rules: out });
    }
  } catch (e) {
    failures.push({ file: relative(SRC, f), message: e.message });
  }
  processed++;
}

if (failures.length) {
  console.error(`\nFAILED to compile ${failures.length} LESS file(s):`);
  for (const { file, message } of failures) {
    console.error(`  - ${file}: ${message}`);
  }
  console.error(`\nFix the LESS errors above, or add the affected paths to LESS_COMPILE_ALLOWLIST in scripts/build-dark-overrides.mjs.`);
  process.exit(1);
}

// Render output
let css = `/* Generated by scripts/build-dark-overrides.mjs — do not edit by hand. */\n`;
css += `/* Regenerate via: npm run build:dark-css */\n\n`;

let totalRules = 0;
for (const { file, rules } of allOverrides) {
  if (!rules.length) continue;
  css += `/* ${file} */\n`;
  // Group by atMedia
  const byMedia = new Map();
  for (const r of rules) {
    const key = r.atMedia || '';
    if (!byMedia.has(key)) byMedia.set(key, []);
    byMedia.get(key).push(r);
  }
  for (const [media, rs] of byMedia) {
    const indent = media ? '  ' : '';
    if (media) css += `@media ${media} {\n`;
    for (const r of rs) {
      css += `${indent}${r.selector} {\n`;
      for (const d of r.decls) {
        css += `${indent}  ${d.prop}: ${d.value}${d.important ? ' !important' : ''};\n`;
      }
      css += `${indent}}\n`;
      totalRules++;
    }
    if (media) css += `}\n`;
  }
  css += '\n';
}

writeFileSync(DST, css, 'utf8');
const bytes = statSync(DST).size;
console.log(`Wrote ${relative(root, DST)} — ${totalRules} rules, ${bytes.toLocaleString()} bytes`);
