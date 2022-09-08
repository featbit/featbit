import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { FfcService } from '@services/ffc.service';

@Component({
  selector: 'compare-and-copy',
  templateUrl: './compare-and-copy.component.html',
  styleUrls: ['./compare-and-copy.component.less']
})
export class CompareAndCopyComponent implements OnDestroy {

  compareAndCopySubscriptionFlag: string = '基础版';

  constructor(
    private ffcService: FfcService
  ) {
    this.compareAndCopySubscriptionFlag = this.ffcService.variation('compare-and-copy-subscription', '基础版');
  }

  ngOnDestroy(): void {
  }


}
