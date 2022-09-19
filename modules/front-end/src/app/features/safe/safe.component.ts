import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { IAuthProps } from '@shared/types';
import { IMenuItem } from '@core/components/menu/menu';
import { getAuth } from '@shared/utils';
import { UserService } from "@services/user.service";

@Component({
  selector: 'app-safe',
  templateUrl: './safe.component.html',
  styleUrls: ['./safe.component.less']
})
export class SafeComponent implements OnInit, OnDestroy {

  public menus: IMenuItem[] = [];
  public auth: IAuthProps;
  public menuExtended: boolean = true;

  private destory$: Subject<void> = new Subject();

  constructor(
    private userService: UserService,
  ) {
    this.setMenus();
  }

  ngOnInit(): void {
    this.auth = getAuth();
  }

  ngOnDestroy(): void {
    this.destory$.next();
    this.destory$.complete();
  }

  toggleMenu(extended: boolean) {
    this.menuExtended = extended;
  }

  private setMenus(): void {
    this.menus = [
      {
        title: $localize `Feature flags`,
        icon: 'icons:icon-switch',
        path: '/switch-manage'
      },
      {
        title: $localize `Archived feature flags`,
        icon: 'icons:icon-switch-archive',
        path: '/switch-archive'
      },
      {
        title: $localize `Users`,
        icon: 'icons:icon-switch-user',
        path: '/switch-user'
      },
      {
        title: $localize `Segments`,
        icon: 'icons:icon-segment',
        path: '/segments'
      },
      {
        title: $localize `Experiments`,
        icon: 'icons:icon-expt',
        path: '/experiments'
      },
      {
        title: $localize `:@@data-sync:Data sync`,
        icon: 'icons:icon-data-sync',
        path: '/data-sync'
      },
      {
        line: true
      },
      {
        title: $localize `Orgnization`,
        icon: 'icons:icon-org',
        path: '/account-settings'
      },
      {
        title: $localize `IAM`,
        icon: 'icons:icon-user-permission',
        path: '/iam/users',
        children: [
          {
            title: $localize `Team`,
            icon: '',
            path: '/iam/users'
          },
          {
            title: $localize `Group`,
            icon: '',
            path: '/iam/groups'
          },
          {
            title: $localize `Policies`,
            icon: '',
            path: '/iam/policies'
          }
        ]
      }
    ];
  }


  public async logout() {
    await this.userService.doLogoutUser();
  }
}
