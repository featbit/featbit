import { Component, Input } from "@angular/core";
import { IVariation } from "@shared/rules";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { NzTooltipDirective } from "ng-zorro-antd/tooltip";

@Component({
  selector: 'render-off-variation',
  imports: [
    NzTooltipDirective
  ],
  template: `<span nz-tooltip [nzTooltipTitle]="offVariation.value">{{ offVariation.name }}</span>`
})
export class RenderOffVariation {
  @Input()
  data: { flag: IFeatureFlag }

  get offVariation(): IVariation {
    const flag = this.data.flag;
    return flag.variations.find(v => v.id === flag.disabledVariationId);
  }
}
