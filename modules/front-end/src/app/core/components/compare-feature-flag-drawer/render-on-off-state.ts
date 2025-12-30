import { Component, Input } from "@angular/core";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'render-on-off-state',
  template: `{{ data.flag.isEnabled ? 'ON' : 'OFF' }}`
})
export class RenderOnOffState {
  @Input()
  data: { flag: IFeatureFlag }
}
