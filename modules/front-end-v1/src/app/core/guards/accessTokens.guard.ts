import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { NzMessageService } from "ng-zorro-antd/message";

export const accessTokensGuard = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
  permissionsService = inject(PermissionsService),
  message = inject(NzMessageService)
) => {
  const isGranted = permissionsService.isGranted(generalResourceRNPattern.accessToken, permissionActions.ListAccessTokens);

  if (!isGranted) {
    message.warning($localize`:@@permissions.no-permissions-to-visit-access-token-page:You don't have permissions to view the access token page, please contact the admin to grant you the necessary permissions`);
    return false;
  }

  return true;
}
