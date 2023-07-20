import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { getAuth } from '@shared/utils';
import { CURRENT_PROJECT, LOGIN_REDIRECT_URL } from "@shared/utils/localstorage-keys";
import { PermissionsService } from "@services/permissions.service";
import { ProjectService } from "@services/project.service";
import { getCurrentProjectEnv } from "@utils/project-env";
import { IEnvironment, IProject } from "@shared/types";
import { IdentityService } from "@services/identity.service";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { OrganizationService } from "@services/organization.service";

export const authGuard = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
  router = inject(Router),
  permissionService = inject(PermissionsService),
  projectService = inject(ProjectService),
  organizationService = inject(OrganizationService),
  identityService = inject(IdentityService),
  notification = inject(NzNotificationService)
) => {
  const auth = getAuth();
  const url = state.url;

  // if no auth token, redirect to login page
  if (!auth) {
    localStorage.setItem(LOGIN_REDIRECT_URL, url);
    return router.parseUrl('/login');
  }

  // set user organizations
  const organization = await organizationService.setUserOrganizations();

  // init user permission
  await permissionService.initUserPolicies(auth.id);

  // if we're going to onboarding page
  if (url.startsWith("/onboarding")) {
    if (organization.initialized === false) {
      return true;
    }

    // skip onboarding because organization already initialized
    return router.parseUrl('/feature-flags');
  }

  // if organization hasn't initialized
  if (organization.initialized === false) {
    return router.parseUrl('/onboarding');
  }

  // try to set user accessible project and env
  const success = await trySetAccessibleProjectEnv(projectService);
  if (!success) {
    showDenyMessage(notification);
    identityService.doLogoutUser(false);
    return false;
  }

  return true;
}

const setProjectEnv = (project: IProject, env: IEnvironment) => {
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

const showDenyMessage = (notification: NzNotificationService) => {
  let title = $localize`:@@permissions.permission-denied:Permission Denied`;
  let message = $localize`:@@permissions.need-permissions-to-access-env:You don't have permissions to access to the current environment or you don't have access to any projects and environments, please contact the admin to grant you the necessary permissions`;

  notification.remove();
  notification.warning(title, message, { nzDuration: 0 });
}

const trySetAccessibleProjectEnv = async (projectService: ProjectService): Promise<boolean> => {
  const projects = await projectService.getListAsync();

  let project: IProject;
  let env: IEnvironment;
  let canAccessEnv: boolean = false;

  const localProjectEnv = getCurrentProjectEnv();
  if (localProjectEnv) {
    project = projects.find(pro => pro.id === localProjectEnv.projectId);
    env = project?.environments?.find(env => env.id === localProjectEnv.envId);
  } else {
    project = projects[0];
    env = project?.environments[0];
  }

  if (env) {
    canAccessEnv = true;
  }

  // set project env if it's accessible
  if (canAccessEnv) {
    setProjectEnv(project, env);
  }

  return canAccessEnv;
}
