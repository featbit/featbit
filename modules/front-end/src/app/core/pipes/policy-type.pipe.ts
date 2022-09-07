import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'policyType'
})
export class PolicyTypePipe implements PipeTransform {
  typeDict = {
    'FFCManaged': '敏捷开关托管',
    'CustomerManaged': '客户托管'
  }

  transform(value: string): string {
    return this.typeDict[value] || '';
  }
}
