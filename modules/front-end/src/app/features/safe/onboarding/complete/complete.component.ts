import {Component, EventEmitter, OnDestroy, OnInit, Output} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Subject} from "rxjs";
import {OrganizationService} from "@services/organization.service";
import {IOrganization} from "@shared/types";



@Component({
  selector: 'onboarding-complete',
  templateUrl: './complete.component.html',
  styleUrls: ['./complete.component.less']
})
export class CompleteComponent implements OnInit, OnDestroy {
  private destroy$: Subject<void> = new Subject();

  @Output()
  close: EventEmitter<any> = new EventEmitter();

  public isVisible: boolean = false;
  public currentOrg: IOrganization;

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService
  ) {
    this.currentOrg = this.organizationService.getCurrentOrganizationProjectEnv().organization;
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
    this.close.emit();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
