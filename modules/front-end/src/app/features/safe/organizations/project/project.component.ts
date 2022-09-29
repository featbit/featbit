import { Component, OnInit} from '@angular/core';
import { IProject, IEnvironment, IProjectEnv } from '@shared/types';
import { ProjectService } from '@services/project.service';
import { OrganizationService } from '@services/organization.service';
import { EnvService } from '@services/env.service';
import { NzMessageService } from "ng-zorro-antd/message";
import {PermissionsService} from "@services/permissions.service";
import {generalResourceRNPattern, permissionActions} from "@shared/permissions";
import {ResourceTypeEnum} from "@features/safe/iam/components/policy-editor/types";
import {MessageQueueService} from "@services/message-queue.service";

@Component({
  selector: 'app-project',
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.less']
})
export class ProjectComponent implements OnInit {

  generalResourceRNPattern = generalResourceRNPattern;
  permissionActions = permissionActions;

  creatEditProjectFormVisible: boolean = false;
  creatEditEnvFormVisible: boolean = false;

  // the project being deleting or editing
  project: IProject;
  env: IEnvironment;

  searchValue: string;

  // current project env
  currentOrganizationId: number;
  currentProjectEnv: IProjectEnv;

  projects: IProject[] = [];

  constructor(
    private messageQueueService: MessageQueueService,
    private projectService: ProjectService,
    private accountService: OrganizationService,
    private envService: EnvService,
    private messageService: NzMessageService,
    public permissionsService: PermissionsService
  ) {}

  ngOnInit(): void {
    const currentAccountProjectEnv = this.accountService.getCurrentOrganizationProjectEnv();
    this.currentOrganizationId = currentAccountProjectEnv.organization.id;
    this.currentProjectEnv = currentAccountProjectEnv.projectEnv;
    const canListProjects = this.permissionsService.canTakeAction(generalResourceRNPattern.project, permissionActions.ListProjects);
    if (canListProjects) {
      this.projectService
        .getProjects(this.currentOrganizationId)
        .subscribe(projects => this.projects = projects);
    }
  }

  isEnvDeleteBtnVisible(env: IEnvironment): boolean {
    return this.currentProjectEnv?.envId !== env.id;
  }

  onCreateProjectClick() {
    this.project = undefined;
    this.creatEditProjectFormVisible = true;
  }

  onCreateEnvClick(project: IProject) {
    this.project = project;
    this.env = { projectId: project.id } as IEnvironment;
    this.creatEditEnvFormVisible = true;
  }

  onEditProjectClick(project: IProject) {
    this.project = project;
    this.creatEditProjectFormVisible = true;
  }

  getEnvRN(project: IProject, env: IEnvironment): string {
    if (!project || !env) {
      return '';
    }

    return `project/${project.name}:env/${env.name}`;
  }

  onEditEnvClick(project: IProject, env: IEnvironment) {
    this.project = project;
    this.env = env;
    this.creatEditEnvFormVisible = true;
  }

  onDeleteEnvClick(project: IProject, env: IEnvironment) {
    const canDelete = this.permissionsService.canTakeAction(this.getEnvRN(project, env), permissionActions.DeleteEnv);
    if (!canDelete) {
      this.messageService.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.envService.removeEnv(project.id, env.id).subscribe(() => {
      project.environments = project.environments.filter(e => e.id !== env.id);
      this.messageService.success($localize `:@@org.project.env-remove-success:Environment successfully removed`);
      // emit project list change event
      this.messageQueueService.emit(this.messageQueueService.topics.PROJECT_LIST_CHANGED);
    })
  }

  onDeleteProjectClick(project: IProject) {
    const canDelete = this.permissionsService.canTakeAction(this.permissionsService.getResourceRN(ResourceTypeEnum.Project, project), permissionActions.DeleteProject);
    if (!canDelete) {
     this.messageService.warning(this.permissionsService.genericDenyMessage);
     return;
    }

    this.projectService.removeProject(this.currentOrganizationId, project.id).subscribe(() => {
      // remove the deleted project from list
      this.projects = this.projects.filter(item => item.id !== project.id);
      this.messageService.success($localize `:@@org.project.project-remove-success:Project successfully removed`);
      // emit project list change event
      this.messageQueueService.emit(this.messageQueueService.topics.PROJECT_LIST_CHANGED);
    });
  }

  projectClosed(data: any) {
    this.creatEditProjectFormVisible = false;

    // close after edit project name
    if (data.isEditing) {
      const newName = data.project.name;

      const oldProject = this.projects.find(item => item.id == data.project.id);
      oldProject.name = newName;

      // if is editing current project
      if (this.currentProjectEnv.projectId == this.project.id) {
        this.currentProjectEnv.projectName = newName;
        this.projectService.upsertCurrentProjectEnvLocally(this.currentProjectEnv);
      }
    }

    // close after create project
    else if (data.project) {
      // put the newly created project at the first place
      this.projects.unshift(data.project);
    }

    // emit project list change event
    this.messageQueueService.emit(this.messageQueueService.topics.PROJECT_LIST_CHANGED);
  }

  envClosed(data: any) {
    this.creatEditEnvFormVisible = false;

    if (data.isEditing) {
      this.project.environments = this.project.environments.map(e => e.id === data.env.id ? { ...e, ...data.env } : e);
      this.env = { ...this.env, ...data.env };
    } else {
      this.project.environments.push(data.env);
    }

    // if is editing current env
    if (data.isEditing && this.currentProjectEnv.envId == this.env.id) {
      this.currentProjectEnv.envName = data.env.name;
      this.projectService.upsertCurrentProjectEnvLocally(this.currentProjectEnv);
    }

    // emit project list change event
    this.messageQueueService.emit(this.messageQueueService.topics.PROJECT_LIST_CHANGED);
  }

  copyText(text: string) {
    navigator.clipboard.writeText(text).then(
      () => this.messageService.success($localize `:@@common.copy-success:Copied`)
    );
  }
}
