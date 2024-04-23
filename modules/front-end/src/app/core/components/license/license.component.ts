import { Component, Input } from '@angular/core';
import { License, LicenseFeatureEnum } from "@shared/types";

@Component({
  selector: 'license',
  templateUrl: './license.component.html',
  styleUrls: ['./license.component.less']
})
export class LicenseComponent {

  @Input() license: License;

  features: LicenseFeatureEnum[] = [
    LicenseFeatureEnum.Sso,
    LicenseFeatureEnum.Schedule,
    LicenseFeatureEnum.ChangeRequest,
    LicenseFeatureEnum.MultiOrg,
    LicenseFeatureEnum.GlobalUser
  ];

  getLocalDate(date: number) {
    if (!date) return '';
    return new Date(date);
  }

  protected readonly LicenseFeatureEnum = LicenseFeatureEnum;

  getFeatureName(feature: LicenseFeatureEnum): string {
    // this.title = $localize`:@@relay-proxy.add-title:Add Relay Proxy`;
    switch (feature) {
      case LicenseFeatureEnum.Sso:
        return $localize`:@@common.sso:Single Sign-On`;
      case LicenseFeatureEnum.Schedule:
        return $localize`:@@common.schedule:Schedule`;
      case LicenseFeatureEnum.ChangeRequest:
        return $localize`:@@common.change-request:Change Request`;
      case LicenseFeatureEnum.MultiOrg:
        return $localize`:@@common.multi-org:Multiple Organization`;
      case LicenseFeatureEnum.GlobalUser:
        return $localize`:@@common.global-user:Global User`;
    }
  }
}
