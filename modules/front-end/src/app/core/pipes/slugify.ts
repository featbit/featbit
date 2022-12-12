import { Pipe, PipeTransform } from '@angular/core';
import { slugify } from "@utils/index";

@Pipe({
  name: 'slugify'
})
export class SlugifyPipe implements PipeTransform {

  transform(value: string): string {
    if (!value) {
      return '';
    }

    return slugify(value);
  }

}
