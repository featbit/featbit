import {Component, EventEmitter, Inject, Input, LOCALE_ID, Output} from '@angular/core';
import { IMenuItem } from './menu';
import { getAuth } from "@utils/index";
import { IAuthProps } from "@shared/types";
import {CURRENT_LANGUAGE} from "@utils/localstorage-keys";

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.less']
})
export class MenuComponent {
  @Input() menus: IMenuItem[];
  @Input() isInitialized: boolean = true;
  @Output() logout = new EventEmitter();
  @Output() toggleMenu = new EventEmitter();
  @Input() menuExtended: boolean = true;

  auth: IAuthProps;
  constructor(@Inject(LOCALE_ID) public activeLocale: string) {
    this.auth = getAuth();
    const lang = localStorage.getItem(CURRENT_LANGUAGE());
    if (lang !== 'null' && lang !== null && lang !== this.activeLocale) {
      this.onLocaleChange(lang);
    }
  }

  toggleMenuMode() {
    this.menuExtended = !this.menuExtended;
    this.toggleMenu.emit(this.menuExtended);
  }

  onLocaleChange(lang: string) {
    const regex = /^\/(en|zh)\//ig;
    if (regex.test(location.pathname)) {
      // only reload the page on not ng serve mode
      this.activeLocale = lang;
      localStorage.setItem(CURRENT_LANGUAGE(), lang);
      window.location.href = location.pathname.replace(regex, `/${lang}/`);
    } else {
      console.log('The language switcher does not work while run with ng serve, please read the README to check how to run with docker');
    }
  }
}
