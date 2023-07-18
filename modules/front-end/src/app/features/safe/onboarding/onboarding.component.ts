import { Component, OnInit } from '@angular/core';
import { IdentityService } from "@services/identity.service";
import { getCurrentOrganization } from "@utils/project-env";
import { Router } from "@angular/router";

@Component({
  selector: 'onboarding',
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.less']
})
export class OnboardingComponent implements OnInit {

  constructor(
    private identityService: IdentityService,
    private router: Router
  ) { }

  needOnboarding: boolean = false;
  async ngOnInit() {
    let organization = getCurrentOrganization();
    if (organization.initialized === false) {
      this.needOnboarding = true;
    } else {
      await this.router.navigateByUrl(`/feature-flags`);
    }
  }

  menuExtended: boolean = false;

  toggleMenu(extended: boolean) {
    this.menuExtended = extended;
  }

  logout() {
    this.identityService.doLogoutUser();
  }
}
