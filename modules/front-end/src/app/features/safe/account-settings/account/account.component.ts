import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { getAuth } from '@utils/index';
import { IAccount } from '@shared/types';
import { AccountService } from '@services/account.service';
import { getCurrentAccount, getCurrentProjectEnv } from "@utils/project-env";
import {PermissionsService} from "@services/permissions.service";
import {generalResourceRNPattern, permissionActions} from "@shared/permissions";

@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.less']
})
export class AccountComponent implements OnInit {

  creatAccountFormVisible: boolean = false;

  validateOrgForm!: FormGroup;

  auth = getAuth();
  currentAccount: IAccount;
  allAccounts: IAccount[];

  canUpdateOrgName: boolean = false;

  isLoading: boolean = false;

  constructor(
    private accountService: AccountService,
    private message: NzMessageService,
    private permissionsService: PermissionsService
  ) {
  }

  ngOnInit(): void {
    this.canUpdateOrgName = this.permissionsService.canTakeAction(generalResourceRNPattern.account, permissionActions.UpdateOrgName);
    this.allAccounts = this.accountService.accounts;

    const currentAccountId = getCurrentAccount().id;
    this.currentAccount = this.allAccounts.find(x => x.id == currentAccountId);

    this.initOrgForm();
  }

  initOrgForm() {
    this.validateOrgForm = new FormGroup({
      organizationName: new FormControl(this.currentAccount.organizationName, [Validators.required]),
    });
  }

  onCreateAccountClick() {
    this.creatAccountFormVisible = true;
  }

  onCreateAccountClosed(account: IAccount) {
    this.creatAccountFormVisible = false;
    if (account) {
      this.accountService.accounts = [...this.accountService.accounts, account];
      this.accountService.changeAccount(account);
    }
  }

  onAccountChange() {
    this.accountService.changeAccount(this.currentAccount);
  }

  submitOrgForm() {
    if (!this.canUpdateOrgName) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    if (this.validateOrgForm.invalid) {
      for (const i in this.validateOrgForm.controls) {
        this.validateOrgForm.controls[i].markAsDirty();
        this.validateOrgForm.controls[i].updateValueAndValidity();
      }
      return;
    }
    const { organizationName } = this.validateOrgForm.value;
    const { id, initialized } = this.currentAccount;

    this.isLoading = true;
    this.accountService.putUpdateAccount({ organizationName, id })
      .pipe()
      .subscribe(
        () => {
          this.isLoading = false;
          this.message.success($localize `:@@org.org.orgNameUpdateSuccess:Organization name updated!`);
          this.accountService.setAccount({ id, initialized, organizationName });
        },
        () => {
          this.isLoading = false;
        }
      );
  }

}
