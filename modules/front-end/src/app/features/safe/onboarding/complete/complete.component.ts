import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { IOrganization } from "@shared/types";
import { getCurrentOrganization } from "@utils/project-env";

@Component({
  selector: 'onboarding-complete',
  templateUrl: './complete.component.html',
  styleUrls: ['./complete.component.less']
})
export class CompleteComponent implements OnInit {
  isVisible: boolean = false;
  currentOrg: IOrganization;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.currentOrg = getCurrentOrganization();
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
