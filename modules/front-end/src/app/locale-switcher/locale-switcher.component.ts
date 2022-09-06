import {
  Inject,
  Component,
  LOCALE_ID,
} from '@angular/core';

@Component({
  selector: 'app-locale-switcher',
  templateUrl: './locale-switcher.component.html',
})
export class LocaleSwitcherComponent {
  locales = [
    { code: 'en', name: 'English' },
    { code: 'zh', name: '中文' },
  ];

  constructor(
    @Inject(LOCALE_ID) public activeLocale: string
  ) {
  }

  onLocaleChange() {
    window.location.href = `/${this.activeLocale}`;
  }
}
