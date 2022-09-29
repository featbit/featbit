import { Component, Input, OnInit } from '@angular/core';
import { IAuthProps, IOrganization, IProject, IEnvironment, IProjectEnv } from '@shared/types';
import { OrganizationService } from '@services/organization.service';
import { ProjectService } from '@services/project.service';
import { Router } from '@angular/router';
import { Breadcrumb, BreadcrumbService } from '@services/bread-crumb.service';
import {PermissionsService} from "@services/permissions.service";
import {generalResourceRNPattern, permissionActions} from "@shared/permissions";
import {NzMessageService} from "ng-zorro-antd/message";

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less']
})
export class HeaderComponent implements OnInit {

  @Input() auth: IAuthProps;

  cannotReadProjectsMsg: string;
  cannotReadEnvsMsg: string;
  currentProjectEnv: IProjectEnv;
  currentAccount: IOrganization;

  allProjects: IProject[];
  selectedProject: IProject;
  selectedEnv: IEnvironment;
  envModalVisible: boolean = false;
  pageTitle = '';

  //breadcrumbs$: Observable<Breadcrumb[]>;

  flags = {};
  constructor(
    private router: Router,
    private accountService: OrganizationService,
    private projectService: ProjectService,
    private message: NzMessageService,
    private readonly breadcrumbService: BreadcrumbService,
    private permissionsService: PermissionsService
  ) {
    breadcrumbService.breadcrumbs$.subscribe((bc: Breadcrumb[]) => this.pageTitle = bc.at(-1)?.label);
    //this.breadcrumbs$ = breadcrumbService.breadcrumbs$;
  }

  ngOnInit(): void {
    this.canListProjects = this.permissionsService.canTakeAction(generalResourceRNPattern.project, permissionActions.ListProjects);
    this.canListEnvs = this.permissionsService.canTakeAction(generalResourceRNPattern.project, permissionActions.ListEnvs);

    this.cannotReadProjectsMsg = $localize `You don't have permissions to read project list, please contact the admin to grant you the necessary permissions`;
    this.cannotReadEnvsMsg = this.canListProjects ? $localize `You don't have permissions to read environment list, please contact the admin to grant you the necessary permissions` : $localize `You don't have permissions to read project and environment list, please contact the admin to grant you the necessary permissions`;
    this.selectCurrentProjectEnv();
    this.setAllProjects();

    this.projectService.projectListChanged$
      .subscribe(_ => {
        this.setAllProjects();
        this.selectCurrentProjectEnv();
      });

    this.projectService.currentProjectEnvChanged$
      .subscribe(_ => this.selectCurrentProjectEnv());
  }

  canListProjects = false;
  get availableProjects() {
    return this.canListProjects ? this.allProjects : [];
  }

  canListEnvs = false;
  get availableEnvs() {
    const project = this.allProjects.find(x => x.id === this.selectedProject.id);
    return this.canListEnvs ? project?.environments : [];
  }

  envModelCancel() {
    this.envModalVisible = false;
  }

  envModalConfirm() {
    const canAccessProjectEnvs = this.permissionsService.canTakeAction(`project/${this.selectedProject.name}`, permissionActions.AccessEnvs);
    const canAccessEnv = this.permissionsService.canTakeAction(`project/${this.selectedProject.name}:env/${this.selectedEnv.name}`, permissionActions.AccessEnvs);

    if (
      (canAccessProjectEnvs === undefined && canAccessEnv === undefined) ||
      canAccessProjectEnvs === false ||
      canAccessEnv === false) {
        this.message.warning(this.permissionsService.genericDenyMessage);
        return;
    }

    const projectEnv = {
      projectId: this.selectedProject.id,
      projectName: this.selectedProject.name,
      envId: this.selectedEnv.id,
      envName: this.selectedEnv.name,
      envSecret: this.selectedEnv.secret
    };

    this.projectService.upsertCurrentProjectEnvLocally(projectEnv);
    this.currentProjectEnv = projectEnv;
    this.envModalVisible = false;

    if (this.router.url.indexOf("/feature-flags") > -1) {
      this.router.navigateByUrl("/feature-flags");
    }

    setTimeout(() => window.location.reload(), 200);
  }

  onSelectProject(project: IProject) {
    this.selectedProject = project;
    this.canListEnvs = this.permissionsService.canTakeAction(this.permissionsService.getResourceRN('project', project), permissionActions.ListEnvs);
    this.selectedEnv = project.environments.length > 0 ? project.environments[0] : null;
  }

  onSelectEnv(env: IEnvironment) {
    this.selectedEnv = env;
  }

  private selectCurrentProjectEnv() {
    const currentAccountProjectEnv = this.accountService.getCurrentOrganizationProjectEnv();

    this.currentAccount = currentAccountProjectEnv.organization;
    this.currentProjectEnv = currentAccountProjectEnv.projectEnv;

    this.selectedProject = {
      id: this.currentProjectEnv.projectId,
      name: this.currentProjectEnv.projectName
    } as IProject;
    this.selectedEnv = {
      id: this.currentProjectEnv.envId,
      name: this.currentProjectEnv.envName
    } as IEnvironment;
  }

  private setAllProjects() {
    this.projectService.getProjects(this.currentAccount.id)
      .subscribe(projects => this.allProjects = projects);
  }
}
