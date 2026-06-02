import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IEnvironment } from '@shared/types';
import { EnvService } from '@services/env.service';
import { permissionActions } from "@shared/policy";
import { PermissionsService } from "@services/permissions.service";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { slugify } from "@utils/index";

@Component({
  selector: 'env-drawer',
  templateUrl: './env-drawer.component.html',
  styleUrls: [ './env-drawer.component.less' ],
  standalone: false
})
export class EnvDrawerComponent {

  form: FormGroup;
  isEditing: boolean = false;
  title: string;
  isLoading: boolean = false;

  private _env: IEnvironment;
  @Input()
  set env(data: IEnvironment) {
    this._env = data;
    this.isEditing = data && !!data.id;
    this.title = this.isEditing
      ? $localize`:@@org.project.editEnv:Edit environment`
      : $localize`:@@org.project.addEnv:Add environment`;

    this.initForm(data);
  }

  @Input() rn = null;
  @Input() visible: boolean = false;
  @Output() close: EventEmitter<any> = new EventEmitter();

  permissionDenyMsg = this.permissionsService.genericDenyMessage;

  constructor(
    private formBuilder: FormBuilder,
    private envService: EnvService,
    private message: NzMessageService,
    private permissionsService: PermissionsService
  ) { }

  initForm(data: IEnvironment) {
    if (data && data.id) {
      this.form = this.formBuilder.group({
        name: [ data.name, [ Validators.required ] ],
        key: [ { disabled: true, value: data.key }],
        description: [ data.description ],
        settings: this.formBuilder.group({
          requireChangeComment: [ data.settings.requireChangeComment ]
        })
      });
    } else {
      this.form = this.formBuilder.group({
        name: [ '', [ Validators.required ] ],
        key: ['', Validators.required, this.keyAsyncValidator ],
        description: [ '' ],
        settings: this.formBuilder.group({
          requireChangeComment: [ false ]
        })
      });

      this.form.get('name').valueChanges.subscribe((name) => {
        let keyControl = this.form.get('key')!;
        keyControl.setValue(slugify(name ?? ''));
        keyControl.markAsDirty();
      });
    }
  }

  keyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.envService.isKeyUsed(this._env.projectId, value as string)),
    map(isKeyUsed => {
      switch (isKeyUsed) {
        case true:
          return { error: true, duplicated: true };
        case undefined:
          return { error: true, unknown: true };
        default:
          return null;
      }
    }),
    first()
  );

  onClose() {
    this.close.emit();
  }

  doSubmit() {
    this.isLoading = true;

    if (this.isEditing) {
      this.envService.updateEnv(this._env.projectId, this._env.id, this.form.value).subscribe({
        next: (updatedEnv) => {
          this.isLoading = false;
          this.close.emit({ isEditing: true, env: updatedEnv });
          this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: () => {
          this.isLoading = false;
          this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`);
        }
      });
    } else {
      this.envService.createEnv(this._env.projectId, this.form.value).subscribe({
        next: (newEnv) => {
          this.isLoading = false;
          this.close.emit({ isEditing: false, env: newEnv });
          this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: () => {
          this.isLoading = false;
          this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`);
        }
      });
    }
  }

  isGranted() {
    if (this.rn === null) {
      return true;
    }

    if (!this.isEditing) { // creation
      return this.permissionsService.isGranted(this.rn, permissionActions.CreateEnv);
    } else {
      return this.permissionsService.isGranted(this.rn, permissionActions.UpdateEnvSettings);
    }
  }
}
