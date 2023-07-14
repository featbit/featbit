import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { getAuth } from '@shared/utils';
import { CURRENT_PROJECT, LOGIN_REDIRECT_URL } from "@shared/utils/localstorage-keys";
import { PermissionsService } from "@services/permissions.service";
import { ProjectService } from "@services/project.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { getCurrentOrganization, getCurrentProjectEnv } from "@utils/project-env";
import { permissionActions } from "@shared/policy";
import { IEnvironment, IProject } from "@shared/types";
import { IdentityService } from "@services/identity.service";
import { NzNotificationService } from "ng-zorro-antd/notification";

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private router: Router,
    private message: NzMessageService,
    private projectService: ProjectService,
    private permissionsService: PermissionsService,
    private identityService: IdentityService,
    private notification: NzNotificationService,
    private permissionService: PermissionsService
  ) { }

  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    const auth = getAuth();
    const url = state.url;

    // if no auth token, redirect to login page
    if (!auth) {
      localStorage.setItem(LOGIN_REDIRECT_URL, url);
      return this.router.parseUrl('/login');
    }

    // init user permission
    await this.permissionService.initUserPolicies(auth.id);

    // if we're in onboarding page
    if (url.startsWith("/onboarding")) {
      return true;
    }

    // if organization hasn't initialized
    const organization = getCurrentOrganization();
    if (organization.initialized === false) {
      return this.router.parseUrl('/onboarding');
    }

    // try to set user accessible project and env
    const success = await this.trySetAccessibleProjectEnv();
    if (!success) {
      this.showDenyMessage();
      this.identityService.doLogoutUser(false);
      return false;
    }

    return true;
  }

  private async trySetAccessibleProjectEnv(): Promise<boolean> {
    const projects = await this.projectService.getListAsync();

    let project: IProject;
    let env: IEnvironment;
    let canAccessEnv: boolean = false;

    const localProjectEnv = getCurrentProjectEnv();
    if (localProjectEnv) {
      project = projects.find(pro => pro.id === localProjectEnv.projectId);
      env = project.environments.find(env => env.id === localProjectEnv.envId);
      canAccessEnv = this.permissionsService.isGranted(`project/${project.name}:env/${env.name}`, permissionActions.AccessEnvs);
    } else {
      for (const p of projects) {
        env = p.environments.find((e) => this.permissionsService.isGranted(`project/${p.name}:env/${e.name}`, permissionActions.AccessEnvs));
        if (env) {
          project = p;
          canAccessEnv = true;
          break;
        }
      }
    }

    // set project env if it's accessible
    if (canAccessEnv) {
      this.setProjectEnv(project, env);
    }

    return canAccessEnv;
  }

  private showDenyMessage() {
    let title = $localize`:@@permissions.permission-denied:Permission Denied`;
    let message = $localize`:@@permissions.need-permissions-to-access-env:You don't have permissions to access any projects and environments, please contact the admin to grant you the necessary permissions`;

    this.notification.remove();
    this.notification.warning(title, message, { nzDuration: 0 });
  }

  private setProjectEnv(project: IProject, env: IEnvironment) {
    const projectEnv = {
      projectId: project.id,
      projectName: project.name,
      envId: env.id,
      envKey: env.key,
      envName: env.name,
      envSecret: env.secrets[0].value
    };

    localStorage.setItem(CURRENT_PROJECT(), JSON.stringify(projectEnv));
  }
}
