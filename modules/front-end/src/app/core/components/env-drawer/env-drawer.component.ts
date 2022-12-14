import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IEnvironment } from '@shared/types';
import { EnvService } from '@services/env.service';
import { ProjectService } from "@services/project.service";
import { generalResourceRNPattern, permissionActions } from "@shared/permissions";
import { PermissionsService } from "@services/permissions.service";

@Component({
  selector: 'app-env-drawer',
  templateUrl: './env-drawer.component.html',
  styleUrls: ['./env-drawer.component.less']
})
export class EnvDrawerComponent implements OnInit {

  private _env: IEnvironment;

  envForm: FormGroup;

  isEditing: boolean = false;
  title: string;
  isLoading: boolean = false;

  @Input()
  set env(env: IEnvironment) {
    this.isEditing = env && !!env.id;
    if (this.isEditing) {
      this.title = $localize `:@@org.project.editEnv:Edit environment`;
      this.patchForm(env);
    } else {
      this.title = $localize `:@@org.project.addEnv:Add environment`;
      this.resetForm();
    }
    this._env = env;
  }

  get env() {
    return this._env;
  }

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<any> = new EventEmitter();

  permissionDenyMsg = this.permissionsService.genericDenyMessage;

  constructor(
    private fb: FormBuilder,
    private envService: EnvService,
    private message: NzMessageService,
    private projectSrv: ProjectService,
    private permissionsService: PermissionsService
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  initForm() {
    this.envForm = this.fb.group({
      name: [null, [Validators.required]],
      description: [null],
    });
  }

  patchForm(env: Partial<IEnvironment>) {
    this.envForm.patchValue({
      name: env.name,
      description: env.description,
    });
  }

  resetForm() {
    this.envForm && this.envForm.reset();
  }

  onClose() {
    this.close.emit();
  }

  doSubmit() {
    if (this.envForm.invalid) {
      for (const i in this.envForm.controls) {
        this.envForm.controls[i].markAsDirty();
        this.envForm.controls[i].updateValueAndValidity();
      }
      return;
    }

    this.isLoading = true;

    const { name, description } = this.envForm.value;
    const projectId = this.env.projectId;

    if (this.isEditing) {
      this.envService.putUpdateEnv(this.env.projectId, {
        name,
        description,
        id: this.env.id
      }).pipe()
        .subscribe(
          ({id, name, description, secrets}) => {
            this.isLoading = false;
            this.close.emit({isEditing: true, env: { name, description, id, projectId, secrets }});
            this.message.success($localize `:@@org.project.envUpdateSuccess:Environment successfully updated`);
          },
          () => {
            this.isLoading = false;
          }
        );
    } else {
      this.envService.postCreateEnv(this.env.projectId, { name, description, projectId })
        .pipe()
        .subscribe(
          ({id, name, description, secrets}) => {
            this.isLoading = false;
            this.close.emit({isEditing: false, env: { name, description, id, projectId, secrets }});
            this.message.success($localize `:@@org.project.envCreateSuccess:Environment successfully created`);
          },
          () => {
            this.isLoading = false;
          }
        );
    }
  }

  @Input() rn = null;

  canTakeAction() {
    if (this.rn === null) {
      return true;
    }

    if (!this.isEditing) { // creation
      return this.permissionsService.canTakeAction(generalResourceRNPattern.project, permissionActions.CreateEnv);
    } else {
      return this.permissionsService.canTakeAction(this.rn, permissionActions.UpdateEnvSettings);
    }
  }
}
