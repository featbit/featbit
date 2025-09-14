import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list/instructions/types";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { ISegment } from "@features/safe/segments/types/segments-index";

@Component({
  selector: 'update-name',
  template: `
    <div class="instruction">
      @if (isClear) {
        <span i18n="@@common.clear-name">Clear name</span>
      } @else {
        <span i18n="@@common.update-name-with-sufix-space">Update name </span>
        @if (previousName.length > 0) {
          <span i18n="@@common.from-name">from</span>
          <span class="value remove-value">{{ previousName }}</span>
        }
        <span i18n="@@common.to-name">to</span>
        <span class="value">{{ data.value }}</span>
      }
    </div>
  `,
  styles: [ `
    .value {
      font-weight: 700;
      display: inline-block;
      margin-left: 4px;
      margin-right: 4px;
    }

    .remove-value {
      text-decoration: line-through;
    }
  ` ],
  standalone: false
})
export class UpdateNameComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get previousName(): string {
    const value = this.data.previous as IFeatureFlag | ISegment;
    return value.name;
  }

  get isClear(): boolean {
    const value = this.data.value as string;
    return value.length === 0;
  }
}
