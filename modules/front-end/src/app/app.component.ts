import { Component } from '@angular/core';
import packageInfo from '../../package.json';
import { environment } from '../environments/environment';
import { Router, Event, NavigationStart, NavigationEnd, NavigationError } from '@angular/router';
import posthog from 'posthog-js';

interface Locale {
  localeCode: string;
  label: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})
export class AppComponent {
  locales: Locale[] = [
    { localeCode: 'en-US', label: 'English' },
    { localeCode: 'zh', label: '中文' },
  ];

  constructor(private router: Router) {
    console.log(`Env: ${environment.production ? 'Prod' : 'dev'}; Version: ${packageInfo.version}`);
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        posthog.capture(`NavigationEnd URL: ${event.urlAfterRedirects}`, { property: 'value' });
      }
    });
  }
}

