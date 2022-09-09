import {Component, EventEmitter, Inject, Input, LOCALE_ID, Output} from '@angular/core';
import { IMenuItem } from './menu';
import { getAuth } from "@utils/index";
import { IAuthProps } from "@shared/types";

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
  }

  toggleMenuMode() {
    this.menuExtended = !this.menuExtended;
    this.toggleMenu.emit(this.menuExtended);
  }
}
