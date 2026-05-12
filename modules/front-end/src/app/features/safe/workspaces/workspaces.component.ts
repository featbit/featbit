import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LicenseFeatureEnum } from "@shared/types";
import { getCurrentLicense } from "@utils/project-env";
import { generalResourceRNPattern, permissionActions } from "@shared/policy";
import { PermissionsService } from "@services/permissions.service";
import { environment } from 'src/environments/environment';
import { HOSTING_MODE } from "@shared/constants";

@Component({
  selector: 'workspaces',
  templateUrl: './workspaces.component.html',
  styleUrls: [ './workspaces.component.less' ],
  standalone: false
})
export class WorkspacesComponent implements OnInit {
  private permissionsService = inject(PermissionsService);
  private route = inject(ActivatedRoute);

  paymentStatus: string = undefined;

  isSaas = environment.hostingMode === HOSTING_MODE.SAAS;
  canUpdateLicense: boolean = false;
  isGlobalUserGranted: boolean = false;

  ngOnInit(): void {
    const license = getCurrentLicense();
    this.isGlobalUserGranted = license.isGranted(LicenseFeatureEnum.GlobalUser);
    this.canUpdateLicense = this.permissionsService.isGranted(generalResourceRNPattern.workspace, permissionActions.UpdateWorkspaceLicense);

    this.route.queryParams.subscribe(params => {
      this.paymentStatus = params['payment_status'];
    });
  }
}
