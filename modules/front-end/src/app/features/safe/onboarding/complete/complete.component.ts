import {Component, OnDestroy, OnInit} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Subject} from "rxjs";



@Component({
  selector: 'onboarding-complete',
  templateUrl: './complete.component.html',
  styleUrls: ['./complete.component.less']
})
export class CompleteComponent implements OnInit, OnDestroy {
  private destroy$: Subject<void> = new Subject();

  public isVisible: boolean = false;
  constructor(
    private route: ActivatedRoute
  ) {
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(queryMap => {
      if(queryMap.has('status')) {
        this.isVisible = queryMap.get('status') === 'init';
      }
    })
  }

  onClose() {
    this.isVisible = false;
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
