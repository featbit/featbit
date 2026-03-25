import { HOSTING_MODE } from "@shared/constants";

export const environment = {
  production: true,
  url: window['env']['apiUrl'] || location.origin.replace(/\/$/, ''),
  demoUrl: window['env']['demoUrl'] || 'https://featbit-samples.vercel.app',
  evaluationUrl: window['env']['evaluationUrl'] || location.origin.replace(/\/$/, ''),
  displayApiUrl: window['env']['displayApiUrl'],
  displayEvaluationUrl: window['env']['displayEvaluationUrl'],
  hostingMode: window['env']['hostingMode'] || HOSTING_MODE.SELF_HOSTED
};
