import { Pipe, PipeTransform } from '@angular/core';
import { AccessTokenStatusEnum } from "@features/safe/integrations/access-tokens/types/access-token";

@Pipe({
  name: 'accessTokenStatus',
  standalone: false
})
export class AccessTokenStatusPipe implements PipeTransform {
  typeDict = {
    [AccessTokenStatusEnum.Active]: $localize`:@@integrations.access-token.active:Active`,
    [AccessTokenStatusEnum.Inactive]: $localize`:@@integrations.access-token.inactive:Inactive`
  }

  transform(value: string): string {
    return this.typeDict[value] || '';
  }
}
