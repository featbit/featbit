import { Component } from '@angular/core';
import { IdentityService } from "@services/identity.service";
import { IProfile, IOrganization } from "@shared/types";
import { OrganizationService } from "@services/organization.service";
import { Router } from "@angular/router";
import { IS_SSO_FIRST_LOGIN, LOGIN_REDIRECT_URL } from "@utils/localstorage-keys";
import { getProfile } from "@utils/index";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'select-organization',
  templateUrl: './select-organization.component.html',
  styleUrls: ['./select-organization.component.less']
})
export class SelectOrganizationComponent {

  menuExtended: boolean = false;
  organizations: IOrganization[] = [];
  profile: IProfile = null;

  constructor(
    private router: Router,
    private organizationService: OrganizationService,
    private message: NzMessageService,
    private identityService: IdentityService) {
    this.organizations = organizationService.organizations;
    this.profile = getProfile();

    if (this.organizations.length === 1) {
      this.setOrganization(this.organizations[0]);
    }
  }

  async setOrganization(organization: any) {
    this.organizationService.switchOrganization(organization);
    this.organizationService.addUser({ method: 'Email', email: this.profile.email, policyIds: [], groupIds: [] }).subscribe(
      async () => {
        localStorage.removeItem(IS_SSO_FIRST_LOGIN);
        const redirectUrl = localStorage.getItem(LOGIN_REDIRECT_URL);
        if (redirectUrl) {
          localStorage.removeItem(LOGIN_REDIRECT_URL);
          await this.router.navigateByUrl(redirectUrl);
        } else {
          await this.router.navigateByUrl(`/`);
        }
      },
      _ => {
        this.message.error($localize `:@@common.error-happened-please-relogin:Error happened, please login again!` );
      }
    )
  }

  toggleMenu(extended: boolean) {
    this.menuExtended = extended;
  }

  logout() {
    this.identityService.doLogoutUser();
  }
}
