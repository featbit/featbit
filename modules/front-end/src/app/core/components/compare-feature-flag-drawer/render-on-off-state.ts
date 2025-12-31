import { Component, Input } from "@angular/core";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { NzTagComponent } from "ng-zorro-antd/tag";

@Component({
  selector: 'render-on-off-state',
  template: `
    <nz-tag [nzColor]="data.flag.isEnabled ? 'green' : 'red'">
      {{ data.flag.isEnabled ? 'ON' : 'OFF' }}
    </nz-tag>
  `,
  imports: [
    NzTagComponent
  ]
})
export class RenderOnOffState {
  @Input()
  data: { flag: IFeatureFlag }
}
