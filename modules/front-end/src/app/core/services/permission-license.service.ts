import { Injectable } from "@angular/core";
import { PermissionsService } from "@services/permissions.service";
import { getCurrentWorkspace } from "@utils/project-env";
import { License, LicenseFeatureEnum } from "@shared/types";
import { IamPolicyAction } from "@shared/policy";


@Injectable({
  providedIn: 'root'
})
export class PermissionLicenseService {
  license: License;

  constructor(private permissionService: PermissionsService) {
    const workspace = getCurrentWorkspace();
    this.license = new License(workspace.license);
  }

  isGrantedByLicense(feature: LicenseFeatureEnum): boolean {
    return this.license.isGranted(feature);
  }

  /**
   * Checks whether an action is allowed by combining license constraints
   * with IAM policy permissions.
   *
   * Evaluation order:
   * 1. The feature must be granted by the current license.
   * 2. If the license allows the feature, IAM permissions are evaluated.
   * 3. If the license does NOT allow the feature, `defaultValue` is returned
   *    and IAM permissions are NOT checked.
   *
   * @param rn Resource name to check permissions against
   * @param action IAM action to evaluate
   * @param feature License feature required for this action
   * @param fallbackValue Value to return when the license does not grant the feature
   * @returns `true` if the action is allowed, otherwise `false`
   */
  isGrantedByLicenseAndPermission(rn: string, action: IamPolicyAction, feature: LicenseFeatureEnum, fallbackValue: boolean): boolean {
    const isGrantedByLicense = this.license.isGranted(feature);
    if (!isGrantedByLicense) {
      return fallbackValue;
    }

    return this.permissionService.isGranted(rn, action);
  }
}
