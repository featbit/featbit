export const environment = {
  production: true,
  enableSchedule: false,
  url: window['env']['apiUrl'] || location.origin.replace(/\/$/, ''),
  demoUrl: window['env']['demoUrl'] || 'https://featbit-samples.vercel.app',
  evaluationUrl: window['env']['evaluationUrl'] || location.origin.replace(/\/$/, '')
};
