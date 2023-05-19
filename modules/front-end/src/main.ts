import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

import posthog from 'posthog-js';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));


  
    
console.log('posthog init');
posthog.init('phc_hN7lDT3xsrS6Q0xL7plkYGjy631tgNErXsoGPmBU0UH', { api_host: 'https://app.posthog.com' });