import { Component, OnInit, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { debounceTime, distinctUntilChanged, first, map, switchMap } from "rxjs/operators";
import { PolicyService } from "@services/policy.service";
import { AccessTokenTypeEnum, IAccessTokenPolicy } from "@features/safe/integrations/access-tokens/types/access-token";
import { PolicyFilter } from "@features/safe/iam/types/policy";
import { NzSelectComponent } from "ng-zorro-antd/select";
import { Subject } from "rxjs";

@Component({
  selector: 'access-token-drawer',
  templateUrl: './access-token-drawer.component.html',
  styleUrls: ['./access-token-drawer.component.less']
})
export class AccessTokenDrawerComponent implements OnInit {

  public policyCompareWith: (obj1: IAccessTokenPolicy, obj2: IAccessTokenPolicy) => boolean = (obj1: IAccessTokenPolicy, obj2: IAccessTokenPolicy) => {
    if(obj1 && obj2) {
      return obj1.id === obj2.id;
    } else {
      return false;
    }
  };

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<boolean> = new EventEmitter();

  policyDebouncer = new Subject<string>();
  constructor(
    private fb: FormBuilder,
    private policyService: PolicyService,
    private message: NzMessageService
  ) {
    this.policyDebouncer.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(query => this.searchPolicies(query));
  }

  displayPolicies: boolean = false

  @ViewChild("policyNodeSelector", { static: false }) policySelectNode: NzSelectComponent;
  selectedPolicyList: IAccessTokenPolicy[] = [];
  policySearchResultList: IAccessTokenPolicy[] = [];
  form: FormGroup;
  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required], [this.nameAsyncValidator], 'change'],
      type: [AccessTokenTypeEnum.Personal, [Validators.required]],
      policy: [null, []],
    });
  }

  onClose() {
    this.form.reset();
    this.close.emit();
  }

  onTypeChange() {
    const { type } = this.form.value;
    this.displayPolicies = type !== AccessTokenTypeEnum.Personal;
  }

  onPolicySelectChange() {
    const { policy } = this.form.value;

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
  }

  removePolicy(policy: IAccessTokenPolicy) {
    this.selectedPolicyList = this.selectedPolicyList.filter((p) => p.id !== policy.id);
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
    switchMap(value => this.policyService.isNameUsed(value as string)),
    map(isNameUsed => {
      switch (isNameUsed) {
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

  isLoading: boolean = false;
  doSubmit() {
    if (this.form.invalid) {
      for (const i in this.form.controls) {
        this.form.controls[i].markAsDirty();
        this.form.controls[i].updateValueAndValidity();
      }
      return;
    }

    this.isLoading = true;
    const {name, description} = this.form.value;
    this.policyService.create(name, description).subscribe(
      () => {
        this.isLoading = false;
        this.close.emit(true);
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
        this.form.reset();
      },
      _ => {
        this.isLoading = false;
      }
    )
  }

  actionTokenTypeLabel = {
    [AccessTokenTypeEnum.Personal]: $localize `:@@integrations.access-token.personal:Personal`,
    [AccessTokenTypeEnum.Service]: $localize `:@@integrations.access-token.personal:Service`
  }

  actionTokenTypes = [
    AccessTokenTypeEnum.Personal,
    AccessTokenTypeEnum.Service
  ]
}
