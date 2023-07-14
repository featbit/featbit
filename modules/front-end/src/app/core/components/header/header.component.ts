import { Component, Input, OnInit } from '@angular/core';
import { IAuthProps, IOrganization, IProject, IEnvironment, IProjectEnv, SecretTypeEnum } from '@shared/types';
import { ProjectService } from '@services/project.service';
import { Router } from '@angular/router';
import { Breadcrumb, BreadcrumbService } from '@services/bread-crumb.service';
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { NzMessageService } from "ng-zorro-antd/message";
import { MessageQueueService } from "@services/message-queue.service";
import { Observable } from "rxjs";
import { copyToClipboard } from '@utils/index';
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { FeedbackService } from "@services/feedback.service";
import { EnvService } from '@core/services/env.service';
import { getCurrentOrganization, getCurrentProjectEnv } from "@utils/project-env";

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.less']
})
export class HeaderComponent implements OnInit {

  @Input() auth: IAuthProps;

  protected readonly SecretTypeEnum = SecretTypeEnum;

  cannotReadProjectsMsg: string;
  cannotReadEnvsMsg: string;
  currentProjectEnv: IProjectEnv;
  currentOrganization: IOrganization;

  allProjects: IProject[];
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
    private fb: FormBuilder,
    private feedbackService: FeedbackService,
    private readonly breadcrumbService: BreadcrumbService,
    private permissionsService: PermissionsService,
    private messageQueueService: MessageQueueService,
    private envService: EnvService
  ) {
    this.breadcrumbs$ = breadcrumbService.breadcrumbs$;

    this.feedbackForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.canListProjects = this.permissionsService.isGranted(generalResourceRNPattern.project, permissionActions.ListProjects);
    this.canListEnvs = this.permissionsService.isGranted(generalResourceRNPattern.project, permissionActions.ListEnvs);

    this.cannotReadProjectsMsg = $localize`You don't have permissions to read project list, please contact the admin to grant you the necessary permissions`;
    this.cannotReadEnvsMsg = this.canListProjects ? $localize`You don't have permissions to read environment list, please contact the admin to grant you the necessary permissions` : $localize`You don't have permissions to read project and environment list, please contact the admin to grant you the necessary permissions`;
    this.setSelectedProjectEnv();
    this.setAllProjects();

    this.messageQueueService.subscribe(this.messageQueueService.topics.PROJECT_LIST_CHANGED, () => {
      this.setAllProjects();
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
    const canAccessEnv = this.permissionsService.isGranted(`project/${this.selectedProject.name}:env/${this.selectedEnv.name}`, permissionActions.AccessEnvs);
    if (!canAccessEnv) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    const projectEnv = {
      projectId: this.selectedProject.id,
      projectName: this.selectedProject.name,
      envId: this.selectedEnv.id,
      envKey: this.selectedEnv.key,
      envName: this.selectedEnv.name,
      envSecret: this.selectedEnv.secrets[0].value
    };

    this.projectService.upsertCurrentProjectEnvLocally(projectEnv);
    this.currentProjectEnv = projectEnv;
    this.envModalVisible = false;

    if (this.router.url.indexOf("/feature-flags") > -1) {
      this.router.navigateByUrl("/feature-flags");
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
    this.canListEnvs = this.permissionsService.isGranted(this.permissionsService.getResourceRN('project', project), permissionActions.ListEnvs);
    this.selectedEnv = project.environments.length > 0 ? project.environments[0] : null;
  }

  onSelectEnv(env: IEnvironment) {
    this.selectedEnv = env;
  }

  private setSelectedProjectEnv() {
    this.currentOrganization = getCurrentOrganization();
    this.currentProjectEnv = getCurrentProjectEnv();

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

  private setAllProjects() {
    this.projectService.getList()
      .subscribe(projects => this.allProjects = projects);
  }

  // copy environment key
  copyText(event, text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }

  // feedback
  feedbackModalVisible = false;
  sendingFeedback = false;
  feedbackForm: FormGroup;

  openFeedbackModal() {
    this.feedbackModalVisible = true;
    this.feedbackForm.reset();
  }

  sendFeedback() {
    if (this.feedbackForm.invalid) {
      for (const i in this.feedbackForm.controls) {
        this.feedbackForm.controls[i].markAsDirty();
        this.feedbackForm.controls[i].updateValueAndValidity();
      }
    }

    this.sendingFeedback = true;
    const {email, message} = this.feedbackForm.value;

    this.feedbackService.sendFeedback(email, message).subscribe({
      next: () => {
        this.message.success($localize`:@@common.feedback-success-message:Thank you for sending us your feedback, we'll get back to you very soon!`);
      },
      error: () => {
        this.message.error($localize`:@@common.feedback-failure-message:We were not able to send your feedback, Please try again!`);
      },
      complete: () => {
        this.sendingFeedback = false;
        this.feedbackModalVisible = false;
      }
    });
  }
}
