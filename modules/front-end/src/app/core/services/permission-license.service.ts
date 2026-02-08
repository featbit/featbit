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
   * 1. Verifies the user has the required permission via IAM policy
   * 2. Determines if the action requires a specific license feature
   * 3. For actions that don't require a license, grants access immediately
   * 4. For flag resources, checks if user has `FlagAllActions` permission (bypasses license validation)
   * 5. For other license-protected actions, validates the license grants the required feature
   *
   * @param rn Resource name to check permissions against
   * @param action IAM action to evaluate
   * @returns `true` if the action is allowed, otherwise `false`
   */
  isGrantedByLicenseAndPermission(rn: string, action: IamPolicyAction): boolean {
    const isGrantedByPolicy = this.permissionService.isGranted(rn, action);
    if (!isGrantedByPolicy) {
      return false;
    }

    const licenseFeature = this.getLicenseFeatureByAction(action);
    if (!licenseFeature) {
      // if this is not a license-related action
      return true;
    }

    // if user has FlagAllActions permission, allow access to all flag-related actions regardless of license status
    if (action.resourceType === ResourceTypeEnum.Flag && this.permissionService.isGranted(rn, permissionActions.FlagAllActions)) {
      return true;
    }

    return this.license.isGranted(licenseFeature);
  }
}
