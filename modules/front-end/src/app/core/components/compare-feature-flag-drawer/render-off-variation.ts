import { Component, Input } from "@angular/core";
import { IVariation } from "@shared/rules";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'render-off-variation',
  template: `{{ offVariation.value }}`
})
export class RenderOffVariation {
  @Input()
  data: { flag: IFeatureFlag }

  get offVariation(): IVariation {
    const flag = this.data.flag;
    return flag.variations.find(v => v.id === flag.disabledVariationId);
  }
}
