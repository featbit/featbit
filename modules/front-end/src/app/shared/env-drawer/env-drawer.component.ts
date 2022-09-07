import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IEnvironment, IEnvKey, EnvKeyNameEnum } from '@shared/types';
import { EnvService } from '@services/env.service';
import { ProjectService } from "@services/project.service";
import {generalResourceRNPattern, permissionActions} from "@shared/permissions";
import {PermissionsService} from "@services/permissions.service";

@Component({
  selector: 'app-env-drawer',
  templateUrl: './env-drawer.component.html',
  styleUrls: ['./env-drawer.component.less']
})
export class EnvDrawerComponent implements OnInit {

  private _env: IEnvironment;

  envForm: FormGroup;

  isEditing: boolean = false;

  isLoading: boolean = false;

  public envKeySecret = EnvKeyNameEnum.Secret;
  public envKeyMobileSecret = EnvKeyNameEnum.MobileSecret;

  @Input()
  set env(env: IEnvironment) {
    this.isEditing = env && !!env.id;
    if (env) {
      this.patchForm(env);
    } else {
      this.resetForm();
    }
    this._env = env;
  }

  get env() {
    return this._env;
  }

  @Input() currentAccountId: number;
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
    this.close.emit({ isEditing: false });
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
      this.envService.putUpdateEnv(this.currentAccountId, this.env.projectId, {
        name,
        description,
        id: this.env.id,
        projectId
      }).pipe()
        .subscribe(
          () => {
            this.isLoading = false;
            this.close.emit({isEditing: true, env: { name }});
            this.message.success('更新成功！');
          },
          () => {
            this.isLoading = false;
          }
        );
    } else {
      this.envService.postCreateEnv(this.currentAccountId, this.env.projectId, { name, description, projectId })
        .pipe()
        .subscribe(
          () => {
            this.isLoading = false;
            this.close.emit({isEditing: false, env: { name }});
            this.message.success('创建成功！');
          },
          () => {
            this.isLoading = false;
          }
        );
    }
  }

  onRegenerate(keyName: EnvKeyNameEnum) {
    this.envService.putUpdateEnvKey(this.currentAccountId, this.env.projectId, this.env.id,
      {keyName: keyName, keyValue: this.env.secret}
    ).subscribe(
      (envKey: IEnvKey) => {
        const curProjectEnv = this.projectSrv.getLocalCurrentProjectEnv();
        if (curProjectEnv &&
          this.env.id == curProjectEnv.envId &&
          this.env.projectId == curProjectEnv.projectId) {
          // update current project env
          this.projectSrv.updateCurrentProjectEnvLocally({envSecret: envKey.keyValue});
        }

        this.close.emit({isEditing: false});
        this.message.success(`重新生成 ${keyName} 成功！`);
      },
      _ => { }
    );
  }

  @Input() rn = null;

  canTakeAction() {
    if (this.rn === null) {
      return true;
    }

    if (!this.isEditing) { // creation
      return this.permissionsService.canTakeAction(generalResourceRNPattern.project, permissionActions.CreateEnv);
    } else {
      return this.permissionsService.canTakeAction(this.rn, permissionActions.UpdateEnvInfo);
    }
  }
}
