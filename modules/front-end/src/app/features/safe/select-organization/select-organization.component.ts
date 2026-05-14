import { Component } from '@angular/core';
import { IdentityService } from "@services/identity.service";
import { IProfile, IOrganization } from "@shared/types";
import { OrganizationService } from "@services/organization.service";
import { Router } from "@angular/router";
import { IS_SSO_FIRST_LOGIN, LOGIN_REDIRECT_URL } from "@utils/localstorage-keys";
import { getProfile } from "@utils/index";
import { NzMessageService } from "ng-zorro-antd/message";
import { UserService } from "@services/user.service";

@Component({
    selector: 'select-organization',
    templateUrl: './select-organization.component.html',
    styleUrls: ['./select-organization.component.less'],
    standalone: false
})
export class SelectOrganizationComponent {

  menuExtended: boolean = false;
  organizations: IOrganization[] = [];
  profile: IProfile = null;
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private message: NzMessageService,
    private organizationService: OrganizationService,
    private identityService: IdentityService,
    private userService: UserService) {
    this.organizations = organizationService.organizations;
    this.profile = getProfile();

    if (this.organizations.length === 1) {
      this.setOrganization(this.organizations[0]);
    }
  }

  setOrganization(organization: any) {
    this.isLoading = true;
    this.organizationService.switchOrganization(organization);
    this.userService.joinOrganization().subscribe({
      next: () => {
        localStorage.removeItem(IS_SSO_FIRST_LOGIN);
        const redirectUrl = localStorage.getItem(LOGIN_REDIRECT_URL);
        if (redirectUrl) {
          localStorage.removeItem(LOGIN_REDIRECT_URL);
          this.router.navigateByUrl(redirectUrl).then(() => this.isLoading = false);
        } else {
          this.router.navigateByUrl(`/`).then(() => this.isLoading = false);
        }
      },
      error: _ => {
        this.message.error($localize`:@@common.error-happened-please-relogin:Error happened, please login again!`);
        this.isLoading = false;
      }
    });
  }

  toggleMenu(extended: boolean) {
    this.menuExtended = extended;
  }

  async logout() {
    await this.identityService.doLogoutUser();
  }
}
