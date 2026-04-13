import { Component, inject, OnInit } from '@angular/core';
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { PermissionsService } from "@services/permissions.service";
import { getCurrentLicense } from "@utils/project-env";
import { LicenseFeatureEnum } from "@shared/types";

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

    this.canUpdateLicense = this.permissionsService.isGranted(generalResourceRNPattern.workspace, permissionActions.UpdateWorkspaceLicense);
    this.isGlobalUserGranted = license.isGranted(LicenseFeatureEnum.GlobalUser);
  }
}
