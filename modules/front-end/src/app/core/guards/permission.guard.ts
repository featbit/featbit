import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { getAuth } from '@shared/utils';
import { LOGIN_REDIRECT_URL } from "@shared/utils/localstorage-keys";
import { AccountService } from '@core/services/account.service';

@Injectable({
  providedIn: 'root'
})
export class PermissionGuard implements CanActivate {

  constructor(
    private router: Router,
    private accountService: AccountService
  ) { }

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    return await this.checkLogin(state.url);
  }

  async checkLogin(url: string): Promise<true | UrlTree> {
    const auth = getAuth();
    if (auth) {
      // check if account is initialized
      if (!url.startsWith("/initialization")) {
        const accountProj = this.accountService.getCurrentAccountProjectEnv();
        if (accountProj.account?.initialized === false) {
          return this.router.parseUrl('/initialization');
        }
      }

      return true;
    }

    localStorage.setItem(LOGIN_REDIRECT_URL, url);
    return this.router.parseUrl('/login');
  }
}
