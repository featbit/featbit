import { Component } from '@angular/core';
import packageInfo from '../../package.json';

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

  constructor() {
    console.log(`Current Version: ${packageInfo.version}`);
  }
}

