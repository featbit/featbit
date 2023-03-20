import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { PolicyService } from "@services/policy.service";
import {
  AccessTokenTypeEnum,
  IAccessToken,
} from "@features/safe/integrations/access-tokens/types/access-token";
import { AccessTokenService } from "@services/access-token.service";
import { PermissionsService } from "@services/permissions.service";
import {
  EffectEnum,
  generalResourceRNPattern,
  permissionActions,
  ResourceTypeAccount, ResourceTypeFlag,
  ResourceTypeIAM
} from "@shared/policy";
import { NzModalService } from "ng-zorro-antd/modal";
import { copyToClipboard, uuidv4 } from "@utils/index";
import {
  preProcessPermissions,
  IPermissionStatementGroup, postProcessPermissions
} from "@features/safe/integrations/access-tokens/types/permission-helper";
import {
  ResourceType, ResourceTypeAccessToken,
  ResourceTypeEnv,
  ResourceTypeProject
} from "@shared/policy";
import { PolicyTypeEnum } from "@features/safe/iam/types/policy";

@Component({
  selector: 'access-token-drawer',
  templateUrl: './access-token-drawer.component.html',
  styleUrls: ['./access-token-drawer.component.less']
})
export class AccessTokenDrawerComponent {
  private _accessToken: IAccessToken;
  isEditing: boolean = false;

  // This property is used to define the order of displaying the resource types, it also defines the resource types applicable to OPEN API
  resourceTypes: ResourceType[] = [
    ResourceTypeFlag
  ];

  authorizedResourceTypes: ResourceType[] = [];
  permissions: { [key: string]: IPermissionStatementGroup };

  @Input()
  set accessToken(accessToken: IAccessToken) {
    this.isEditing = accessToken && !!accessToken.id;
    if (this.isEditing) {
      this.permissions = preProcessPermissions(accessToken.permissions);
      this.title = $localize`:@@integrations.access-token.access-token-drawer.edit-title:Edit Access Token`;
    } else {
      accessToken = {name: null, type: AccessTokenTypeEnum.Personal};
      this.setAuthorizedPermissions();
      this.title = $localize`:@@integrations.access-token.access-token-drawer.add-title:Add Access Token`;
    }

    this.isServiceAccessToken = accessToken.type === AccessTokenTypeEnum.Service;
    this.patchForm(accessToken);
    this._accessToken = accessToken;
    this.authorizedResourceTypes = this.resourceTypes.filter((rt) => this.permissions[rt.type]?.statements?.length > 0);
  }

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<any> = new EventEmitter();
  title: string = '';

  canTakeActionOnPersonalAccessToken = false;
  canTakeActionOnServiceAccessToken = false;

  constructor(
    private fb: FormBuilder,
    private policyService: PolicyService,
    private permissionsService: PermissionsService,
    private accessTokenService: AccessTokenService,
    private modal: NzModalService,
    private message: NzMessageService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required], [this.nameAsyncValidator], 'change'],
      type: [AccessTokenTypeEnum.Personal, [Validators.required]]
    });

    this.canTakeActionOnPersonalAccessToken = this.permissionsService.isGranted(generalResourceRNPattern.accessToken, permissionActions.ManagePersonalAccessTokens);
    this.canTakeActionOnServiceAccessToken = this.permissionsService.isGranted(generalResourceRNPattern.accessToken, permissionActions.ManageServiceAccessTokens);
  }

  isServiceAccessToken: boolean = false

  form: FormGroup;

  get accessToken() {
    return this._accessToken;
  }

  patchForm(accessToken: Partial<IAccessToken>) {
    this.form.patchValue({
      name: accessToken.name,
      type: accessToken.type,
    });
  }

  onClose() {
    this.close.emit();
  }

  onTypeChange() {
    const {type} = this.form.value;
    this.isServiceAccessToken = type === AccessTokenTypeEnum.Service;
  }

  setAuthorizedPermissions() {
    const hasOwnerPolicy = this.permissionsService.userPolicies.some((policy) => policy.name === 'Owner' && policy.type === PolicyTypeEnum.SysManaged);

    let permissions = [];
    if (hasOwnerPolicy) {
      permissions = Object.keys(permissionActions)
        .map((property) => {
          const {resourceType, name} = permissionActions[property];
          return {
            id: uuidv4(),
            resourceType,
            effect: EffectEnum.Allow,
            actions: [name],
            resources: [generalResourceRNPattern[resourceType]]
          }
        })
    } else {
      permissions = this.permissionsService.userPermissions;
    }

    permissions = permissions.filter((permission) => this.resourceTypes.some((rt) => rt.type === permission.resourceType));
    this.permissions = preProcessPermissions(permissions);
  }

  nameAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.accessTokenService.isNameUsed(value as string)),
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

  updatePermissionsAllChecked(statementGroup: IPermissionStatementGroup) {
    statementGroup.indeterminate = false;
    if (statementGroup.allChecked) {
      statementGroup.statements = statementGroup.statements.map(item => ({
        ...item,
        checked: true
      }));
    } else {
      statementGroup.statements = statementGroup.statements.map(item => ({
        ...item,
        checked: false
      }));
    }
  }

  updatePermissionSingleChecked(statementGroup: IPermissionStatementGroup) {
    if (statementGroup.statements.every(item => !item.checked)) {
      statementGroup.allChecked = false;
      statementGroup.indeterminate = false;
    } else if (statementGroup.statements.every(item => item.checked)) {
      statementGroup.allChecked = true;
      statementGroup.indeterminate = false;
    } else {
      statementGroup.indeterminate = true;
    }
  }

  isLoading: boolean = false;

  tokenName = '';
  tokenValue = '';
  isCreationConfirmModalVisible = false;

  doSubmit() {
    if (this.form.invalid) {
      for (const i in this.form.controls) {
        this.form.controls[i].markAsDirty();
        this.form.controls[i].updateValueAndValidity();
      }

      return;
    }

    const {name, type} = this.form.value;

    if ((type === AccessTokenTypeEnum.Personal && !this.canTakeActionOnPersonalAccessToken) || (type === AccessTokenTypeEnum.Service && !this.canTakeActionOnServiceAccessToken)) {
      this.message.warning($localize`:@@permissions.need-permissions-to-operate:You don't have permissions to take this action, please contact the admin to grant you the necessary permissions`);
      return;
    }

    this.isLoading = true;
    if (this.isEditing) {
      this.accessTokenService.update(this.accessToken.id, name).subscribe({
          next: _ => {
            this.isLoading = false;
            this.close.emit({isEditing: true, id: this.accessToken.id, name: name});
            this.message.success($localize`:@@common.operation-success:Operation succeeded`);
          },
          error: _ => {
            this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`);
            this.isLoading = false;
          }
        }
      );
    } else {
      const policies = this.isServiceAccessToken ? postProcessPermissions(this.permissions) : [];

      this.accessTokenService.create(name, type, policies).subscribe({
          next: ({name, token}) => {
            this.isLoading = false;
            this.close.emit({isEditing: false});
            this.message.success($localize`:@@common.operation-success:Operation succeeded`);
            this.form.reset();
            this.tokenName = name;
            this.tokenValue = token;
            this.isCreationConfirmModalVisible = true;
          },
          error: (e) => {
            this.isLoading = false;
            if (e.errors[0] === 'ServiceAccessTokenMustDefinePolicies') {
              this.message.error($localize`:@@integrations.access-token.service-access-token-must-define-policies:Policies are mandatory for service type access tokens`);
            }
          }
        }
      )
    }
  }

  copyText(event, text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }

  actionTokenTypes = [
    AccessTokenTypeEnum.Personal,
    AccessTokenTypeEnum.Service
  ]
}
