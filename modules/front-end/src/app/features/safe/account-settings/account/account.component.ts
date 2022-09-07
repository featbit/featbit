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

  sdkModeNpm = 'npm';
  sdkModeScript = 'script';
  sdkMode = this.sdkModeScript;

  sdkCodeNpm = '';
  sdkCodeScript = '';
  sdkCodeSetUserInfo = '';
  sdkNpmInstall = `
  npm install ffc-js-client-sdk --save`;

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

    const projectEnv = getCurrentProjectEnv();
    this.sdkCodeScript = `
  <script data-ffc-client="${projectEnv.envSecret}" async src="https://assets.feature-flags.co/sdks/ffc-sdk.js"></script>`;

    this.sdkCodeSetUserInfo = `
  window.onload = (event) => {
    // 初始化用户信息，通常这一步会在登录后被调用
    FFCJsClient.initUserInfo({
        userName: '##{用户名}##',
        email: '##{用户邮箱（选填）}}##',
        key: '##{用户在产品中的唯一Id}##',
        customizeProperties: [
            {
                name: "##{自定义属性名称}##",
                value: "##{自定义属性值}##"
            }
        ]
    });
  });`;

    this.sdkCodeNpm = `
  import { FFCJsClient } from 'ffc-js-client-sdk/esm';

  FFCJsClient.initialize('${projectEnv.envSecret}');

  // 初始化用户信息，通常这一步会在登录后被调用
  FFCJsClient.initUserInfo({
      userName: '##{用户名}##',
      email: '##{用户邮箱（选填）}}##',
      key: '##{用户在产品中的唯一Id}##',
      customizeProperties: [
          {
              name: "##{自定义属性名称}##",
              value: "##{自定义属性值}##"
          }
      ]
  });`;
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
          this.message.success('更新信息成功！');
          this.accountService.setAccount({ id, initialized, organizationName });
        },
        () => {
          this.isLoading = false;
        }
      );
  }

}
