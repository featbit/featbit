import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { getAuth } from '@shared/utils';
import { LOGIN_REDIRECT_URL } from "@shared/utils/localstorage-keys";
import { PermissionsService } from "@services/permissions.service";
import { ProjectService } from "@services/project.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { getCurrentOrganization } from "@utils/project-env";

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private router: Router,
    private message: NzMessageService,
    private projectService: ProjectService,
    private permissionsService: PermissionsService
  ) { }

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    return await this.checkLogin(state.url);
  }

  async checkLogin(url: string): Promise<boolean | UrlTree> {
    const auth = getAuth();
    if (auth) {
      await this.permissionsService.fetchPolicies(auth.id);

      // check if organization is initialized
      if (!url.startsWith("/onboarding")) {
        const currentProjectEnv = await this.projectService.setCurrentProjectEnv();
        if (currentProjectEnv) {
          const organization = getCurrentOrganization();
          if (organization.initialized === false) {
            return this.router.parseUrl('/onboarding');
          }
        } else {
          this.message.error($localize`:@@permissions.need-permissions-to-access-env:You don't have permissions to access any projects and environments, please contact the admin to grant you the necessary permissions`);
          return false;
        }
      }

      return true;
    }

    localStorage.setItem(LOGIN_REDIRECT_URL, url);
    return this.router.parseUrl('/login');
  }
}
