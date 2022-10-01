import {Component, EventEmitter, Inject, Input, LOCALE_ID, OnInit, Output} from '@angular/core';
import { IMenuItem } from './menu';
import { getAuth } from "@utils/index";
import { IAuthProps } from "@shared/types";
import {generalResourceRNPattern, permissionActions} from "@shared/permissions";
import {MessageQueueService} from "@services/message-queue.service";

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.less']
})
export class MenuComponent implements OnInit {
  @Input() menus: IMenuItem[];
  @Input() isInitialized: boolean = true;
  @Output() logout = new EventEmitter();
  @Output() toggleMenu = new EventEmitter();
  @Input() menuExtended: boolean = true;

  auth: IAuthProps;
  constructor(private messageQueueService: MessageQueueService,) {
    this.auth = getAuth();
  }

  ngOnInit(): void {
    this.messageQueueService.subscribe(this.messageQueueService.topics.USER_PROFILE_CHANGED, () => {
      this.auth = getAuth();
    });
  }
  toggleMenuMode() {
    this.menuExtended = !this.menuExtended;
    this.toggleMenu.emit(this.menuExtended);
  }
}
