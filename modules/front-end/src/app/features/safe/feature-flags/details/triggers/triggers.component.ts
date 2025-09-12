import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';

@Component({
    selector: 'ff-triggers',
    templateUrl: './triggers.component.html',
    styleUrls: ['./triggers.component.less'],
    standalone: false
})
export class TriggersComponent implements OnInit, OnDestroy {

  private destory$: Subject<void> = new Subject();
  featureFlagKey: string;

  constructor(
    private route: ActivatedRoute,
  ) {
  }

  ngOnInit(): void {
    this.featureFlagKey = this.route.snapshot.paramMap.get('key');
  }

  ngOnDestroy(): void {
    this.destory$.next();
    this.destory$.complete();
  }
}
