import { Component, Input } from '@angular/core';
import { License, LicenseFeatureEnum } from "@shared/types";

@Component({
  selector: 'license',
  templateUrl: './license.component.html',
  styleUrls: ['./license.component.less']
})
export class LicenseComponent {

  @Input() license: License;

  getLocalDate(date: number) {
    if (!date) return '';
    return new Date(date);
  }

  protected readonly LicenseFeatureEnum = LicenseFeatureEnum;
}
