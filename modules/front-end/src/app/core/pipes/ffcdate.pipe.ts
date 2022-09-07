import { Pipe, PipeTransform } from "@angular/core";
import moment from 'moment';

@Pipe({ name: "ffcDate" })
export class FfcDatePipe implements PipeTransform {
  constructor() {
    moment.locale('zh_cn');
  }

  transform(value) {
    if (value) {
      return moment(value).format('LL');
    }

    return '永远';
  }
}
