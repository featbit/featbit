import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { PermissionsService } from "@services/permissions.service";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { NzMessageService } from "ng-zorro-antd/message";

export const iAMGuard = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
  permissionsService = inject(PermissionsService),
  message = inject(NzMessageService)
) => {
  const isGranted = permissionsService.isGranted(generalResourceRNPattern.iam, permissionActions.CanManageIAM);

  if (!isGranted) {
    message.warning($localize`:@@permissions.no-permissions-to-visit-iam-page:You don't have permissions to visit IAM, please contact the admin to grant you the necessary permissions`);
    return false;
  }

  return true;
}
