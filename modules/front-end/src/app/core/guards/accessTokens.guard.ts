import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import {PermissionsService} from "@services/permissions.service";
import {generalResourceRNPattern, permissionActions} from "@shared/permissions";
import {NzMessageService} from "ng-zorro-antd/message";

@Injectable({
  providedIn: 'root'
})
export class AccessTokensGuard implements CanActivate {

  constructor(
    private router: Router,
    private message: NzMessageService,
    private permissionsService: PermissionsService
  ) { }

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    return await this.checkPermission(state.url);
  }

  async checkPermission(url: string): Promise<boolean | UrlTree> {
    const canListAccessTokens = !!this.permissionsService.canTakeAction(generalResourceRNPattern.account, permissionActions.ListAccessTokens);

    if (!canListAccessTokens) {
      this.message.warning(this.permissionsService.genericDenyMessage);
    }

    return canListAccessTokens;
  }
}
