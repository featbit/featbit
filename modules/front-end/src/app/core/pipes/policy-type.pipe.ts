import { Pipe, PipeTransform } from '@angular/core';
import { PolicyTypeEnum } from "@features/safe/iam/types/policy";

@Pipe({
  name: 'policyType'
})
export class PolicyTypePipe implements PipeTransform {
  typeDict = {
    [PolicyTypeEnum.SysManaged]: $localize `:@@permission.sys-managed:System Managed`,
    [PolicyTypeEnum.CustomerManaged]: $localize `:@@permission.customer-managed:Customer Managed`
  }

  transform(value: string): string {
    return this.typeDict[value] || '';
  }
}
