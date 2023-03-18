import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { IAuthProps } from '@shared/types';
import { IMenuItem } from '@core/components/menu/menu';
import { getAuth } from '@shared/utils';
import { IdentityService } from "@services/identity.service";
import { MessageQueueService } from "@services/message-queue.service";

@Component({
  selector: 'app-safe',
  templateUrl: './safe.component.html',
  styleUrls: ['./safe.component.less']
})
export class SafeComponent implements OnInit, OnDestroy {

  public menus: IMenuItem[] = [];
  public auth: IAuthProps;
  public menuExtended: boolean = true;
  public isGuideVisible = false;

  private destory$: Subject<void> = new Subject();

  constructor(
    private identityService: IdentityService,
    private messageQueueService: MessageQueueService
  ) {
    this.setMenus();
  }

  ngOnInit(): void {
    this.auth = getAuth();

    this.messageQueueService.subscribe(this.messageQueueService.topics.QUICK_START_GUIDE_ONCLICK, () => {
      this.isGuideVisible = true;
    });
  }

  ngOnDestroy(): void {
    this.destory$.next();
    this.destory$.complete();
  }

  toggleMenu(extended: boolean) {
    this.menuExtended = extended;
  }

  onCompleteModalClose() {
    this.isGuideVisible = true;
  }

  private setMenus(): void {
    this.menus = [
      {
        title: $localize `:@@menu.FF:Feature flags`,
        icon: 'icons:icon-switch',
        path: '/feature-flags'
      },
      {
        title: $localize `:@@menu.end-users:End users`,
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
        title: $localize `:@@auditlogs.audit-logs:Audit logs`,
        icon: 'audit',
        path: '/audit-logs'
      },
      {
        line: true
      },
      {
        title: $localize `:@@menu.organization:Organization`,
        icon: 'icons:icon-org',
        path: '/organizations'
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
            title: $localize `:@@menu.integrations.access-tokens:Access tokens`,
            icon: '',
            path: '/integrations/access-tokens'
          }
        ]
      }
    ];
  }

  public async logout() {
    await this.identityService.doLogoutUser();
  }

  onGuideDrawerClosed(){
    this.isGuideVisible = false;
  }
}
