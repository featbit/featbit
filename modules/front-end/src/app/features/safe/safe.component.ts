import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { IAuthProps } from '@shared/types';
import { IMenuItem } from '@core/components/menu/menu';
import { getAuth } from '@shared/utils';
import {IdentityService} from "@services/identity.service";

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
    private identityService: IdentityService,
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
        title: $localize `:@@menu.FF:Feature flags`,
        icon: 'icons:icon-switch',
        path: '/feature-flags'
      },
      {
        title: $localize `:@@menu.archivedFF:Archived feature flags`,
        icon: 'icons:icon-switch-archive',
        path: '/switch-archive'
      },
      {
        title: $localize `:@@menu.users:Users`,
        icon: 'icons:icon-switch-user',
        path: '/users'
      },
      {
        title: $localize `:@@menu.segments:Segments`,
        icon: 'icons:icon-segment',
        path: '/segments'
      },
      {
        title: $localize `:@@menu.experiments:Experiments`,
        icon: 'icons:icon-expt',
        path: '/experiments'
      },
      {
        title: $localize `:@@menu.data-sync:Data sync`,
        icon: 'icons:icon-data-sync',
        path: '/data-sync'
      },
      {
        line: true
      },
      {
        title: $localize `:@@menu.organization:Organization`,
        icon: 'icons:icon-org',
        path: '/account-settings'
      },
      {
        title: $localize `:@@menu.iam:IAM`,
        icon: 'icons:icon-user-permission',
        path: '/iam/users',
        children: [
          {
            title: $localize `:@@menu.iam.team:Team`,
            icon: '',
            path: '/iam/users'
          },
          {
            title: $localize `:@@menu.iam.group:Groups`,
            icon: '',
            path: '/iam/groups'
          },
          {
            title: $localize `:@@menu.iam.policies:Policies`,
            icon: '',
            path: '/iam/policies'
          }
        ]
      }
    ];
  }


  public async logout() {
    await this.identityService.doLogoutUser();
  }
}
