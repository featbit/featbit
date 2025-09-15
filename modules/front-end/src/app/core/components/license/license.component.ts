import { Component, OnInit } from '@angular/core';
import { License, LicenseFeatureEnum } from "@shared/types";
import { getCurrentLicense } from "@utils/project-env";

@Component({
    selector: 'license',
    templateUrl: './license.component.html',
    styleUrls: ['./license.component.less'],
    standalone: false
})
export class LicenseComponent implements OnInit {
  license: License | undefined = undefined;

  ngOnInit(): void {
    this.license = getCurrentLicense();
  }

  features: LicenseFeatureEnum[] = [
    LicenseFeatureEnum.Sso,
    LicenseFeatureEnum.Schedule,
    LicenseFeatureEnum.ChangeRequest,
    LicenseFeatureEnum.MultiOrg,
    LicenseFeatureEnum.GlobalUser,
    LicenseFeatureEnum.ShareableSegment
  ];

  getLocalDate(date: number): Date | string {
    if (!date) return '';
    return new Date(date);
  }

  getStatusIcon(): string {
    if (this.isExpired()) return 'close-circle';
    if (this.isExpiringSoon()) return 'exclamation-circle';
    return 'check-circle';
  }

  getDaysUntilExpiry(): number {
    if (!this.license.data?.exp) return 0;
    const expDate = this.getLocalDate(this.license.data.exp);
    if (typeof expDate === 'string') return 0;
    return Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  getFeatureName(feature: LicenseFeatureEnum): string {
    switch (feature) {
      case LicenseFeatureEnum.Sso:
        return $localize`:@@common.sso:SSO`;
      case LicenseFeatureEnum.Schedule:
        return $localize`:@@common.schedule:Schedule`;
      case LicenseFeatureEnum.ChangeRequest:
        return $localize`:@@common.change-request:Change Request`;
      case LicenseFeatureEnum.MultiOrg:
        return $localize`:@@common.multi-org:Multiple Organization`;
      case LicenseFeatureEnum.GlobalUser:
        return $localize`:@@common.global-user:Global User`;
      case LicenseFeatureEnum.ShareableSegment:
        return $localize`:@@common.shareable-segment:Shareable Segment`;
      default:
        return '';
    }
  }

  isExpired(): boolean {
    if (!this.license.data?.exp) return false;
    const expDate = this.getLocalDate(this.license.data.exp);
    if (typeof expDate === 'string') return false;
    return new Date() > expDate;
  }

  isExpiringSoon(): boolean {
    if (!this.license.data?.exp) return false;
    const expDate = this.getLocalDate(this.license.data.exp);
    if (typeof expDate === 'string') return false;
    const daysUntilExpiry = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  }

  getStatusText(): string {
    if (this.isExpired()) return 'Expired';
    if (this.isExpiringSoon()) return 'Expiring Soon';
    return 'Active';
  }

  getGrantedFeaturesCount(): number {
    return this.features.filter(feature => this.license.isGranted(feature)).length;
  }
}
