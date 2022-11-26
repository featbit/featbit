export const environment = {
  production: false,
  url: window['env']['apiUrl'] || 'http://localhost:5000',
  demoUrl: window['env']['demoUrl'] || '__DEMO_URL__',
  evaluationUrl: window['env']['evaluationUrl'] || '__EVALUATION_URL__'
};
