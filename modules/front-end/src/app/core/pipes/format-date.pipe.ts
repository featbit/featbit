import { Pipe, PipeTransform } from '@angular/core';
import { format } from 'date-fns';

@Pipe({
  name: 'formatDate'
})
export class FormatDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, dateFormat?: string): string | null {
    if (!value) {
      return 'N/A';
    }

    if (typeof value === 'string' && !Date.parse(value)) {
      return 'N/A';
    }

    if (typeof value === 'number' && value <= 0) {
      return 'N/A';
    }

    return format(new Date(value), dateFormat ?? 'yyyy-MM-dd HH:mm:ss');
  }
}
