import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { getProfile } from '@shared/utils';
import {
  CURRENT_ORGANIZATION,
  IS_SSO_FIRST_LOGIN,
  LOGIN_REDIRECT_URL
} from "@shared/utils/localstorage-keys";
import { PermissionsService } from "@services/permissions.service";
import { ProjectService } from "@services/project.service";
import { getCurrentProjectEnv } from "@utils/project-env";
import { IEnvironment, IOrganization, IProject, IProjectEnv } from "@shared/types";
import { IdentityService } from "@services/identity.service";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { OrganizationService } from "@services/organization.service";
import { WorkspaceService } from "@services/workspace.service";

export const authGuard = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
  router = inject(Router),
  permissionService = inject(PermissionsService),
  projectService = inject(ProjectService),
  workspaceService = inject(WorkspaceService),
  organizationService = inject(OrganizationService),
  identityService = inject(IdentityService),
  notification = inject(NzNotificationService)
) => {
  const profile = getProfile();
  const url = state.url;

  // if no auth token or workspaceId, redirect to login page
  if (!profile || !profile.workspaceId) {
    localStorage.setItem(LOGIN_REDIRECT_URL, url);
    return router.parseUrl('/login');
  }

  // if workspaceId is invalid, logout user
  const workspace = await workspaceService.getWorkspace();
  if (!workspace) {
    identityService.doLogoutUser(false);
    return router.parseUrl('/login');
  }

  workspaceService.setWorkspace(workspace);
  const isSsoFirstLogin = localStorage.getItem(IS_SSO_FIRST_LOGIN) === 'true';
  const organizations = await organizationService.getListAsync(isSsoFirstLogin);
  organizationService.organizations = organizations;

  if (url.startsWith("/select-organization")) {
    return true;
  }

  // if no available organization, redirect to select org page
  if (organizations.length === 0) {
    return router.parseUrl('/select-organization');
  }

  // if no current org, redirect to select org page
  const orgStr = localStorage.getItem(CURRENT_ORGANIZATION());
  let organization: IOrganization = orgStr ? JSON.parse(orgStr) : null;
  if (!orgStr) {
    localStorage.setItem(LOGIN_REDIRECT_URL, url);
    return router.parseUrl('/select-organization');
  }

  organization = organizations.find(org => org.id === organization.id) || organizations[0];
  organizationService.setOrganization(organization);

  // init user permission
  await permissionService.initUserPolicies(profile.id);

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

  // try to set the user-accessible project and env
  const success = await trySetAccessibleProjectEnv(projectService);
  if (!success) {
    showDenyMessage(notification);
    identityService.doLogoutUser(false);
    return false;
  }

  return true;
}

const setProjectEnv = (projectService: ProjectService, project: IProject, env: IEnvironment) => {
  const projectEnv: IProjectEnv = {
    projectId: project.id,
    projectKey: project.key,
    projectName: project.name,
    envId: env.id,
    envKey: env.key,
    envName: env.name,
    envSecrets: env.secrets
  };

  projectService.upsertCurrentProjectEnvLocally(projectEnv);
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
    setProjectEnv(projectService, project, env);
  }

  return canAccessEnv;
}
