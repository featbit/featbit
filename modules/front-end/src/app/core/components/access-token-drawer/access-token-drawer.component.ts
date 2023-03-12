import { Component, OnInit, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { debounceTime, distinctUntilChanged, first, map, switchMap } from "rxjs/operators";
import { PolicyService } from "@services/policy.service";
import {
  AccessTokenTypeEnum,
  IAccessToken,
  IAccessTokenPolicy
} from "@features/safe/integrations/access-tokens/types/access-token";
import { PolicyFilter } from "@features/safe/iam/types/policy";
import { NzSelectComponent } from "ng-zorro-antd/select";
import { Subject } from "rxjs";
import { AccessTokenService } from "@services/access-token.service";
import { CustomEventSuccessCriteria, CustomEventTrackOption, IMetric } from "@features/safe/experiments/types";
import { uuidv4 } from "@utils/index";

@Component({
  selector: 'access-token-drawer',
  templateUrl: './access-token-drawer.component.html',
  styleUrls: ['./access-token-drawer.component.less']
})
export class AccessTokenDrawerComponent implements OnInit {

  public policyCompareWith: (obj1: IAccessTokenPolicy, obj2: IAccessTokenPolicy) => boolean = (obj1: IAccessTokenPolicy, obj2: IAccessTokenPolicy) => {
    if (obj1 && obj2) {
      return obj1.id === obj2.id;
    } else {
      return false;
    }
  };

  private _accessToken: IAccessToken;
  isEditing: boolean = false;

  @Input()
  set accessToken(accessToken: IAccessToken) {
    this.isEditing = accessToken && !!accessToken.id;
    if (accessToken) {
      this.selectedPolicyList = accessToken.policies.map((p) => ({...p, isSelected: true}));
      this.isServiceAccessToken = accessToken.type === AccessTokenTypeEnum.Service;
      this.patchForm(accessToken);
    } else {
      this.resetForm();
    }
    this._accessToken = accessToken;
  }

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<any> = new EventEmitter();

  policyDebouncer = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private policyService: PolicyService,
    private accessTokenService: AccessTokenService,
    private message: NzMessageService
  ) {
    this.policyDebouncer.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(query => this.searchPolicies(query));
  }

  isServiceAccessToken: boolean = false

  @ViewChild("policyNodeSelector", {static: false}) policySelectNode: NzSelectComponent;
  selectedPolicyList: IAccessTokenPolicy[] = [];
  policySearchResultList: IAccessTokenPolicy[] = [];
  form: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required], [this.nameAsyncValidator], 'change'],
      type: [AccessTokenTypeEnum.Personal, [Validators.required]],
      policy: [null, []]
    });
  }

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
  }

  onPolicySelectChange() {
    const {policy} = this.form.value;

    if (this.selectedPolicyList.some((sp) => sp.id === policy.id)) {
      this.selectedPolicyList = this.selectedPolicyList.filter((sp) => sp.id !== policy.id);
    } else {
      this.selectedPolicyList = [...this.selectedPolicyList, {...policy}];
    }

    this.policySearchResultList = this.policySearchResultList.map((p) => ({
      ...p,
      isSelected: this.selectedPolicyList.some((sp => sp.id === p.id))
    }));
    this.policySelectNode.writeValue(undefined);
    this.validatePoliciesControl();
  }

  removePolicy(policy: IAccessTokenPolicy) {
    this.selectedPolicyList = this.selectedPolicyList.filter((p) => p.id !== policy.id);
    this.validatePoliciesControl();
  }

  isLoadingPolicies = true;

  searchPolicies(query: string = '') {
    this.isLoadingPolicies = true;

    this.policyService.getList(new PolicyFilter(query, 1, 50)).subscribe(policies => {
      this.policySearchResultList = policies.items.map(p => ({
        ...p,
        isSelected: this.selectedPolicyList.some((sp => sp.id === p.id))
      }));

      this.isLoadingPolicies = false;
    }, () => this.isLoadingPolicies = false);
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

  isLoading: boolean = false;
  isPolicyIdsValid = true;

  validatePoliciesControl() {
    const policyControl = this.form.get('policy');
    if (this.isServiceAccessToken && this.selectedPolicyList.length === 0) {
      policyControl.setValidators(Validators.required);
      policyControl.setErrors({required: true});
      this.isPolicyIdsValid = false;
    } else {
      policyControl.clearValidators();
      policyControl.markAsPristine();
      this.isPolicyIdsValid = true;
    }
  }

  doSubmit() {
    // we validate name and type only here
    if (this.form.invalid) {
      for (const i in this.form.controls) {
        this.form.controls[i].markAsDirty();
        this.form.controls[i].updateValueAndValidity();
      }
    }

    // validate policies
    this.validatePoliciesControl();

    if (this.form.invalid || !this.isPolicyIdsValid) {
      return;
    }

    this.isLoading = true;
    const {name, type} = this.form.value;

    if (this.isEditing) {
      this.accessTokenService.update(this.accessToken.id, name).subscribe({
          next: res => {
            this.isLoading = false;
            this.close.emit({ isEditing: true, id: this.accessToken.id, name: name});
            this.message.success($localize`:@@common.operation-success:Operation succeeded`);
          },
          error: _ => {
            this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`);
            this.isLoading = false;
          }
        }
      );
    } else {
      const policies = this.isServiceAccessToken ? this.selectedPolicyList.map(p => p.id) : [];

      this.accessTokenService.create(name, type, policies).subscribe({
          next: () => {
            this.isLoading = false;
            this.close.emit({ isEditing: false });
            this.message.success($localize`:@@common.operation-success:Operation succeeded`);
            this.reset();
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

  actionTokenTypes = [
    AccessTokenTypeEnum.Personal,
    AccessTokenTypeEnum.Service
  ]
}
