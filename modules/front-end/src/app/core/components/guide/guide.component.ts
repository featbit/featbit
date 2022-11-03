import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OrganizationService } from '@services/organization.service';
import { environment } from 'src/environments/environment';
import { IProjectEnv } from '@shared/types';

@Component({
  selector: 'guide-drawer',
  templateUrl: './guide.component.html',
  styleUrls: ['./guide.component.less']
})
export class GuideComponent {

  @Input()
  isVisible = true;
  @Output() guideDrawerClosed: EventEmitter<any> = new EventEmitter();

  demoUrl: string;

  constructor(
    private organizationService: OrganizationService
  ) {
    const currentOrganizationProjectEnv = this.organizationService.getCurrentOrganizationProjectEnv();
    const envSecret = currentOrganizationProjectEnv?.projectEnv?.envSecret;
    this.demoUrl = `${environment.demoUrl}?envKey=${envSecret}&evaluationUrl=${environment.evaluationUrl}`;
  }

  onClose() {
    this.guideDrawerClosed.emit();
  }
}
