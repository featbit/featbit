import { Component, OnInit } from '@angular/core';
import { IProject, IEnvironment, IProjectEnv, ISecret, SecretTypeEnum } from '@shared/types';
import { ProjectService } from '@services/project.service';
import { OrganizationService } from '@services/organization.service';
import { EnvService } from '@services/env.service';
import { NzMessageService } from "ng-zorro-antd/message";
import { PermissionsService } from "@services/permissions.service";
import { MessageQueueService } from "@services/message-queue.service";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { EnvSecretService } from "@services/env-secret.service";
import { copyToClipboard } from '@utils/index';
import { ResourceTypeEnum, generalResourceRNPattern, permissionActions } from "@shared/policy";

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
  currentProjectEnv: IProjectEnv;

  projects: IProject[] = [];

  constructor(
    private fb: FormBuilder,
    private messageQueueService: MessageQueueService,
    private projectService: ProjectService,
    private accountService: OrganizationService,
    private envService: EnvService,
    private envSecretService: EnvSecretService,
    private messageService: NzMessageService,
    public permissionsService: PermissionsService
  ) {
  }

  ngOnInit(): void {
    const currentAccountProjectEnv = this.accountService.getCurrentOrganizationProjectEnv();
    this.currentProjectEnv = currentAccountProjectEnv.projectEnv;
    const canListProjects = this.permissionsService.isGranted(generalResourceRNPattern.project, permissionActions.ListProjects);
    if (canListProjects) {
      this.projectService
        .getList()
        .subscribe(projects => this.projects = projects);
    }
  }

  isCurrentProject(project: IProject): boolean {
    return this.currentProjectEnv?.projectId === project.id;
  }

  isCurrentEnv(env: IEnvironment): boolean {
    return this.currentProjectEnv?.envId === env.id;
  }

  onCreateProjectClick() {
    this.project = undefined;
    this.creatEditProjectFormVisible = true;
  }

  onCreateEnvClick(project: IProject) {
    this.project = project;
    this.env = {projectId: project.id} as IEnvironment;
    this.creatEditEnvFormVisible = true;
  }

  onEditProjectClick(project: IProject) {
    this.project = project;
    this.creatEditProjectFormVisible = true;
  }

  getEnvRN(project: IProject, env: Partial<IEnvironment>): string {
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
    const canDelete = this.permissionsService.isGranted(this.getEnvRN(project, env), permissionActions.DeleteEnv);
    if (!canDelete) {
      this.messageService.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.envService.removeEnv(project.id, env.id).subscribe(() => {
      project.environments = project.environments.filter(e => e.id !== env.id);
      this.messageService.success($localize`:@@org.project.env-remove-success:Environment successfully removed`);
      // emit project list change event
      this.messageQueueService.emit(this.messageQueueService.topics.PROJECT_LIST_CHANGED);
    })
  }

  onDeleteProjectClick(project: IProject) {
    const canDelete = this.permissionsService.isGranted(this.permissionsService.getResourceRN(ResourceTypeEnum.Project, project), permissionActions.DeleteProject);
    if (!canDelete) {
      this.messageService.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.projectService.delete(project.id).subscribe(() => {
      // remove the deleted project from list
      this.projects = this.projects.filter(item => item.id !== project.id);
      this.messageService.success($localize`:@@org.project.project-remove-success:Project successfully removed`);
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

    if (!data) {
      return;
    }

    if (data.isEditing) {
      this.project.environments = this.project.environments.map(e => e.id === data.env.id ? {...e, ...data.env} : e);
      this.env = {...this.env, ...data.env};
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
    copyToClipboard(text).then(
      () => this.messageService.success($localize`:@@common.copy-success:Copied`)
    );
  }

  // env secrets
  secretTypeClient = SecretTypeEnum.Client;
  secretTypeServer = SecretTypeEnum.Server;
  isSecretModalVisible: boolean = false;
  secretForm: FormGroup;
  secretModalTitle: string;
  isEditingSecret = false;
  currentSecretId: string;

  createSecret(project: IProject, env: IEnvironment) {
    const isAllowed = this.permissionsService.isGranted(`project/${project.name}:env/${env.name}`, permissionActions.CreateEnvSecret);
    if (!isAllowed) {
      this.messageService.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.project = project;
    this.env = env;
    this.isEditingSecret = false;

    this.secretModalTitle = $localize`:@@org.project.add-secret:Add secret`;
    this.secretForm = this.fb.group({
      name: [null, Validators.required],
      type: [SecretTypeEnum.Client, Validators.required]
    });
    this.isSecretModalVisible = true;
  }

  editSecret(project: IProject, env: IEnvironment, secret: ISecret) {
    const isAllowed = this.permissionsService.isGranted(`project/${project.name}:env/${env.name}`, permissionActions.UpdateEnvSecret);
    if (!isAllowed) {
      this.messageService.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.project = project;
    this.env = env;
    this.currentSecretId = secret.id;
    this.isEditingSecret = true;

    this.secretForm = this.fb.group({
      name: [secret.name, Validators.required],
      type: [secret.type, Validators.required]
    });

    this.secretModalTitle = $localize`:@@org.project.edit-secret:Edit secret: ${secret.name}`;
    this.isSecretModalVisible = true;
  }

  secretModalCancel() {
    this.project = null;
    this.env = null;
    this.isSecretModalVisible = false;
    this.secretForm.reset();
  }

  deleteSecret(project: IProject, env: IEnvironment, secretId: string) {
    const isAllowed = this.permissionsService.isGranted(`project/${project.name}:env/${env.name}`, permissionActions.DeleteEnvSecret);
    if (!isAllowed) {
      this.messageService.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.envSecretService.delete(env.id, secretId).subscribe({
      next: () => {
        env.secrets = env.secrets.filter((secret) => secret.id !== secretId);
      },
      error: () => {
        this.messageService.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`);
      }
    });
  }

  upsertSecret() {
    if (this.secretForm.invalid) {
      for (const i in this.secretForm.controls) {
        this.secretForm.controls[i].markAsDirty();
        this.secretForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    const {name, type} = this.secretForm.value;
    if (this.isEditingSecret) {
      const isAllowed = this.permissionsService.isGranted(`project/${this.project.name}:env/${this.env.name}`, permissionActions.UpdateEnvSecret);
      if (!isAllowed) {
        this.messageService.warning(this.permissionsService.genericDenyMessage);
        return;
      }

      this.envSecretService.update(this.env.id, this.currentSecretId, name).subscribe({
        next: () => {
          this.env.secrets = this.env.secrets.map((secret) => {
            if (secret.id === this.currentSecretId) {
              return {...secret, name};
            }

            return secret;
          });
          this.isSecretModalVisible = false;
        },
        error: () => {
          this.messageService.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`);
        }
      });
    } else {
      const isAllowed = this.permissionsService.isGranted(`project/${this.project.name}:env/${this.env.name}`, permissionActions.CreateEnvSecret);
      if (!isAllowed) {
        this.messageService.warning(this.permissionsService.genericDenyMessage);
        return;
      }

      this.envSecretService.add(this.env.id, name, type).subscribe({
        next: (secret: ISecret) => {
          this.env.secrets = [...this.env.secrets, secret];
          this.isSecretModalVisible = false;
        },
        error: () => {
          this.messageService.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`);
        }
      });
    }
  }
}
