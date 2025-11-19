export const environment = {
  production: true,
  url: window['env']['apiUrl'] || location.origin.replace(/\/$/, ''),
  demoUrl: window['env']['demoUrl'] || 'https://featbit-samples.vercel.app',
  evaluationUrl: window['env']['evaluationUrl'] || location.origin.replace(/\/$/, ''),
  displayApiUrl: window['env']['displayApiUrl'],
  displayEvaluationUrl: window['env']['displayEvaluationUrl']
};
