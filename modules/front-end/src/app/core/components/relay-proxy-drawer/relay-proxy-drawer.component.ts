import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IEnvironment, IProject } from "@shared/types";
import { copyToClipboard, uuidv4 } from "@utils/index";
import { EnvUserPropService } from "@services/env-user-prop.service";
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { ProjectService } from "@services/project.service";
import { RelayProxyService } from "@services/relay-proxy.service";
import { AgentStatusEnum, IRelayProxy } from "@features/safe/relay-proxies/types/relay-proxy";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { NzModalService } from "ng-zorro-antd/modal";

@Component({
  selector: 'relay-proxy-drawer',
  templateUrl: './relay-proxy-drawer.component.html',
  styleUrls: ['./relay-proxy-drawer.component.less']
})
export class RelayProxyDrawerComponent implements OnInit {
  private _relayProxy: IRelayProxy;

  form: FormGroup;

  isEditing: boolean = false;

  agentStatusHealthy = AgentStatusEnum.Healthy;
  agentStatusUnhealthy = AgentStatusEnum.Unhealthy;
  agentStatusLoading = AgentStatusEnum.Loading;
  agentStatusNone = AgentStatusEnum.None;

  agentStatusDict: {[id: string]: AgentStatusEnum} = {};
  // indicate if the agent is synchronizing
  agentSyncDic: {[id: string]: boolean} = {};

  title: string = '';

  @Input()
  set relayProxy(relayProxy: IRelayProxy) {
    this.isEditing = relayProxy && !!relayProxy.id;
    if (this.isEditing) {
      this.title = $localize`:@@relay-proxy.edit-title:Edit Relay Proxy`;
    } else {
      this.title = $localize`:@@relay-proxy.add-title:Add Relay Proxy`;
    }

    this.patchForm(relayProxy);
    this._relayProxy = relayProxy;
  }

  @Output() close: EventEmitter<any> = new EventEmitter();

  isProjectsLoading: boolean = true;
  projects: IProject[] = [];

  constructor(
    private envUserPropService: EnvUserPropService,
    private projectService: ProjectService,
    private relayProxyService: RelayProxyService,
    private fb: FormBuilder,
    private message: NzMessageService,
    private modal: NzModalService,
    public permissionsService: PermissionsService,
  ) {
    this.initForm();
  }

  ngOnInit() {
    const canListProjects = this.permissionsService.isGranted(generalResourceRNPattern.project, permissionActions.ListProjects);
    if (canListProjects) {
      this.projectService
        .getList()
        .subscribe({
          next: (projects) => this.projects = projects,
          error: (_) => this.message.error($localize`:@@common.error-occurred-try-again:Error occurred, please try again`),
          complete: () => this.isProjectsLoading = false
        });
    }
  }

  initForm() {
    this.form = this.fb.group({
      name: ['', [Validators.required], [this.nameAsyncValidator], 'change'],
      description: [null,Validators.maxLength(512)],
      scopes: this.fb.array([]),
      agents: this.fb.array([])
    });
  }

  patchForm(relayProxy: Partial<IRelayProxy>) {
    this.form.patchValue({
      name: relayProxy.name,
      description: relayProxy.description
    });

    if (relayProxy.scopes.length > 0) {
      const scopeArrayForm = this.fb.array(relayProxy.scopes.map(x => this.fb.group({
        id: [x.id, Validators.required],
        projectId: [x.projectId, Validators.required],
        envIds: [x.envIds, Validators.required]
      })));

      this.form.setControl('scopes', scopeArrayForm);
    } else {
      this.form.setControl('scopes', this.fb.array([]));
    }

    if (relayProxy.agents.length > 0) {
      const agentArrayForm = this.fb.array(relayProxy.agents.map((x, index) => {
        this.agentStatusDict[x.id] = AgentStatusEnum.None;
        this.getAgentStatusInfoAsync(x.id, x.host);
        return this.fb.group({
          id: [x.id, Validators.required],
          name: [x.name, Validators.required],
          host: [x.host, Validators.required],
          syncAt: [x.syncAt], // this is only for UI to display, the value won't be posted to server
          isNew: [false, Validators.required] // this is only for UI to display, the value won't be posted to server
        });
      }));

      this.form.setControl('agents', agentArrayForm);
    } else {
      this.form.setControl('agents', this.fb.array([]));
    }
  }

  nameAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.relayProxyService.isNameUsed(value as string)),
    map(isNameUsed => {
      switch (isNameUsed) {
        case true:
          return {error: true, duplicated: true};
        case undefined:
          return {error: true, unknown: true};
        default:
          return null;
      }
    }),
    first()
  );

  get agents(): FormArray {
    return this.form.get('agents') as FormArray;
  }

  addAgent() {
    const agentId = uuidv4();
    const agentForm = this.fb.group({
      id: [agentId, Validators.required],
      name: ['', Validators.required],
      host: ['', Validators.required],
      syncAt: [''], // this is only for UI to display, the value won't be posted to server
      isNew: [true, Validators.required], // this is only for UI to display, the value won't be posted to server
    });

    this.agentStatusDict[agentId] = AgentStatusEnum.None;
    this.agents.push(agentForm);
    this.refreshFormArray('agents');
  }

  private refreshFormArray(name: string) {
    // @ts-ignore
    // This line is necessary to refresh the table when new agent added or removed
    this.form.controls[name].controls = [...this.form.controls[name].controls];
  }

  removeAgent(index: number) {
    this.agents.removeAt(index);
    this.refreshFormArray('agents');
  }

  async getAgentStatusInfo(id: string, host: string) {
    if (host === '') {
      this.message.error($localize`:@@common.set-agent-host:You need to set the host url to get its status`);
      return;
    }

    await this.getAgentStatusInfoAsync(id, host);
    this.openAgentStatusModal();
  }

  async getAgentStatusInfoAsync(id: string, host: string): Promise<any> {
    this.agentStatusDict[id] = AgentStatusEnum.Loading;

    return new Promise((resolve, reject) => {
      this.relayProxyService.getAgentStatus(host).subscribe({
        next: (res) => {
          this.agentStatusDict[id] = AgentStatusEnum.Healthy; // TODO set the real status
          this.agentStatus = JSON.stringify(res, null, 2);
          resolve(null);
        },
        error: (_) => {
          this.agentStatusDict[id] = AgentStatusEnum.Unhealthy;
          this.message.error($localize`:@@common.error-occurred-try-again:Error occurred, please try again`);
          reject();
        }
      })
    });
  }

  get scopes(): FormArray {
    return this.form.get('scopes') as FormArray;
  }

  addScope() {
    const scopeForm = this.fb.group({
      id: [uuidv4(), Validators.required],
      projectId: ['', Validators.required],
      envIds: [[], Validators.required]
    });

    this.scopes.push(scopeForm);
  }

  removeLesson(index: number) {
    this.scopes.removeAt(index);
  }

  getProjectEnvs(index: number): IEnvironment[] {
    const { projectId } = this.scopes.at(index).value;
    return this.projects.find(x => x.id === projectId)?.environments;
  }

  doSubmit() {
    let invalid = false;
    if (this.form.invalid) {
      for (const i in this.form.controls) {
        this.form.controls[i].markAsDirty();
        this.form.controls[i].updateValueAndValidity();
      }
      invalid = true;
    }

    // validate scopes
    if (this.scopes.invalid) {
      for (let control of this.scopes.controls) {
        const scopeForm: FormGroup = control as FormGroup
        for (const i in scopeForm.controls) {
          scopeForm.controls[i].markAsDirty();
          scopeForm.controls[i].updateValueAndValidity();
        }

      }
      invalid = true;
    }

    // validate agents
    if (this.agents.invalid) {
      for (let control of this.agents.controls) {
        const agentForm: FormGroup = control as FormGroup
        for (const i in agentForm.controls) {
          agentForm.controls[i].markAsDirty();
          agentForm.controls[i].updateValueAndValidity();
        }

      }
      invalid = true;
    }

    if (invalid) {
      return;
    }

    if (this.scopes.controls.length === 0 || this.scopes.controls.length === 0) {
      this.message.error($localize`:@@relay-proxy.scope-and-agent-required:At least one scope and one agent are required`);
      return;
    }

    const payload = { ...this.form.value };

    if (this.isEditing) {

    } else {
      payload.agents = payload.agents.map((agent) => ({...agent, syncAt: null}));
      this.relayProxyService.create(payload).subscribe({
        next: (res) => {
          this.isCreationConfirmModalVisible = true;
          this._relayProxy = res;
          this.close.emit({isEditing: false});
          this.message.success($localize`:@@common.operation-success:Operation succeeded`);
          this.form.reset();
        },
        error: (_) => this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`),
      })
    }
  }

  private _visible: boolean = false;

  @Input()
  set visible(visible: boolean) {
    this._visible = visible;
  }
  get visible() {
    return this._visible;
  }

  agentStatusModalVisible: boolean = false;
  closeAgentStatusModal() {
    this.agentStatusModalVisible = false;
  }

  agentStatus: any;
  openAgentStatusModal() {
    this.agentStatusModalVisible = true;
  }

  sync(index: number) {
    const agent = this.agents.at(index)
    const { id, host } = agent.value;
    this.agentSyncDic[id] = true;

    this.relayProxyService.syncToAgent(this._relayProxy.id, id, host).subscribe({
      next: (_) => {
        agent.patchValue({ syncAt: new Date().getTime() });
        this.message.success($localize`:@@common.operation-success:Operation succeeded`);
      },
      error: (_) => this.message.error($localize`:@@common.error-occurred-try-again:Error occurred, please try again`),
      complete: () => {
        this.agentSyncDic[id] = false;
      }
    })
  }

  isCreationConfirmModalVisible = false;
  copyText(event, text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }
}
