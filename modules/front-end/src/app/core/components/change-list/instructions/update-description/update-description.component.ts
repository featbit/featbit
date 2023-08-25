import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list/instructions/types";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { ISegment } from "@features/safe/segments/types/segments-index";
@Component({
  selector: 'update-description',
  template: `
    <div class="instruction">
      <ng-container *ngIf="!isClear">
        <span i18n="@@common.update-description-with-sufix-space">Update description </span>
        <ng-container *ngIf="previousDescription.length > 0">
          <span i18n="@@common.from-description">from</span>
          <span class="value remove-value">{{previousDescription}}</span>
        </ng-container>
        <span i18n="@@common.to-description">to</span>
        <span class="value">{{data.value}}</span>
      </ng-container>
      <ng-container *ngIf="isClear">
        <span i18n="@@common.clear-description">Clear description</span>
      </ng-container>
    </div>
  `,
  styles: [`
    .value {
      font-weight: 700;
      display: inline-block;
      margin-left: 4px;
      margin-right: 4px;
    }

    .remove-value {
      text-decoration: line-through;
    }
  `]
})
export class UpdateDescriptionComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get previousDescription(): string {
    const value = this.data.previous as IFeatureFlag | ISegment;
    return value.description;
  }

  get isClear(): boolean {
    const value = this.data.value as string;
    return value.length === 0;
  }
}
