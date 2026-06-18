import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IMenuItem } from './menu';
import { getProfile } from "@utils/index";
import { IProfile } from "@shared/types";
import { MessageQueueService } from "@services/message-queue.service";
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-menu',
    templateUrl: './menu.component.html',
    styleUrls: ['./menu.component.less'],
    standalone: false
})
export class MenuComponent implements OnInit {
  @Input() menus: IMenuItem[];
  @Input() isInitialized: boolean = true;
  @Output() logout = new EventEmitter();
  @Output() toggleMenu = new EventEmitter();
  @Input() menuExtended: boolean = true;

  profile: IProfile;
  appVersion: string = environment.version;
  constructor(
    private messageQueueService: MessageQueueService
  ) {
    this.profile = getProfile();
  }

  ngOnInit(): void {
    this.messageQueueService.subscribe(this.messageQueueService.topics.USER_PROFILE_CHANGED, () => {
      this.profile = getProfile();
    });
  }
  toggleMenuMode() {
    this.menuExtended = !this.menuExtended;
    this.toggleMenu.emit(this.menuExtended);
  }

  openSupport() {
    window.open('https://support.featbit.ai', '_blank');
  }

  openDoc() {
    window.open('https://docs.featbit.co', '_blank');
  }
}
