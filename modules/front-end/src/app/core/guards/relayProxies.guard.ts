import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { NzMessageService } from "ng-zorro-antd/message";

@Injectable({
  providedIn: 'root'
})
export class RelayProxiesGuard implements CanActivate {

  constructor(
    private router: Router,
    private message: NzMessageService,
    private permissionsService: PermissionsService
  ) {
  }

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    return await this.checkPermission(state.url);
  }

  async checkPermission(url: string): Promise<boolean | UrlTree> {
    const isGranted = !!this.permissionsService.isGranted(generalResourceRNPattern.relayProxy, permissionActions.ListRelayProxies);

    if (!isGranted) {
      this.message.warning($localize`:@@permissions.no-permissions-to-visit-relay-proxy-page:You don't have permissions to view the relay proxy page, please contact the admin to grant you the necessary permissions`);
      return false;
    }

    return isGranted;
  }
}
