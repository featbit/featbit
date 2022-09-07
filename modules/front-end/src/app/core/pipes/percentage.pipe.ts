import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: "percentage" })
export class PercentagePipe implements PipeTransform {
  constructor() {}

  transform(value) {
    if (value === -1 || value === '--') {
      return '--'
    } else {
      return (value * 100).toFixed(1) + '%'
    }
  }
}
