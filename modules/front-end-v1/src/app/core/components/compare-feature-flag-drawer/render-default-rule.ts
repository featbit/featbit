import { Component, Input } from "@angular/core";
import { describeServe } from "@core/components/compare-feature-flag-drawer/utils";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'render-default-rule',
  template: `<span class="serve-content">{{ getDefaultServe() }}</span>`,
  styles: `
    .serve-content {
      color: #262626;
      font-size: 13px;
      font-weight: 500;
    }
  `
})
export class RenderDefaultRule {
  @Input()
  data: {flag: IFeatureFlag}

  getDefaultServe() {
    const flag = this.data.flag;
    return describeServe(flag.fallthrough, flag.variations);
  }
}
