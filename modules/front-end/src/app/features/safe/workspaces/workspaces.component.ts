import { Component, inject, OnInit } from '@angular/core';
import { LicenseFeatureEnum } from "@shared/types";
import { getCurrentLicense } from "@utils/project-env";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { PermissionsService } from "@services/permissions.service";

@Component({
  selector: 'workspaces',
  templateUrl: './workspaces.component.html',
  styleUrls: [ './workspaces.component.less' ],
  standalone: false
})
export class WorkspacesComponent implements OnInit {
  private permissionsService = inject(PermissionsService);

  canUpdateLicense: boolean = false;
  isGlobalUserGranted: boolean = false;

  ngOnInit(): void {
    const license = getCurrentLicense();
    this.isGlobalUserGranted = license.isGranted(LicenseFeatureEnum.GlobalUser);
    this.canUpdateLicense = this.permissionsService.isGranted(generalResourceRNPattern.workspace, permissionActions.UpdateWorkspaceLicense);
  }
}
