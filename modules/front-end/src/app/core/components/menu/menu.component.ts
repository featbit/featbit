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
  userInitial: string = 'A';
  appVersion: string = environment.version;

  setProfile() {
    this.profile = getProfile();
    this.userInitial = ((this.profile?.name || this.profile?.email) ?? '?').charAt(0).toUpperCase();
  }

  constructor(private messageQueueService: MessageQueueService) {
    this.setProfile();
  }

  ngOnInit(): void {
    this.messageQueueService.subscribe(this.messageQueueService.topics.USER_PROFILE_CHANGED, () => {
      this.setProfile();
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

  onSubmenuOpenChange(opened: IMenuItem, isOpen: boolean) {
    opened.open = isOpen;
    if (isOpen) {
      this.closeOtherSubmenus(this.menus, opened);
    }
  }

  onLeafItemClick() {
    this.closeAllSubmenus(this.menus);
  }

  private closeAllSubmenus(items: IMenuItem[]) {
    if (!items) return;
    for (const item of items) {
      if (item.children) {
        item.open = false;
        this.closeAllSubmenus(item.children);
      }
    }
  }

  private closeOtherSubmenus(items: IMenuItem[], keep: IMenuItem) {
    if (!items) return;
    for (const item of items) {
      if (item.children) {
        if (item !== keep) {
          item.open = false;
        }
        this.closeOtherSubmenus(item.children, keep);
      }
    }
  }
}
