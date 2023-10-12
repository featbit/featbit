export const environment = {
  production: false,
  url: window['env']['apiUrl'] || 'http://localhost:5000',
  demoUrl: window['env']['demoUrl'] || 'https://featbit-samples.vercel.app',
  evaluationUrl: window['env']['evaluationUrl'] || 'http://localhost:5100',
};
