import { Component, OnInit } from '@angular/core';
import { copyToClipboard, encodeURIComponentFfc } from '@utils/index';
import { BehaviorSubject, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { IPagedPolicy, IPolicy, PolicyFilter, policyRn } from "@features/safe/iam/types/policy";
import { PolicyService } from "@services/policy.service";
import {
  AccessTokenFilter, AccessTokenStatusEnum, AccessTokenTypeEnum,
  IAccessToken,
  IPagedAccessToken
} from "@features/safe/integrations/access-tokens/types/access-token";
import { AccessTokenService } from "@services/access-token.service";
import { IOrganization } from "@shared/types";
import { CURRENT_ORGANIZATION } from "@utils/localstorage-keys";
import { TeamService } from "@services/team.service";
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/permissions";

@Component({
  selector: 'access-tokens',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit {

  AccessTokenStatusActive = AccessTokenStatusEnum.Active;
  AccessTokenStatusInactive = AccessTokenStatusEnum.Inactive;

  AccessTokenTypePersonal = AccessTokenTypeEnum.Personal;
  AccessTokenTypeService = AccessTokenTypeEnum.Service;

  canTakeActionOnPersonalAccessToken = false;
  canTakeActionOnServiceAccessToken = false;
  constructor(
    private router: Router,
    private message: NzMessageService,
    private teamService: TeamService,
    private permissionsService: PermissionsService,
    private accessTokenService: AccessTokenService
  ) {
    const currentAccount: IOrganization = JSON.parse(localStorage.getItem(CURRENT_ORGANIZATION()));

    this.creatorSearchChange$.pipe(
      debounceTime(500)
    ).subscribe(searchText => {
      this.teamService.searchMembers(currentAccount.id, searchText).subscribe({
        next:(result) => {
          this.creatorList = result.items;
          this.isCreatorsLoading = false;
        },
        error: _ => {
          this.isCreatorsLoading = false;
        }
      });
    });

    this.canTakeActionOnPersonalAccessToken = this.permissionsService.canTakeAction(generalResourceRNPattern.account, permissionActions.CreatePersonalAccessTokens);
    this.canTakeActionOnServiceAccessToken = this.permissionsService.canTakeAction(generalResourceRNPattern.account, permissionActions.CreateServiceAccessTokens);
  }

  private search$ = new Subject();

  creatorSearchChange$ = new BehaviorSubject('');
  isCreatorsLoading = false;
  creatorList: any[];
  onSearchCreators(value: string) {
    if (value.length > 0) {
      this.isCreatorsLoading = true;
      this.creatorSearchChange$.next(value);
    }
  }

  isLoading: boolean = true;
  filter: AccessTokenFilter = new AccessTokenFilter();
  accessTokens: IPagedAccessToken = {
    items: [],
    totalCount: 0
  };

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getAccessTokens();
    });

    this.search$.next(null);
  }

  getAccessTokens() {
    this.isLoading = true;
    this.accessTokenService.getList(this.filter).subscribe({
      next: (accessTokens) => {
        this.accessTokens = accessTokens;
        this.isLoading = false;
      },
      error:() => this.isLoading = false
    });
  }

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  accessTokenDrawerVisible: boolean = false;
  private openAccessTokenDrawer(){
    this.accessTokenDrawerVisible = true;
  }

  accessTokenDrawerClosed(data: any) { //{ isEditing: boolean, id: string, name: string }
    this.accessTokenDrawerVisible = false;

    if (!data) {
      return;
    }

    if (!data.isEditing) {
      this.getAccessTokens();
    } else {
      this.accessTokens.items = this.accessTokens.items.map((ac) => {
        if (ac.id === data.id) {
          return { ...ac, name: data.name };
        }

        return ac;
      })
    }
  }

  currentAccessToken: IAccessToken;
  creatOrEdit(accessToken: IAccessToken = { name: null, type: AccessTokenTypeEnum.Personal, policies: []}) {
    this.currentAccessToken = accessToken;
    this.openAccessTokenDrawer();
  }

  delete(accessToken: IAccessToken) {
    this.accessTokenService.delete(accessToken.id).subscribe({
      next:() => {
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
        this.accessTokens.items = this.accessTokens.items.filter(it => it.id !== accessToken.id);
        this.accessTokens.totalCount--;
      },
      error: () => this.message.error($localize `:@@common.operation-failed:Operation failed`)
    })
  }

  toggleStatus(accessToken: IAccessToken) {
    this.accessTokenService.toggleStatus(accessToken.id).subscribe({
      next:() => {
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
        accessToken.status = accessToken.status === this.AccessTokenStatusActive ? this.AccessTokenStatusInactive :  this.AccessTokenStatusActive;
      },
      error: () => this.message.error($localize `:@@common.operation-failed:Operation failed`)
    })
  }
}
