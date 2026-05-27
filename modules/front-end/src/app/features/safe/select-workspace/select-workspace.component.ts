import { Component } from '@angular/core';
import { IdentityService } from "@services/identity.service";
import { IProfile, IOrganization, IWorkspace } from "@shared/types";
import { OrganizationService } from "@services/organization.service";
import { WorkspaceService } from "@services/workspace.service";
import { Router } from "@angular/router";
import { IS_SSO_FIRST_LOGIN, LOGIN_REDIRECT_URL } from "@utils/localstorage-keys";
import { getProfile } from "@utils/index";
import { UserService } from "@services/user.service";

@Component({
    selector: 'select-workspace',
    templateUrl: './select-workspace.component.html',
    styleUrls: ['./select-workspace.component.less'],
    standalone: false
})
export class SelectWorkspaceComponent {

  menuExtended: boolean = false;
  workspaces: IWorkspace[] = [];
  organizations: IOrganization[] = [];
  selectedWorkspace: IWorkspace | null = null;
  profile: IProfile = null;
  isLoading: boolean = false;
  isLoadingOrgs: boolean = false;
  currentStep: 'workspace' | 'organization' = 'workspace';

  constructor(
    private router: Router,
    private organizationService: OrganizationService,
    private workspaceService: WorkspaceService,
    private identityService: IdentityService,
    private userService: UserService) {
    this.workspaces = userService.workspaces;
    this.profile = getProfile();

    if (this.workspaces.length === 1) {
      // Workspace already set by auth guard — load orgs that were fetched by the guard
      this.selectedWorkspace = this.workspaces[0];
      this.organizations = organizationService.organizations;
      this.currentStep = 'organization';
      if (this.organizations.length === 1) {
        this.setOrganization(this.organizations[0]);
      }
    }
    // If workspaces.length > 1, currentStep stays on 'workspace' for user to choose
  }

  async selectWorkspace(workspace: IWorkspace) {
    this.selectedWorkspace = workspace;
    this.isLoadingOrgs = true;
    this.currentStep = 'organization';
    this.workspaceService.setWorkspace(workspace);

    try {
      const isSsoFirstLogin = localStorage.getItem(IS_SSO_FIRST_LOGIN) === 'true';
      const orgs = await this.organizationService.getListAsync(isSsoFirstLogin);
      this.organizations = orgs || [];
      this.organizationService.organizations = this.organizations;

      if (this.organizations.length === 1) {
        this.setOrganization(this.organizations[0]);
      }
    } catch {
      this.organizations = [];
    } finally {
      this.isLoadingOrgs = false;
    }
  }

  backToWorkspaceSelection() {
    this.currentStep = 'workspace';
    this.organizations = [];
    this.selectedWorkspace = null;
  }

  setOrganization(organization: IOrganization) {
    this.isLoading = true;
    this.organizationService.switchOrganization(organization);
    localStorage.removeItem(IS_SSO_FIRST_LOGIN);
    const redirectUrl = localStorage.getItem(LOGIN_REDIRECT_URL);
    if (redirectUrl) {
      localStorage.removeItem(LOGIN_REDIRECT_URL);
      this.router.navigateByUrl(redirectUrl).then(() => this.isLoading = false);
    } else {
      this.router.navigateByUrl(`/`).then(() => this.isLoading = false);
    }
  }

  toggleMenu(extended: boolean) {
    this.menuExtended = extended;
  }

  async logout() {
    await this.identityService.doLogoutUser();
  }
}
