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
import { AgentStatusEnum, RelayProxy } from "@features/safe/relay-proxies/types/relay-proxy";
import { debounceTime, finalize, first, map, switchMap } from "rxjs/operators";

@Component({
  selector: 'relay-proxy-drawer',
  templateUrl: './relay-proxy-drawer.component.html',
  styleUrls: ['./relay-proxy-drawer.component.less']
})
export class RelayProxyDrawerComponent implements OnInit {
  form: FormGroup;
  isEditing: boolean = false;

  protected readonly AgentStatusEnum = AgentStatusEnum;

  agentStatusDict: {[id: string]: AgentStatusEnum} = {};
  // indicate if the agent is synchronizing
  agentSyncProcessingDic: {[id: string]: boolean} = {};

  title: string = '';

  @Input() readonly: boolean = false;

  _relayProxy: RelayProxy;
  @Input()
  set relayProxy(relayProxy: RelayProxy) {
    this.isEditing = relayProxy && !!relayProxy.id;
    if (this.isEditing) {
      if (this.readonly) {
        this.title = $localize`:@@relay-proxy.view-title:View Relay Proxy`;
      } else {
        this.title = $localize`:@@relay-proxy.edit-title:Edit Relay Proxy`;
      }
    } else {
      this.title = $localize`:@@relay-proxy.add-title:Add Relay Proxy`;
    }

    this._relayProxy = relayProxy;
    this.patchForm(relayProxy);
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
    public permissionsService: PermissionsService,
  ) {
    this.initForm('', '', true, this.fb.array([]), this.fb.array([]));
  }

  ngOnInit() {
    const canListProjects = this.permissionsService.isGranted(generalResourceRNPattern.project, permissionActions.ListProjects);
    if (canListProjects) {
      this.projectService.getList()
        .pipe(finalize(() => this.isProjectsLoading = false))
        .subscribe({
          next: (projects) => this.projects = projects,
          error: (_) => this.message.error($localize`:@@common.error-occurred-try-again:Error occurred, please try again`),
        });
    }
  }

  initForm(name: string, description: string, isAllEnvs: boolean, scopes: FormArray, agents: FormArray) {
    this.form = this.fb.group({
      name: [name, [Validators.required], [this.nameAsyncValidator], 'change'],
      description: [description,Validators.maxLength(512)],
      isAllEnvs: [isAllEnvs, [Validators.required]],
      scopes: scopes,
      agents: agents
    });
  }

  patchForm(relayProxy: Partial<RelayProxy>) {
    let scopeArrayForm: FormArray<any> = this.fb.array([]);
    if (relayProxy.scopes.length > 0) {
      scopeArrayForm = this.fb.array(relayProxy.scopes.map(x => this.fb.group({
        id: [x.id, Validators.required],
        projectId: [x.projectId, Validators.required],
        envIds: [x.envIds, Validators.required]
      })));
    }

    let agentArrayForm: FormArray<any> = this.fb.array([]);
    if (relayProxy.agents.length > 0) {
      agentArrayForm = this.fb.array(relayProxy.agents.map((agent) => {
        this.agentStatusDict[agent.id] = AgentStatusEnum.None;
        this.getAgentStatusInfoAsync(agent.id, agent.host);
        return this.fb.group({
          id: [agent.id, Validators.required],
          name: [agent.name, Validators.required],
          host: [agent.host, Validators.required],
          syncAt: [agent.syncAt], // this is only for UI to display, the value won't be posted to server
          isNew: [false, Validators.required] // this is only for UI to display, the value won't be posted to server
        });
      }));
    }

    this.initForm(relayProxy.name, relayProxy.description, relayProxy.isAllEnvs, scopeArrayForm, agentArrayForm);
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

  scopeTypeChange(param: boolean) {
    if (!param && this.scopes.value.length === 0) {
      this.addScope();
    }
  }

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

  async getAgentStatusInfo(agentId: string, host: string) {
    if (this.readonly) {
      this.message.warning($localize`:@@permissions.need-permissions-to-operate:You don't have permissions to take this action, please contact the admin to grant you the necessary permissions`);
      return;
    }

    if (host === '') {
      this.message.error($localize`:@@common.set-agent-host:You need to set the host url to get its status`);
      return;
    }

    await this.getAgentStatusInfoAsync(agentId, host);
    this.openAgentStatusModal();
  }

  async getAgentStatusInfoAsync(agentId: string, host: string): Promise<any> {
    this.agentStatusDict[agentId] = AgentStatusEnum.Loading;

    return new Promise((resolve, reject) => {
      this.relayProxyService.getAgentStatus(this._relayProxy.id, host).subscribe({
        next: (res) => {
          this.agentStatusDict[agentId] = res.type;
          this.agentStatus = JSON.stringify(res, null, 2);
          resolve(null);
        },
        error: (_) => {
          this.agentStatusDict[agentId] = AgentStatusEnum.None;
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

  removeEnv(index: number) {
    this.scopes.removeAt(index);
  }

  getProjectEnvs(index: number): IEnvironment[] {
    const { projectId } = this.scopes.at(index).value;
    return this.projects.find(x => x.id === projectId)?.environments;
  }

  isProjectSelected(projectId: string): boolean {
    const { scopes } = this.form.value;
    const allProjectEnvs = this.projects.find((x) => x.id === projectId)?.environments?.map(x => x.id) || [];
    const selectedProjectEnvIds = scopes.filter((x) => x.projectId === projectId).flatMap(x => x.envIds);
    return !allProjectEnvs.some((x) => !selectedProjectEnvIds.some(y => y === x));
  }

  isEnvSelected(envId: string): boolean {
    const { scopes } = this.form.value;
    return scopes.some((x) => x.envIds.some(y => y === envId));
  }

  doSubmit() {
    if (this.readonly) {
      this.message.warning($localize`:@@permissions.need-permissions-to-operate:You don't have permissions to take this action, please contact the admin to grant you the necessary permissions`);
      return;
    }

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

    if (!this.form.value.isAllEnvs && this.scopes.controls.length === 0) {
      this.message.error($localize`:@@relay-proxy.scope-required:At least one environment scope is required`);
      return;
    }

    if (this.agents.controls.length === 0) {
      this.message.error($localize`:@@relay-proxy.agent-required:At least one agent is required`);
      return;
    }

    const payload = { ...this.form.value };
    if (payload.isAllEnvs) {
      payload.scopes = [];
      this.scopes.clear();
    }

    payload.agents = payload.agents.map((agent) => ({...agent, syncAt: agent.syncAt || null}));
    if (this.isEditing) {
      this.relayProxyService.update({...payload, id: this._relayProxy.id}).subscribe({
        next: () => {
          this.close.emit({isEditing: false});
          this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: (_) => this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`),
      })
    } else {
      this.relayProxyService.create(payload).subscribe({
        next: (res) => {
          this.isCreationConfirmModalVisible = true;
          this._relayProxy = res;
          this.close.emit({isEditing: false});
          this.message.success($localize`:@@common.operation-success:Operation succeeded`);
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
    const agent = this.agents.at(index);
    const { id } = agent.value;
    this.agentSyncProcessingDic[id] = true;

    this.relayProxyService.syncToAgent(this._relayProxy.id, id)
      .pipe(finalize(() => this.agentSyncProcessingDic[id] = false))
      .subscribe({
        next: (res) => {
          agent.patchValue({ syncAt: res.syncAt });
          this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: (_) => this.message.error($localize`:@@common.error-occurred-try-again:Error occurred, please try again`)
      });
  }

  isCreationConfirmModalVisible = false;
  copyText(event, text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }
}
