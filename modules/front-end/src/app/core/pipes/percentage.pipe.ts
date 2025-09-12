import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
    name: "percentage",
    standalone: false
})
export class PercentagePipe implements PipeTransform {
  constructor() {}

  transform(value, precision: number = 2) {
    if (value === -1 || value === '--') {
      return '--'
    } else {
      return `${Number((value * 100).toFixed(2))}%`
    }
  }
}
