import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { OrganizationService } from "@services/organization.service";
import { IOrganization } from "@shared/types";

@Component({
  selector: 'onboarding-complete',
  templateUrl: './complete.component.html',
  styleUrls: ['./complete.component.less']
})
export class CompleteComponent implements OnInit {
  public isVisible: boolean = false;
  public currentOrg: IOrganization;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private organizationService: OrganizationService
  ) {
    this.currentOrg = this.organizationService.getCurrentOrganizationProjectEnv().organization;
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(queryMap => {
      if (queryMap.has('status')) {
        this.isVisible = queryMap.get('status') === 'init';
      }
    })
  }

  close() {
    this.isVisible = false;
  }

  getStarted() {
    this.close();
    this.router.navigateByUrl(`/get-started`);
  }
}
