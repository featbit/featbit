import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { IdentityService } from "@services/identity.service";
import { IAuthProps } from "@shared/types";
import { getAuth } from "@utils/index";

@Component({
  selector: 'onboarding',
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.less']
})
export class OnboardingComponent implements OnInit, OnDestroy {
  public auth: IAuthProps;
  private destroy$: Subject<void> = new Subject();
  public menuExtended: boolean = false;

  toggleMenu(extended: boolean) {
    this.menuExtended = extended;
  }

  constructor(private identityService: IdentityService) { }

  ngOnInit(): void {
    this.auth = getAuth();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async logout() {
    await this.identityService.doLogoutUser();
  }
}
