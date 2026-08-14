import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = process.env;

const entries = {
  apiUrl: env.API_URL ?? '',
  demoUrl: env.DEMO_URL ?? '',
  evaluationUrl: env.EVALUATION_URL ?? '',
  displayApiUrl: env.DISPLAY_API_URL ?? '',
  displayEvaluationUrl: env.DISPLAY_EVALUATION_URL ?? '',
  hostingMode: env.HOSTING_MODE ?? ''
};

const lines = [
  '(function(window) {',
  '  window.env = window.env || {};',
  '',
  '  // Environment variables'
];

for (const [key, value] of Object.entries(entries)) {
  lines.push(`  window["env"][${JSON.stringify(key)}] = ${JSON.stringify(value)};`);
}

lines.push('})(this);', '');

writeFileSync(resolve('src/assets/env.js'), lines.join('\n'));
