import { Component } from '@angular/core';
import { environment } from 'src/environments/environment';
import { getCurrentProjectEnv } from "@utils/project-env";

@Component({
  selector: 'guide',
  templateUrl: './guide.component.html',
  styleUrls: ['./guide.component.less']
})
export class GuideComponent {

  demoUrl: string;

  constructor() {
    const envSecret = getCurrentProjectEnv().envSecret;
    this.demoUrl = `${environment.demoUrl}?envKey=${envSecret}&evaluationUrl=${environment.evaluationUrl}`;
  }
}
