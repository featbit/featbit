import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'switchKeyName'
})
export class SwitchKeyNamePipe implements PipeTransform {

  transform(value: string): string {
    if (value) {
      return value
        // replace [empty / \ . : ] with '-'
        .replace(/\s|\/|\\|\.|:/g, '-')
        // replace [" ' __] with ''
        .replace(/'|"|__'/g, '');
    }

    return '';
  }

}
