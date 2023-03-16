import { Component, OnInit, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { PolicyService } from "@services/policy.service";
import {
  AccessTokenTypeEnum,
  IAccessToken,
  IAccessTokenPolicy
} from "@features/safe/integrations/access-tokens/types/access-token";
import { NzSelectComponent } from "ng-zorro-antd/select";
import { AccessTokenService } from "@services/access-token.service";
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/permissions";
import { PolicyFilter } from "@features/safe/iam/types/policy";
import { NzModalService } from "ng-zorro-antd/modal";
import { copyToClipboard } from "@utils/index";
import {
  preProcessPermissions,
  IPermissionStatementGroup, postProcessPermissions
} from "@features/safe/integrations/access-tokens/types/permission-helper";
import {
  IPolicyStatement,
  ResourceType, ResourceTypeAccessToken,
  ResourceTypeEnv,
  ResourceTypeProject
} from "@shared/policy";

@Component({
  selector: 'access-token-drawer',
  templateUrl: './access-token-drawer.component.html',
  styleUrls: ['./access-token-drawer.component.less']
})
export class AccessTokenDrawerComponent {
  private _accessToken: IAccessToken;
  isEditing: boolean = false;

  resourceTypes: ResourceType[] = [ResourceTypeAccessToken, ResourceTypeProject, ResourceTypeEnv]; // TODO replace with real open API resource types
  authorizedResourceTypes: ResourceType[] = [];
  permissions: { [key: string]: IPermissionStatementGroup };
  @Input()
  set accessToken(accessToken: IAccessToken) {
    this.isEditing = accessToken && !!accessToken.id;
    if (this.isEditing) {
      this.permissions = preProcessPermissions(accessToken.permissions);
      this.authorizedResourceTypes = this.resourceTypes.filter((rt) => this.permissions[rt.type]?.statements?.length > 0);
    } else {
      accessToken = { name: null, type: AccessTokenTypeEnum.Personal};
      this.setAuthorizedPermissions();
    }

    this.isServiceAccessToken = accessToken.type === AccessTokenTypeEnum.Service;
    this.patchForm(accessToken);
    this._accessToken = accessToken;

  }

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<any> = new EventEmitter();

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

    this.canTakeActionOnPersonalAccessToken = this.permissionsService.canTakeAction(generalResourceRNPattern.accessToken, permissionActions.ManagePersonalAccessTokens);
    this.canTakeActionOnServiceAccessToken = this.permissionsService.canTakeAction(generalResourceRNPattern.accessToken, permissionActions.ManageServiceAccessTokens);
  }

  isServiceAccessToken: boolean = false

  @ViewChild("policyNodeSelector", {static: false}) policySelectNode: NzSelectComponent;
  form: FormGroup;

  get accessToken() {
    return this._accessToken;
  }

  resetForm() {
    this.form && this.form.reset();
  }

  patchForm(accessToken: Partial<IAccessToken>) {
    this.form.patchValue({
      name: accessToken.name,
      type: accessToken.type,
      policy: {},
    });
  }

  resetPolicy() {
    this.form.patchValue({
      policy: {},
    });
  }

  onClose() {
    this.reset();
    this.close.emit();
  }

  private reset() {
    this.form.reset();
  }

  onTypeChange() {
    const {type} = this.form.value;
    this.isServiceAccessToken = type === AccessTokenTypeEnum.Service;
    this.resetPolicy();
  }

  setAuthorizedPermissions() {
    const hasOwnerPolicy = this.permissionsService.policies.some((policy) => policy.name === 'Owner' && policy.type === 'SysManaged');

    if (hasOwnerPolicy) {
      this.policyService.getList(new PolicyFilter('', 1, 100)).subscribe({
        next: policies => {
          this.permissions = preProcessPermissions(policies.items.flatMap(p => p.statements));
          this.authorizedResourceTypes = this.resourceTypes.filter((rt) => this.permissions[rt.type]?.statements?.length > 0);
        }
      });
    } else {
      this.permissions = preProcessPermissions(this.permissionsService.permissions);
    }
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

  updatePermissionSingleChecked(statementGroup: IPermissionStatementGroup){
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
      this.message.warning($localize `:@@permissions.need-permissions-to-operate:You don't have permissions to take this action, please contact the admin to grant you the necessary permissions`);
      return;
    }

    this.isLoading = true;
    if (this.isEditing) {
      this.accessTokenService.update(this.accessToken.id, name).subscribe({
          next: res => {
            this.isLoading = false;
            this.close.emit({ isEditing: true, id: this.accessToken.id, name: name });
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
          next: ({id, name, token}) => {
            this.isLoading = false;
            this.close.emit({ isEditing: false });
            this.message.success($localize`:@@common.operation-success:Operation succeeded`);
            this.reset();
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
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }

  actionTokenTypes = [
    AccessTokenTypeEnum.Personal,
    AccessTokenTypeEnum.Service
  ]
}
