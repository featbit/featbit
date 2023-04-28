import { Component } from '@angular/core';
import { OrganizationService } from '@services/organization.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'guide',
  templateUrl: './guide.component.html',
  styleUrls: ['./guide.component.less']
})
export class GuideComponent {

  demoUrl: string;

  constructor(
    private organizationService: OrganizationService
  ) {
    const currentOrganizationProjectEnv = this.organizationService.getCurrentOrganizationProjectEnv();
    const envSecret = currentOrganizationProjectEnv?.projectEnv?.envSecret;
    this.demoUrl = `${environment.demoUrl}?envKey=${envSecret}&evaluationUrl=${environment.evaluationUrl}`;
  }
}
