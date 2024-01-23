import { Component, OnInit } from '@angular/core';
import { IProfile } from '@shared/types';
import { IMenuItem } from '@core/components/menu/menu';
import { getProfile } from '@shared/utils';
import { IdentityService } from "@services/identity.service";

@Component({
  selector: 'app-safe',
  templateUrl: './safe.component.html',
  styleUrls: ['./safe.component.less']
})
export class SafeComponent implements OnInit {

  public menus: IMenuItem[] = [];
  public profile: IProfile;
  public menuExtended: boolean = true;

  constructor(private identityService: IdentityService) {
    this.setMenus();
  }

  ngOnInit(): void {
    this.profile = getProfile();
  }

  toggleMenu(extended: boolean) {
    this.menuExtended = extended;
  }

  private setMenus(): void {
    this.menus = [
      {
        title: $localize `:@@menu.get-started:Get Started`,
        icon: 'icons:icon-get-started',
        path: '/get-started'
      },
      {
        title: $localize `:@@menu.FF:Feature Flags`,
        icon: 'icons:icon-switch',
        path: '/feature-flags'
      },
      {
        title: $localize `:@@menu.end-users:End Users`,
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
        title: $localize `:@@menu.data-sync:Data Sync`,
        icon: 'icons:icon-data-sync',
        path: '/data-sync'
      },
      {
        title: $localize `:@@auditlogs.audit-logs:Audit Logs`,
        icon: 'audit',
        path: '/audit-logs'
      },
      {
        line: true
      },
      {
        title: $localize `:@@menu.workspace:Workspace`,
        icon: 'bank',
        path: '/workspace'
      },
      {
        title: $localize `:@@menu.relay-proxies:Relay Proxies`,
        icon: 'icons:icon-relay-proxy',
        path: '/relay-proxies'
      },
      {
        title: $localize `:@@menu.iam:IAM`,
        icon: 'icons:icon-user-permission',
        path: '/iam/team',
        children: [
          {
            title: $localize `:@@menu.iam.team:Team`,
            icon: '',
            path: '/iam/team'
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
      },
      {
        title: $localize `:@@menu.integrations:Integrations`,
        icon: 'block',
        path: '/integrations/access-tokens',
        children: [
          {
            title: $localize`:@@menu.integrations.webhooks:Webhooks`,
            icon: '',
            path: '/integrations/webhooks'
          },
          {
            title: $localize `:@@menu.integrations.access-tokens:Access Tokens`,
            icon: '',
            path: '/integrations/access-tokens'
          }
        ]
      }
    ];
  }

  logout() {
    this.identityService.doLogoutUser();
  }
}
