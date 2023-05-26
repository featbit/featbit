import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IUserPropertyPresetValue, IUserProp, IProject, IEnvironment } from "@shared/types";
import { uuidv4 } from "@utils/index";
import { EnvUserPropService } from "@services/env-user-prop.service";
import { FormArray, FormBuilder, FormGroup, Validators } from "@angular/forms";
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { ProjectService } from "@services/project.service";

@Component({
  selector: 'relay-proxy-drawer',
  templateUrl: './relay-proxy-drawer.component.html',
  styleUrls: ['./relay-proxy-drawer.component.less']
})
export class RelayProxyDrawerComponent implements OnInit {

  form: FormGroup;

  @Input() envId: string;
  @Output() close: EventEmitter<boolean> = new EventEmitter();

  isProjectsLoading: boolean = true;
  projects: IProject[] = [];

  constructor(
    private envUserPropService: EnvUserPropService,
    private projectService: ProjectService,
    private fb: FormBuilder,
    private message: NzMessageService,
    public permissionsService: PermissionsService,
    private cdr: ChangeDetectorRef
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
      name: [null, [Validators.required]],
      description: [null,Validators.maxLength(512)],
      scopes: this.fb.array([]),
      agents: this.fb.array([])
    });

    //this.addAgent();
  }

  get agents(): FormArray {
    return this.form.controls["agents"] as FormArray;
  }

  addAgent() {
    const agentForm = this.fb.group({
      host: ['', Validators.required]
    });

    this.agents.push(agentForm);
    // @ts-ignore
    // This line is necessary to refresh the table when new agent added or removed
    this.form.controls["agents"].controls = [...this.form.controls["agents"].controls];
  }

  removeAgent(index: number) {
    this.agents.removeAt(index);
    // @ts-ignore
    // This line is necessary to refresh the table when new agent added or removed
    this.form.controls["agents"].controls = [...this.form.controls["agents"].controls];
  }

  get scopes(): FormArray {
    return this.form.controls["scopes"] as FormArray;
  }

  addScope() {
    const scopeForm = this.fb.group({
      projectId: ['', Validators.required],
      envIds: [[], Validators.required]
    });

    this.scopes.push(scopeForm);
  }

  removeLesson(index: number) {
    this.scopes.removeAt(index);
  }

  get environments() {
    return;
  }

  getProjectEnvs(idx: number): IEnvironment[] {
    const { projectId } = this.scopes.at(idx).value;
    return this.projects.find(x => x.id === projectId)?.environments;
  }

  doSubmit() {
    console.log('submit');
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

    const { name, description, scopes, agents } = this.form.value;
    console.log(scopes);
    console.log(agents);
  }

  private _visible: boolean = false;

  @Input()
  set visible(visible: boolean) {
    if (visible) {
      this.isLoading = true;
      this.envUserPropService.get().subscribe(props => {
        this.props = [...props];
        this.isLoading = false;
      })
    }
    this._visible = visible;
  }
  get visible() {
    return this._visible;
  }

  isLoading: boolean = false;

  sources: string[] = ["header", "querystring", "cookie", "body"];

  // props
  displayedProps: IUserProp[] = [];

  _props: IUserProp[];
  get props() {
    return this._props;
  }
  set props(props: IUserProp[]) {
    this._props = [...props];
    this.searchProp();
  }

  propsPageIndex: number = 1;

  newProp() {
    const newProp: IUserProp = {
      id: uuidv4(),
      name: '',
      presetValues: [],
      isBuiltIn: false,
      usePresetValuesOnly: false,
      isDigestField: false,
      remark: '',

      isNew: true,
      isEditing: true,
    };

    this.props = [...this.props, newProp];

    this.propsPageIndex = Math.floor(this.props.length / 10) + 1;
  }

  editProp(row: IUserProp) {
    row.isEditing = true;
  }

  cancelEditProp(row: IUserProp) {
    row.isEditing = false;

    if (row.isNew) {
      this.props = this.props.filter(x => x.id !== row.id);
    }
  }

  toggleIsDigestField(row: IUserProp) {
    if (row.isNew) {
      return;
    }

    this.envUserPropService.upsertProp(row).subscribe(() => {
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    }, _ => {
      this.message.error($localize `:@@common.operation-failed:Operation failed`);
    });
  }

  saveProp(row: IUserProp, successCb?: Function) {
    if (!row.name) {
      this.message.warning($localize `:@@users.property-name-cannot-be-empty:Property name cannot be empty`);
      return;
    }

    if (this.props.find(x => x.name === row.name && x.id !== row.id)) {
      this.message.warning($localize `:@@users.property-unavailable:Property exists`);
      return;
    }

    row.isSaving = true;

    this.envUserPropService.upsertProp(row).subscribe(() => {
      row.isSaving = false;
      row.isEditing = false;

      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      successCb && successCb();
    }, _ => {
      row.isSaving = false;
      this.message.error($localize `:@@common.operation-failed:Operation failed`);
    });
  }

  archiveProp(row: IUserProp) {
    if (!row.name) {
      this.props = this.props.filter(prop => prop.id !== row.id);
      return;
    }

    row.isDeleting = true;

    this.envUserPropService.archiveProp(row.id).subscribe(() => {
      this.props = this.props.filter(prop => prop.id !== row.id);
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      row.isDeleting = false;
    }, _ => {
      row.isDeleting = false;
      this.message.error($localize `:@@common.operation-failed:Operation failed`);
    });
  }

  propSearchText: string = '';
  searchProp() {
    if (!this.propSearchText) {
      this.displayedProps = this.props;
      return;
    }

    this.displayedProps = this.props.filter(x => x.name.toLowerCase().includes(this.propSearchText.toLowerCase()));
  }

  propPresetValuesModalVisible = false;
  currentUserPropRow: IUserProp;
  currentPresetValueKey = '';
  currentPresetValueDescription = '';

  private resetCurrentPreset() {
    this.currentPresetValueKey = '';
    this.currentPresetValueDescription = '';
  }

  openPropPresetValuesModal(userProp: IUserProp) {
    this.currentUserPropRow = { ...userProp };
    this.propPresetValuesModalVisible = true;
  }

  closePropPresetValuesModal() {
    this.propPresetValuesModalVisible = false;
    this.resetCurrentPreset();
  }

  addPropPresetValue() {
    this.currentUserPropRow.presetValues = [{
      id: uuidv4(),
      value: this.currentPresetValueKey,
      description: this.currentPresetValueDescription
    }, ...this.currentUserPropRow.presetValues];

    this.resetCurrentPreset();
  }

  removePropPresetValue(value: IUserPropertyPresetValue) {
    this.currentUserPropRow.presetValues = this.currentUserPropRow.presetValues.filter(p => p.id !== value.id);
  }

  savePropPresetValuesModal() {
    if (this.currentUserPropRow.presetValues.length === 0) {
      this.currentUserPropRow.usePresetValuesOnly = false;
    }

    this.saveProp(this.currentUserPropRow, () => {
      this.props = this.props.map(x => {
        if (x.id === this.currentUserPropRow.id) {
          return { ...this.currentUserPropRow };
        }
        return x;
      })
    });

    this.propPresetValuesModalVisible = false;
    this.resetCurrentPreset();
  }
}
