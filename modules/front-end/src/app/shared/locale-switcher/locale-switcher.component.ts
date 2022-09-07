import {
  Inject,
  Component,
  LOCALE_ID,
} from '@angular/core';
import {CURRENT_ACCOUNT, CURRENT_LANGUAGE} from "@utils/localstorage-keys";

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
    const lang = localStorage.getItem(CURRENT_LANGUAGE());
    if (lang !== 'null' && lang !== null && lang !== this.activeLocale) {
      this.activeLocale = lang;
      this.onLocaleChange();
    }
  }

  onLocaleChange() {
    localStorage.setItem(CURRENT_LANGUAGE(), this.activeLocale);
    window.location.href = `/${this.activeLocale}`;
  }
}
