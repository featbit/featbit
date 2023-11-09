import { Component } from '@angular/core';
import { IdentityService } from "@services/identity.service";
import { IAuthProps, IOrganization } from "@shared/types";
import { OrganizationService } from "@services/organization.service";
import { Router } from "@angular/router";
import { LOGIN_REDIRECT_URL } from "@utils/localstorage-keys";
import { getAuth } from "@utils/index";

@Component({
  selector: 'select-organization',
  templateUrl: './select-organization.component.html',
  styleUrls: ['./select-organization.component.less']
})
export class SelectOrganizationComponent {

  menuExtended: boolean = false;
  organizations: IOrganization[] = [];
  auth: IAuthProps = null;

  constructor(
    private router: Router,
    private organizationService: OrganizationService,
    private identityService: IdentityService)
  {
    this.organizations = organizationService.organizations;
    this.auth = getAuth();

    if (this.organizations.length === 1) {
      this.setOrganization(this.organizations[0]);
    }
  }

  async setOrganization(organization: any) {
    this.organizationService.switchOrganization(organization);

    const redirectUrl = localStorage.getItem(LOGIN_REDIRECT_URL);
    if (redirectUrl) {
      localStorage.removeItem(LOGIN_REDIRECT_URL);
      await this.router.navigateByUrl(redirectUrl);
    } else {
      await this.router.navigateByUrl(`/`);
    }
  }

  toggleMenu(extended: boolean) {
    this.menuExtended = extended;
  }

  logout() {
    this.identityService.doLogoutUser();
  }
}
