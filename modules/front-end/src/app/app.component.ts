import { Component } from '@angular/core';
import packageInfo from '../../package.json';
import { environment } from '../environments/environment';

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
    console.log(`Env: ${environment.production ? 'Prod' : 'dev' }; Version: ${packageInfo.version}`);
  }
}

