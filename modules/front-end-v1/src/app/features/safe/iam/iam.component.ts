import { Component, OnDestroy } from '@angular/core';

@Component({
    selector: 'iam',
    templateUrl: `./iam.component.html`,
    styleUrls: ['./iam.component.less'],
    standalone: false
})
export class IAMComponent implements OnDestroy {

  constructor(
  ) {
  }

  ngOnDestroy(): void {
  }
}
