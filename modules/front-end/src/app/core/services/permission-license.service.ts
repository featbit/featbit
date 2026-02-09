import { Injectable } from "@angular/core";
import { PermissionsService } from "@services/permissions.service";
import { getCurrentWorkspace } from "@utils/project-env";
import { License, LicenseFeatureEnum } from "@shared/types";
import { IamPolicyAction, permissionActions, ResourceTypeEnum } from "@shared/policy";


@Injectable({
  providedIn: 'root'
})
export class PermissionLicenseService {
  license: License;

  constructor(private permissionService: PermissionsService) {
    const workspace = getCurrentWorkspace();
    this.license = new License(workspace.license);
  }

  private getLicenseFeatureByAction(action: IamPolicyAction): LicenseFeatureEnum | null {
    // currently, only fine-grained actions need license
    if (action.isFineGrainedAction) {
      return LicenseFeatureEnum.FineGrainedAccessControl;
    }

    return null;
  }

  isGrantedByLicense(feature: LicenseFeatureEnum): boolean {
    return this.license.isGranted(feature);
  }

  /**
   * Checks if a user is granted access based on both license and permission policies.
   *
   * This method evaluates access control through a multi-layered approach:
   * 1. First checks if the user has the required permission via IAM policy
   * 2. Then validates if the action requires a specific license feature
   * 3. If a license feature is required, ensures the license is valid and grants the feature
   *
   * Special handling for expired licenses:
   * If the license is expired or not present, access is only granted for flag-related actions if the user has the `FlagAllActions` permission,
   * allowing continued access to flag management features while restricting access to features that require a valid license.
   *
   * @param rn Resource name to check permissions against
   * @param action IAM action to evaluate
   * @returns `true` if the action is allowed, otherwise `false`
   */
  isGrantedByLicenseAndPermission(rn: string, action: IamPolicyAction): boolean {
    const isGrantedByPolicy = this.permissionService.isGranted(rn, action);
    const feature = this.getLicenseFeatureByAction(action);

    if (!feature) {
      return isGrantedByPolicy;
    }

    // if license exists, check if the feature is granted and also check permission
    if (this.license.data && !this.license.isExpired()) {
      return this.license.isGranted(feature) && isGrantedByPolicy;
    }

    // no license or license expired, only allow access if it's a flag related action and user has FlagAllActions permission
    if (action.resourceType === ResourceTypeEnum.Flag) {
      return this.permissionService.isGranted(rn, permissionActions.FlagAllActions);
    }

    return false;
  }
}
