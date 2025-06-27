import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RelayProxy, RelayProxyAgent, RelayProxyAutoAgent } from "@features/safe/relay-proxies/types/relay-proxy";
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { SegmentType } from "@features/safe/segments/types/segments-index";
import { ResourceSpaceLevel, ResourceTypeEnum, ResourceV2 } from "@shared/policy";
import { catchError, debounceTime, finalize, first, map, switchMap } from "rxjs/operators";
import { RelayProxyService } from "@services/relay-proxy.service";
import { of } from "rxjs";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'relay-proxy-drawer',
  templateUrl: './relay-proxy-drawer.component.html',
  styleUrls: ['./relay-proxy-drawer.component.less']
})
export class RelayProxyDrawerComponent {
  title: string = '';
  operation: 'Edit' | 'Add' = 'Add';
  _rp: RelayProxy | null;

  autoAgents: RelayProxyAutoAgent[] = [];

  @Input()
  set rp(rp: RelayProxy | null) {
    this.title =
      this.readonly
        ? $localize`:@@relay-proxy.modal.view-title:View Relay Proxy`
        : rp
          ? $localize`:@@relay-proxy.modal.edit-title:Edit Relay Proxy`
          : $localize`:@@relay-proxy.modal.add-title:Add Relay Proxy`;

    this._rp = rp;
    this.operation = rp ? 'Edit' : 'Add';
  }

  private _visible: boolean = false;
  get visible() {
    return this._visible;
  }

  @Input()
  set visible(visible: boolean) {
    this._visible = visible;
    if (visible) {
      this.init();
    }
  }

  @Input()
  readonly: boolean = true;

  @Output()
  onClose: EventEmitter<boolean> = new EventEmitter<boolean>();

  form: FormGroup<{
    name: FormControl<string>,
    description: FormControl<string>,
    scopes: FormGroup<{
      isAllEnvs: FormControl<boolean>,
      envs: FormArray<FormControl<{ id: string, pathName: string }>>,
    }>
    agents: FormArray<FormControl<RelayProxyAgent>>
  }>;

  get scopes() {
    return this.form.get('scopes') as FormGroup;
  }

  get envs() {
    return this.scopes.get('envs') as FormArray;
  }
  removeEnv(index: number) {
    this.envs.removeAt(index);
    this.scopes.markAsDirty();
  }
  get selectedEnvs(): string[] {
    return this.envs.controls.map(x => x.value.id);
  }

  agentModalVisible: boolean = false;
  selectedAgent: RelayProxyAgent | null = null;
  get agents(): FormArray {
    return this.form.get('agents') as FormArray;
  }
  addAgent() {
    this.selectedAgent = null;
    this.agentModalVisible = true;
  }
  editAgent(agent: RelayProxyAgent) {
    this.selectedAgent = agent;
    this.agentModalVisible = true;
  }
  agentCanSync(agent: RelayProxyAgent): boolean {
    if (this.operation === 'Add') {
      return false;
    }

    return this._rp?.agents.some(a => a.id === agent.id) === true;
  }
  syncAgent(agent: RelayProxyAgent) {
    agent.isSyncing = true;
    this.rpService.syncToAgent(this._rp!.id, agent.id)
    .pipe(finalize(() => agent.isSyncing = false))
    .subscribe({
      next: (syncResult) => {
        if (syncResult.success) {
          this.message.success($localize`:@@relay-proxy.drawer.sync-success:Sync to agent succeeded`);
          agent.syncAt = syncResult.syncAt;
        } else {
          this.message.error($localize`:@@relay-proxy.drawer.sync-failed:Sync to agent failed: ${syncResult.reason}`);
        }
      },
      error: () => {
        this.message.error($localize`:@@relay-proxy.drawer.sync-error:Error syncing to agent.`);
      }
    });
  }
  removeAgent(index: number) {
    this.agents.removeAt(index);
  }
  checkAgentAvailability(agent: RelayProxyAgent) {
    agent.isChecking = true;
    this.rpService.checkAgentAvailability(agent.host)
    .pipe(finalize(() => agent.isChecking = false))
    .subscribe({
      next: (statusCode) => {
        if (statusCode === 200) {
          this.message.success($localize`:@@relay-proxy.drawer.agent-available:Agent is available.`);
        } else {
          this.message.error($localize`:@@relay-proxy.drawer.agent-unavailable:Agent is unavailable.` + `(${agent.host}: ${statusCode})`);
        }
      },
      error: () => {
        this.message.error($localize`:@@relay-proxy.drawer.error-checking-agent:Error checking agent availability`);
      }
    });
  }
  closeAgentModal(agent: RelayProxyAgent) {
    this.agentModalVisible = false;

    if (!agent) {
      return;
    }

    const existingIndex = this.agents.controls.findIndex(a => a.value.id === agent.id);
    const formGroup = this.fb.group({
      id: agent.id,
      name: agent.name,
      host: agent.host,
      syncAt: agent.syncAt,
      isNew: existingIndex === -1,
      isChecking: false,
      isSyncing: false
    });

    if (existingIndex !== -1) {
      this.agents.setControl(existingIndex, formGroup);
    } else {
      this.agents.push(formGroup);
    }
  }

  constructor(
    private fb: FormBuilder,
    private message: NzMessageService,
    private rpService: RelayProxyService
  ) {
    this.init();
  }

  init() {
    this.form = new FormGroup({
      name: new FormControl<string>(this._rp?.name, [ Validators.required ], [ this.nameAsyncValidator ]),
      description: new FormControl<string>(this._rp?.description),
      scopes: this.constructScopesFormGroup(this._rp),
      agents: this.constructAgentsFormArray(this._rp?.agents || [])
    });

    this.autoAgents = this._rp?.autoAgents || [];

    if (this._rp) {
      setTimeout(() => {
        this.form.controls.name.updateValueAndValidity();
      });
    }
  }

  nameAsyncValidator = (control: FormControl) => {
    if (this.operation === 'Edit' && control.value === this._rp?.name) {
      return of(null);
    }

    return control.valueChanges.pipe(
      debounceTime(300),
      switchMap(value => this.rpService.isNameUsed(value)),
      map(isUsed => isUsed ? { error: true, duplicated: true } : null),
      catchError(() => [{ error: true, unknown: true }]),
      first()
    );
  }

  private constructScopesFormGroup(rp: RelayProxy): FormGroup {
    const scopesValidator = (group: FormGroup) => {
      let scopes = group.value ?? {
        isAllEnvs: false,
        envs: []
      };

      if (scopes.isAllEnvs === false && (!scopes.envs || scopes.envs.length === 0)) {
        return { error: true };
      }
    }

    if (rp?.isAllEnvs === true) {
      return this.fb.group({
        isAllEnvs: new FormControl<boolean>(true),
        envs: this.fb.array([])
      }, {
        validators: [ scopesValidator ]
      });
    }

    const serves = rp?.parsedServes || [];
    return this.fb.group({
      isAllEnvs: new FormControl<boolean>(false),
      envs: this.fb.array(serves)
    }, {
      validators: [ scopesValidator ]
    });
  }

  private constructAgentsFormArray(agents: RelayProxyAgent[]): FormArray {
    if (!agents || agents.length === 0) {
      return this.fb.array([]);
    }

    const groups = agents.map(agent => {
      return this.fb.group({
        id: [ agent.id ],
        name: [ agent.name, Validators.required ],
        host: [ agent.host, Validators.required ],
        syncAt: [ agent.syncAt ],
        isChecking: [ false ],
        isSyncing: [ false ]
      });
    });

    return this.fb.array(groups);
  }

  resourceFinderVisible = false;
  openResourceFinder() {
    this.resourceFinderVisible = true;
  }
  closeResourceFinder(resources: ResourceV2[]) {
    if (resources.length !== 0) {
      this.envs.clear();
      for (const resource of resources) {
        this.envs.push(this.fb.control({
          id: resource.id,
          pathName: resource.pathName,
        }));
      }
    }

    this.resourceFinderVisible = false;
  }

  saving: boolean = false;
  doSubmit() {
    if (this.readonly) {
      return;
    }

    const {
      name,
      description,
      scopes: { isAllEnvs, envs },
      agents
    } = this.form.value;

    const payload = {
      name,
      description,
      isAllEnvs,
      scopes: isAllEnvs ? [] : envs.map(x => x.id),
      agents
    };

    let responseHandler = {
      next: (result: any) => {
        if (this.operation === 'Add') {
          this.fullKey = result.key;
          this.keyModalVisible = true;
        }

        this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        this.close(true);
      },
      error: () => this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`)
    };

    if (this.operation == 'Edit') {
      this.rpService.update(this._rp.id, payload).subscribe(responseHandler);
    } else {
      this.rpService.create(payload).subscribe(responseHandler);
    }
  }

  fullKey: string = '';
  keyModalVisible = false;
  closeKeyModal() {
    this.keyModalVisible = false;
    this.fullKey = '';
  }

  close(hasChange: boolean = false) {
    this.onClose.emit(hasChange);
  }

  protected readonly SegmentType = SegmentType;
  protected readonly ResourceSpaceLevel = ResourceSpaceLevel;
  protected readonly ResourceTypeEnum = ResourceTypeEnum;
}
