import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { AccessTokenTypeEnum, IAccessToken, } from "@features/safe/integrations/access-tokens/types/access-token";
import { AccessTokenService } from "@services/access-token.service";
import { PermissionsService } from "@services/permissions.service";
import {
  EffectEnum,
  generalResourceRNPattern,
  IamPolicyAction,
  permissionActions,
  ResourceType,
  ResourceTypeEnum,
  ResourceTypeEnv,
  ResourceTypeFlag,
  ResourceTypeIAM,
  ResourceTypeProject,
  ResourceTypeSegment,
  ResourceTypeWorkspace
} from "@shared/policy";
import { copyToClipboard, uuidv4 } from "@utils/index";
import {
  IPermissionStatementGroup,
  postProcessPermissions,
  preProcessPermissions
} from "@features/safe/integrations/access-tokens/types/permission-helper";
import { PolicyTypeEnum } from "@features/safe/iam/types/policy";
import { PermissionLicenseService } from "@services/permission-license.service";
import { LicenseFeatureEnum } from "@shared/types";

@Component({
    selector: 'access-token-drawer',
    templateUrl: './access-token-drawer.component.html',
    styleUrls: ['./access-token-drawer.component.less'],
    standalone: false
})
export class AccessTokenDrawerComponent implements OnInit {
  private _accessToken: IAccessToken;
  isEditing: boolean = false;

  // This property is used to define the order of displaying the resource types, it also defines the resource types applicable to OPEN API
  resourceTypes: ResourceType[] = [
    ResourceTypeFlag,
    ResourceTypeSegment,
    ResourceTypeProject,
    ResourceTypeEnv,
    ResourceTypeIAM,
    ResourceTypeWorkspace
  ];

  fineGrainedAccessControlEnabled: boolean = false;
  authorizedResourceTypes: ResourceType[] = [];
  permissions: { [key: string]: IPermissionStatementGroup };

  @Input()
  set accessToken(accessToken: IAccessToken) {
    this.isEditing = accessToken && !!accessToken.id;
    if (this.isEditing) {
      this.permissions = preProcessPermissions(accessToken.permissions);
      if (this.readonly) {
        this.title = $localize`:@@integrations.access-token.access-token-drawer.view-title:View Access Token`;
      } else {
        this.title = $localize`:@@integrations.access-token.access-token-drawer.edit-title:Edit Access Token`;
      }
    } else {
      accessToken = {name: null, type: AccessTokenTypeEnum.Personal};
      this.setAuthorizedPermissions();
      this.title = $localize`:@@integrations.access-token.access-token-drawer.add-title:Add Access Token`;
    }

    this.isServiceAccessToken = accessToken.type === AccessTokenTypeEnum.Service;
    this.initForm(accessToken.name, accessToken.type);
    this._accessToken = accessToken;
    this.authorizedResourceTypes = this.resourceTypes.filter((rt) => this.permissions[rt.type]?.statements?.length > 0);
  }

  @Input() visible: boolean = false;

  @Input() readonly: boolean = false;

  @Output() close: EventEmitter<any> = new EventEmitter();
  title: string = '';

  canTakeActionOnPersonalAccessToken = false;
  canTakeActionOnServiceAccessToken = false;

  constructor(
    private fb: FormBuilder,
    private permissionsService: PermissionsService,
    private accessTokenService: AccessTokenService,
    private message: NzMessageService,
    private permissionLicenseService: PermissionLicenseService
  ) {
  }

  ngOnInit(): void {
    this.initForm('', AccessTokenTypeEnum.Personal);

    this.fineGrainedAccessControlEnabled = this.permissionLicenseService.isGrantedByLicense(LicenseFeatureEnum.FineGrainedAccessControl);
    this.canTakeActionOnPersonalAccessToken = this.permissionsService.isGranted(generalResourceRNPattern.accessToken, permissionActions.ManagePersonalAccessTokens);
    this.canTakeActionOnServiceAccessToken = this.permissionsService.isGranted(generalResourceRNPattern.accessToken, permissionActions.ManageServiceAccessTokens);
  }

  private initForm(name: string, type: AccessTokenTypeEnum) {
    this.form = this.fb.group({
      name: [name, [Validators.required], [this.nameAsyncValidator], 'change'],
      type: [type, [Validators.required]]
    });

    this.form.get('type').valueChanges.subscribe((newType) => {
      this.isServiceAccessToken = newType === AccessTokenTypeEnum.Service;
    });
  }

  isActionDisabled(act: IamPolicyAction): boolean {
    return act.isFineGrainedAction && !this.fineGrainedAccessControlEnabled;
  }

  isServiceAccessToken: boolean = false

  form: FormGroup;

  get accessToken() {
    return this._accessToken;
  }

  onClose() {
    this.close.emit();
  }

  setAuthorizedPermissions() {
    const hasOwnerPolicy = this.permissionsService.userPolicies.some((policy) => policy.name === 'Owner' && policy.type === PolicyTypeEnum.SysManaged);

    let permissions;
    if (hasOwnerPolicy) {
      permissions = Object.keys(permissionActions)
        .filter(act => {
          if (this.fineGrainedAccessControlEnabled) {
            return act !== 'FlagAllActions'
          }

          return !permissionActions[act].isFineGrainedAction;
        })
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
      permissions = this.permissionsService.userPermissions.map(p => {
        if (this.fineGrainedAccessControlEnabled && p.resourceType === ResourceTypeEnum.Flag) {
          if(p.actions.some((action) => action === '*')) {
            return {
              ...p,
              actions: Object.values(permissionActions)
              .filter(act => act.resourceType === ResourceTypeEnum.Flag && act.name !== '*' && act.isFineGrainedAction)
              .map(act => act.name),
            };
          }
        }

        return {...p};
      });
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

  tokenTypes = [
    { label: $localize `:@@integrations.access-token.personal:Personal`, value: AccessTokenTypeEnum.Personal },
    { label: $localize `:@@integrations.access-token.service:Service`, value: AccessTokenTypeEnum.Service },
  ]
}
