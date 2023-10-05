import { Component, Input } from '@angular/core';
import { IAuthProps, ILicense } from "@shared/types";

@Component({
  selector: 'license',
  templateUrl: './license.component.html',
  styleUrls: ['./license.component.less']
})
export class LicenseComponent {

  @Input() license: ILicense;

  getLocalDate(date: number) {
    if (!date) return '';
    return new Date(date);
  }

}
