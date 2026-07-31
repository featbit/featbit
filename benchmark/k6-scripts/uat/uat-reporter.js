import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'uat-results.json': JSON.stringify(data, null, 2),
  };
}
