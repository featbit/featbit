import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IEnvironment } from '@shared/types';
import { EnvService } from '@services/env.service';
import { ProjectService } from "@services/project.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { PermissionsService } from "@services/permissions.service";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { slugify } from "@utils/index";

@Component({
  selector: 'app-env-drawer',
  templateUrl: './env-drawer.component.html',
  styleUrls: ['./env-drawer.component.less']
})
export class EnvDrawerComponent {

  private _env: IEnvironment;

  envForm: FormGroup;

  isEditing: boolean = false;
  title: string;
  isLoading: boolean = false;

  @Input()
  set env(env: IEnvironment) {
    this.isEditing = env && !!env.id;
    if (this.isEditing) {
      this.title = $localize`:@@org.project.editEnv:Edit environment`;
      this.initForm(true);
      this.patchForm(env);
    } else {
      this.title = $localize`:@@org.project.addEnv:Add environment`;
      this.initForm(false);
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
  ) {
  }

  initForm(isKeyDisabled: boolean) {
    this.envForm = this.fb.group({
      name: [null, [Validators.required]],
      key: [{disabled: isKeyDisabled, value: null}, Validators.required, this.keyAsyncValidator],
      description: [null],
    });

    this.envForm.get('name').valueChanges.subscribe((name) => {
      this.nameChange(name);
    });
  }

  nameChange(name: string) {
    if (this.isEditing) return;

    let keyControl = this.envForm.get('key')!;
    keyControl.setValue(slugify(name ?? ''));
    keyControl.markAsDirty();
  }

  keyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.envService.isKeyUsed(this.env.projectId, value as string)),
    map(isKeyUsed => {
      switch (isKeyUsed) {
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

  patchForm(env: Partial<IEnvironment>) {
    this.envForm.patchValue({
      name: env.name,
      key: env.key,
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

    const {name, key, description} = this.envForm.value;
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
            this.close.emit({isEditing: true, env: {name, description, id, key, projectId, secrets}});
            this.message.success($localize`:@@org.project.envUpdateSuccess:Environment successfully updated`);
          },
          () => {
            this.isLoading = false;
          }
        );
    } else {
      this.envService.postCreateEnv(this.env.projectId, {name, key, description, projectId})
        .pipe()
        .subscribe(
          ({id, name, description, secrets}) => {
            this.isLoading = false;
            this.close.emit({isEditing: false, env: {name, description, id, key, projectId, secrets}});
            this.message.success($localize`:@@org.project.envCreateSuccess:Environment successfully created`);
          },
          () => {
            this.isLoading = false;
          }
        );
    }
  }

  @Input() rn = null;

  isGranted() {
    if (this.rn === null) {
      return true;
    }

    if (!this.isEditing) { // creation
      return this.permissionsService.isGranted(generalResourceRNPattern.project, permissionActions.CreateEnv);
    } else {
      return this.permissionsService.isGranted(this.rn, permissionActions.UpdateEnvSettings);
    }
  }
}
