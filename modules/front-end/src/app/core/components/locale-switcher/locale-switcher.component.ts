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
    const regex = /^\/(en|zh)\//ig;
    if (regex.test(location.pathname)) {
      // only reload the page on not ng serve mode
      localStorage.setItem(CURRENT_LANGUAGE(), this.activeLocale);
      window.location.href = location.pathname.replace(regex, `/${this.activeLocale}/`);
    } else {
      console.log('The language switcher does not work while run with ng serve, please read the README to check how to run with docker');
    }
  }
}
