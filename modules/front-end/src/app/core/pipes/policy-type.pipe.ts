import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'policyType'
})
export class PolicyTypePipe implements PipeTransform {
  typeDict = {
    'SysManaged': $localize `:@@permission.sys-managed:System Managed`,
    'CustomerManaged': $localize `:@@permission.customer-managed:Customer Managed`
  }

  transform(value: string): string {
    return this.typeDict[value] || '';
  }
}
