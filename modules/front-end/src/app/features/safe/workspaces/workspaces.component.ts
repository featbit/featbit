import { Component, OnInit } from '@angular/core';
import { LicenseFeatureEnum } from "@shared/types";
import { getCurrentLicense } from "@utils/project-env";

@Component({
  selector: 'workspaces',
  templateUrl: './workspaces.component.html',
  styleUrls: ['./workspaces.component.less']
})
export class WorkspacesComponent implements OnInit {
  isGlobalUserGranted: boolean = false;

  ngOnInit(): void {
    const license = getCurrentLicense();
    this.isGlobalUserGranted = license.isGranted(LicenseFeatureEnum.GlobalUser);
  }
}
