import {Component, OnDestroy, OnInit} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Subject} from "rxjs";
import {OrganizationService} from "@services/organization.service";
import {IOrganization, IOrganizationProjectEnv} from "@shared/types";



@Component({
  selector: 'onboarding-complete',
  templateUrl: './complete.component.html',
  styleUrls: ['./complete.component.less']
})
export class CompleteComponent implements OnInit, OnDestroy {
  private destroy$: Subject<void> = new Subject();

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
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
