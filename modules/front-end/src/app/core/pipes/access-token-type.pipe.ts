import { Pipe, PipeTransform } from '@angular/core';
import { AccessTokenTypeEnum } from "@features/safe/integrations/access-tokens/types/access-token";

@Pipe({
  name: 'accessTokenType'
})
export class AccessTokenTypePipe implements PipeTransform {
  typeDict = {
    [AccessTokenTypeEnum.Personal]: $localize `:@@integrations.access-token.personal:Personal`,
    [AccessTokenTypeEnum.Service]: $localize `:@@integrations.access-token.service:Service`
  }

  transform(value: string): string {
    return this.typeDict[value] || '';
  }
}
