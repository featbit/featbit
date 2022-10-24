import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OrganizationService } from '@services/organization.service';
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
    this.demoUrl = `http://localhost:5173?envKey=${currentOrganizationProjectEnv.projectEnv.envSecret}`;
  }

  onClose() {
    this.guideDrawerClosed.emit();
  }
}
