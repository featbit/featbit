import { Component, Input, OnInit } from '@angular/core';
import {
  IProfile,
  IOrganization,
  IProject,
  IEnvironment,
  IProjectEnv,
  SecretTypeEnum,
  License
} from '@shared/types';
import { ProjectService } from '@services/project.service';
import { Router } from '@angular/router';
import { Breadcrumb, BreadcrumbService } from '@services/bread-crumb.service';
import { NzMessageService } from "ng-zorro-antd/message";
import { MessageQueueService } from "@services/message-queue.service";
import { Observable } from "rxjs";
import { copyToClipboard } from '@utils/index';
import { EnvService } from '@core/services/env.service';
import { getCurrentLicense, getCurrentOrganization, getCurrentProjectEnv } from "@utils/project-env";

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less']
})
export class HeaderComponent implements OnInit {

  @Input() profile: IProfile;

  protected readonly SecretTypeEnum = SecretTypeEnum;

  currentProjectEnv: IProjectEnv;
  currentOrganization: IOrganization;
  license: License;

  allProjects: IProject[] = [];
  selectedProject: IProject;
  selectedEnv: IEnvironment;
  envModalVisible: boolean = false;

  breadcrumbs$: Observable<Breadcrumb[]>;

  flags = {};

  env: IEnvironment;

  constructor(
    private router: Router,
    private projectService: ProjectService,
    private message: NzMessageService,
    private breadcrumbService: BreadcrumbService,
    private messageQueueService: MessageQueueService,
    private envService: EnvService
  ) {
    this.breadcrumbs$ = breadcrumbService.breadcrumbs$;
  }

  async ngOnInit() {
    this.setSelectedProjectEnv();
    await this.setAllProjects();

    this.messageQueueService.subscribe(this.messageQueueService.topics.PROJECT_LIST_CHANGED, async () => {
      await this.setAllProjects();
      this.setSelectedProjectEnv();
    });

    this.messageQueueService.subscribe(this.messageQueueService.topics.CURRENT_ORG_PROJECT_ENV_CHANGED, () => {
      this.setSelectedProjectEnv();
    });

    this.messageQueueService.subscribe(this.messageQueueService.topics.CURRENT_ENV_SECRETS_CHANGED, () => {
      this.setCurrentEnv();
    });
  }

  isCurrentProject(project: IProject): boolean {
    return this.currentProjectEnv?.projectId === project.id;
  }

  isCurrentEnv(env: IEnvironment): boolean {
    return this.currentProjectEnv?.envId === env.id;
  }

  get availableProjects() {
    return this.allProjects;
  }

  get availableEnvs() {
    const project = this.allProjects.find(x => x.id === this.selectedProject.id);
    if (!project) {
      return [];
    }

    return project.environments;
  }

  envModelCancel() {
    this.envModalVisible = false;
  }

  async envModalConfirm() {
    const projectEnv = {
      projectId: this.selectedProject.id,
      projectName: this.selectedProject.name,
      projectKey: this.selectedProject.key,
      envId: this.selectedEnv.id,
      envKey: this.selectedEnv.key,
      envName: this.selectedEnv.name,
      envSecrets: this.selectedEnv.secrets
    };

    this.projectService.upsertCurrentProjectEnvLocally(projectEnv);
    this.currentProjectEnv = projectEnv;
    this.envModalVisible = false;

    if (this.router.url.indexOf("/feature-flags") > -1) {
      await this.router.navigateByUrl("/feature-flags");
    }

    setTimeout(() => window.location.reload(), 200);
  }

  private setCurrentEnv() {
    this.envService.getEnv(this.currentProjectEnv.projectId, this.currentProjectEnv.envId).subscribe({
      next: env => {
        this.env = env;
      },
      error: () => {
        this.message.error($localize`:@@common.error-occurred-try-again:Error occurred, please try again`);
      }
    });
  }

  onSelectProject(project: IProject) {
    this.selectedProject = project;
    this.selectedEnv = project.environments.length > 0 ? project.environments[0] : null;
  }

  onSelectEnv(env: IEnvironment) {
    this.selectedEnv = env;
  }

  private setSelectedProjectEnv() {
    this.currentOrganization = getCurrentOrganization();
    this.currentProjectEnv = getCurrentProjectEnv();
    this.license = getCurrentLicense();

    this.setCurrentEnv();

    this.selectedProject = {
      id: this.currentProjectEnv.projectId,
      name: this.currentProjectEnv.projectName
    } as IProject;

    this.selectedEnv = {
      id: this.currentProjectEnv.envId,
      name: this.currentProjectEnv.envName
    } as IEnvironment;
  }

  private async setAllProjects() {
    this.allProjects = await this.projectService.getListAsync();
  }

  // copy environment key
  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }
}
