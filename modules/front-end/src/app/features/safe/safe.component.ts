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
    // 菜单 path 和 target 互斥，优先匹配 path

    this.menus = [
      {
        title: '开关管理',
        icon: 'icons:icon-switch',
        path: '/switch-manage'
      },
      {
        title: '开关存档',
        icon: 'icons:icon-switch-archive',
        path: '/switch-archive'
      },
      {
        title: '用户管理',
        icon: 'icons:icon-switch-user',
        path: '/switch-user'
      },
      {
        title: '用户组',
        icon: 'icons:icon-segment',
        path: '/segments'
      },
      {
        title: '数据实验',
        icon: 'icons:icon-expt',
        path: '/experiments'
      },
      {
        title: '数据同步',
        icon: 'icons:icon-data-sync',
        path: '/data-sync'
      },
      {
        line: true
      },
      {
        title: '组织机构',
        icon: 'icons:icon-org',
        path: '/account-settings'
      },
      {
        title: '权限管理',
        icon: 'icons:icon-user-permission',
        path: '/iam/users',
        children: [
          {
            title: '团队',
            icon: '',
            path: '/iam/users'
          },
          {
            title: '组',
            icon: '',
            path: '/iam/groups'
          },
          {
            title: '策略',
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
