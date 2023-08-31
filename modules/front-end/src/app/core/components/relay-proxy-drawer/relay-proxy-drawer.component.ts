import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IEnvironment, IProject } from "@shared/types";
import { copyToClipboard, uuidv4 } from "@utils/index";
import { EnvUserPropService } from "@services/env-user-prop.service";
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { PermissionsService } from "@services/permissions.service";
import { ProjectService } from "@services/project.service";
import { RelayProxyService } from "@services/relay-proxy.service";
import { AgentStatusEnum, RelayProxy } from "@features/safe/relay-proxies/types/relay-proxy";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { firstValueFrom } from "rxjs";

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
    private notification: NzNotificationService,
    public permissionsService: PermissionsService,
  ) {
    this.initForm('', '', true, this.fb.array([]), this.fb.array([]));
  }

  async ngOnInit() {
    try {
      this.projects = await this.projectService.getListAsync();
    } catch (_) {
      this.message.error($localize`:@@common.error-occurred-try-again:Error occurred, please try again`)
    }

    this.isProjectsLoading = false;
  }

  initForm(name: string, description: string, isAllEnvs: boolean, scopes: FormArray, agents: FormArray) {
    this.form = this.fb.group({
      name: [name, [Validators.required], [this.nameAsyncValidator], 'change'],
      description: [description,Validators.maxLength(512)],
      isAllEnvs: [isAllEnvs, [Validators.required]],
      scopes: scopes,
      agents: agents
    });
    this.form.get('isAllEnvs').valueChanges.subscribe((event) => {
      this.scopeTypeChange(event);
    })
  }

  patchForm(relayProxy: Partial<RelayProxy>) {
    let scopeArrayForm: FormArray = this.fb.array([]);
    if (relayProxy.scopes.length > 0) {
      scopeArrayForm = this.fb.array(relayProxy.scopes.map(x => this.fb.group({
        id: [x.id, Validators.required],
        projectId: [x.projectId, Validators.required],
        envIds: [x.envIds, Validators.required]
      })));
    }

    let agentArrayForm: FormArray = this.fb.array([]);
    if (relayProxy.agents.length > 0) {
      agentArrayForm = this.fb.array(relayProxy.agents.map((agent) => {
        this.agentStatusDict[agent.id] = AgentStatusEnum.Unknown;
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

    this.agentStatusDict[agentId] = AgentStatusEnum.Unknown;
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
        next: (status) => {
          this.agentStatusDict[agentId] = status.type;
          this.agentStatus = JSON.stringify(status, null, 2);
          resolve(null);
        },
        error: () => {
          this.agentStatusDict[agentId] = AgentStatusEnum.Unknown;
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

  cancel() {
    const { agents } = this.form.value;

    let data = this.isEditing
      ? { isEditing: true, ...this._relayProxy, agents: agents }
      : null;

    this.close.emit(data);
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
          this.close.emit({...this._relayProxy, ...payload, isEditing: true});
          this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: () => this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`),
      })
    } else {
      this.relayProxyService.create(payload).subscribe({
        next: (relayProxy) => {
          this.isCreationConfirmModalVisible = true;
          this._relayProxy = relayProxy;
          this.close.emit({...this._relayProxy, isEditing: false});
          this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: () => this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`),
      })
    }
  }

  @Input()
  visible: boolean = false;

  agentStatusModalVisible: boolean = false;
  closeAgentStatusModal() {
    this.agentStatusModalVisible = false;
  }

  agentStatus: any;
  openAgentStatusModal() {
    this.agentStatusModalVisible = true;
  }

  private getSynchronizableAgents(): any[] {
    return this.agents.controls.filter((agent: FormGroup) => !agent.value['isNew'] && !agent.controls['host'].dirty);
  }

  get isSyncAllBtnDisabled() {
    return this.getSynchronizableAgents().length === 0;
  }

  isSyncingAll = false;
  async syncAll() {
    this.isSyncingAll = true;
    const promises = this.getSynchronizableAgents().map(agent => this.syncInternal(agent));
    const results = await Promise.all(promises);

    const title = $localize`:@@common.sync-to-all-agents:Synchronization to all agents`;

    const groups = results.reduce((acc, cur) => {
      if (cur.success) {
        acc.success.push(cur);
      } else {
        acc.fail.push(cur);
      }

      return acc;
    }, { success: [], fail: [] });

    let msg = '';
    if (groups.success.length) {
      const successList = groups.success.reduce((acc, cur) => {
        const { name, host } = cur;

        acc += `<li><strong>${name}</strong>:${host}</li>`;
        return acc;
      }, ``);

      msg += $localize`:@@common.success-sync-agents:Successfully synchronized to the following agents:`
        + `<ul>${successList}</ul>`;
    }

    if (groups.fail.length) {
      const failList = groups.fail.reduce((acc, cur) => {
        const { name, host } = cur;

        acc += `<li><strong>${name}</strong>: ${host}</li>`;
        return acc;
      }, ``);

      msg += $localize`:@@common.fail-sync-agents:Failed to synchronize to the following agents:`
        + `<ul>${failList}</ul>`;
    }

    this.isSyncingAll = false;
    if (groups.fail.length === 0) {
      this.notification.success(title, msg, { nzDuration: 50000 });
    } else if (groups.success.length === 0) {
      this.notification.error(title, msg, { nzDuration: 50000 });
    } else {
      this.notification.warning(title, msg, { nzDuration: 50000 });
    }
  }

  async sync(agent) {
    const syncResult = await this.syncInternal(agent);

    const { success, name, host } = syncResult;
    if (success) {
      this.message.success($localize`:@@common.operation-success-for-agent:Operation succeeded for ${name + ' : ' + host}`);
    } else {
      this.message.error($localize`:@@common.error-occurred-for-agent:Error occurred while synchronizing ${name + ' : ' + host}`);
    }
  }

  async syncInternal(agent): Promise<{ id: string, host: string, name: string, success: boolean }> {
    const { id, host, name } = agent.value;
    this.agentSyncProcessingDic[id] = true;

    let success: boolean;
    try {
      const syncResult = await firstValueFrom(this.relayProxyService.syncToAgent(this._relayProxy.id, id));
      if (syncResult.success) {
        agent.patchValue({ syncAt: syncResult.syncAt });
      }

      success = syncResult.success;
    } catch {
      success = false;
    }

    this.agentSyncProcessingDic[id] = false;
    return { id, host, name, success };
  }

  isCreationConfirmModalVisible = false;
  copyText(event, text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }
}
