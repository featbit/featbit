import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { getAuth } from '@shared/utils';
import { GET_STARTED, LOGIN_REDIRECT_URL } from "@shared/utils/localstorage-keys";
import { OrganizationService } from '@services/organization.service';
import {PermissionsService} from "@services/permissions.service";

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private router: Router,
    private accountService: OrganizationService,
    private permissionsService: PermissionsService
  ) { }

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    return await this.checkLogin(state.url);
  }

  async checkLogin(url: string): Promise<true | UrlTree> {
    const auth = getAuth();
    if (auth) {
      await this.permissionsService.fetchPolicies(auth.id);

      // check if organization is initialized
      if (!url.startsWith("/onboarding")) {
        const orgProj = this.accountService.getCurrentOrganizationProjectEnv();
        if (orgProj.organization?.initialized === false) {
          return this.router.parseUrl('/onboarding');
        }
      }

      return true;
    }

    localStorage.setItem(LOGIN_REDIRECT_URL, url);
    return this.router.parseUrl('/login');
  }
}
