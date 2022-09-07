import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'extraUserColumn'
})
export class ExtraUserColumnPipe implements PipeTransform {

  transform(items: string[], filter: string[]): any {
    if (!items || !filter) {
      return items;
    }

    return items.filter(item => !filter.includes(item));
  }

}
