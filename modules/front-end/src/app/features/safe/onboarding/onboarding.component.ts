import { Component } from '@angular/core';
import { IdentityService } from "@services/identity.service";

@Component({
  selector: 'onboarding',
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.less']
})
export class OnboardingComponent {

  constructor(private identityService: IdentityService) { }

  menuExtended: boolean = false;

  toggleMenu(extended: boolean) {
    this.menuExtended = extended;
  }

  logout() {
    this.identityService.doLogoutUser();
  }
}
