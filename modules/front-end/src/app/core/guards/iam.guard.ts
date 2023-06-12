import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { NzMessageService } from "ng-zorro-antd/message";

@Injectable({
  providedIn: 'root'
})
export class IAMGuard implements CanActivate {

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
    const isGranted = this.permissionsService.isGranted(generalResourceRNPattern.iam, permissionActions.CanManageIAM);

    if (!isGranted) {
      this.message.warning($localize`:@@permissions.no-permissions-to-visit-iam-page:You don't have permissions to visit IAM, please contact the admin to grant you the necessary permissions`);
      return false;
    }

    return isGranted;
  }
}
