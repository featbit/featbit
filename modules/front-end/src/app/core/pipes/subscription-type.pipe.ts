import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'subscriptionType'
})
export class SubscriptionTypePipe implements PipeTransform {
  typeDict = {
    'L100': '基础版',
    'L200': '团队版',
    'L300': '企业版'
  }

  transform(value: string): string {
    return this.typeDict[value] || '';
  }
}
