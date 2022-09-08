import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';

@Component({
  selector: 'switch-triggers',
  templateUrl: './triggers.component.html',
  styleUrls: ['./triggers.component.less']
})
export class TriggersComponent implements OnInit, OnDestroy {

  private destory$: Subject<void> = new Subject();
  featureFlagId: string;
  flagTriggerSubscriptionFlag: string = "基础版";

  constructor(
    private route: ActivatedRoute,
  ) {
  }

  ngOnInit(): void {
    this.featureFlagId = this.route.snapshot.paramMap.get('id');
  }

  ngOnDestroy(): void {
    this.destory$.next();
    this.destory$.complete();
  }
}
