import { Component, inject, Input, OnInit } from '@angular/core';
import { License, LicenseFeatureEnum } from "@shared/types";
import { WorkspaceService } from "@services/workspace.service";
import { NzMessageService } from "ng-zorro-antd/message";

class LicenseDetail {
  plan: string;
  sub: string
  iat: Date;
  exp: Date;
  features: {
    id: LicenseFeatureEnum,
    name: string,
    isGranted: boolean,
    usage?: {
      quota: number,
      used: number
    }
  }[];

  constructor(license: License) {
    const data = license.data;
    if (!data) {
      throw new Error('Invalid license data');
    }

    this.plan = data.plan;
    this.sub = data.sub;
    this.iat = new Date(data.iat);
    this.exp = new Date(data.exp);

    const allFeatures = [
      LicenseFeatureEnum.Sso,
      LicenseFeatureEnum.Schedule,
      LicenseFeatureEnum.ChangeRequest,
      LicenseFeatureEnum.MultiOrg,
      LicenseFeatureEnum.GlobalUser,
      LicenseFeatureEnum.ShareableSegment,
      LicenseFeatureEnum.AutoAgents,
      LicenseFeatureEnum.FlagComparison
    ];

    this.features = allFeatures.map(feature => ({
      id: feature,
      name: this.getFeatureName(feature),
      isGranted: license.isGranted(feature)
    }))
  }

  updateUsage(id: LicenseFeatureEnum, usage: { quota: number, used: number }) {
    const featureDetail = this.features.find(f => f.id === id);
    if (featureDetail) {
      featureDetail.usage = { ...usage };
    }
  }

  getDaysUntilExpiry(): number {
    return Math.ceil((this.exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  isActive(): boolean {
    return !this.isExpiringSoon() && !this.isExpired();
  }

  isExpired(): boolean {
    return new Date() > this.exp;
  }

  isExpiringSoon(): boolean {
    const daysUntilExpiry = Math.ceil((this.exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  }

  grantedFeaturesCount(): number {
    return this.features.filter(f => f.isGranted).length;
  }

  private getFeatureName(feature: LicenseFeatureEnum): string {
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
      case LicenseFeatureEnum.AutoAgents:
        return $localize`:@@common.auto-agents:Auto Agents`;
      case LicenseFeatureEnum.FlagComparison:
        return $localize`:@@common.flag-comparison:Flag Comparison`;
      default:
        return '';
    }
  }
}

@Component({
  selector: 'license-card',
  templateUrl: './license-card.component.html',
  styleUrls: [ './license-card.component.less' ],
  standalone: false
})
export class LicenseCardComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private messageService = inject(NzMessageService);

  detail: LicenseDetail;
  loading: boolean = true;

  @Input()
  set license(value: License) {
    if (!value) {
      return;
    }

    this.detail = new LicenseDetail(value);
  }

  ngOnInit(): void {
    this.loadUsages();
  }

  loadUsages() {
    this.workspaceService.getUsages().subscribe({
      next: (usages) => {
        if (usages) {
          Object.keys(usages).forEach(key => {
              const id = key as LicenseFeatureEnum;
              this.detail.updateUsage(id, usages[key]);
            }
          );
        }
        this.loading = false;
      },
      error: () => {
        this.messageService.error($localize`:@@org.org.load-license-failed:Failed to load license usage, please try again later!`);
        this.loading = false;
      }
    });
  }
}
